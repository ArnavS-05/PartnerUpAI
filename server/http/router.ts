import type { IncomingMessage, ServerResponse } from 'node:http';
import { ZodError, type z } from 'zod';
import { resolveUser, type AuthUser } from '../auth';
import { ApiError } from './errors';
import { inDatabase } from '../data/database';

export interface RequestContext {
  method: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  token: string | null;
  ip: string;
}

export interface AuthedContext extends RequestContext {
  user: AuthUser;
}

type Handler = (ctx: RequestContext) => Promise<unknown>;
type AuthedHandler = (ctx: AuthedContext) => Promise<unknown>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: Route[] = [];

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const source = path.replace(/:([a-zA-Z]+)/g, (_m, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { pattern: new RegExp(`^${source}/?$`), keys };
}

export function publicRoute(method: string, path: string, handler: Handler): void {
  routes.push({ method, ...compile(path), handler });
}

export function authedRoute(method: string, path: string, handler: AuthedHandler): void {
  routes.push({
    method,
    ...compile(path),
    handler: async (ctx) => {
      const user = await resolveUser(ctx.token);
      if (!user) throw new ApiError(401, 'unauthorized', 'Please sign in to continue.');
      return handler({ ...ctx, user });
    },
  });
}

export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join('.') || 'request';
    throw new ApiError(400, 'invalid_input', `Please check ${field}: ${issue?.message ?? 'invalid value'}.`);
  }
  return result.data;
}

const MAX_BODY_BYTES = 64 * 1024;

async function readBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined) return req.body; // Pre-parsed by a host (e.g. Vercel).
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new ApiError(413, 'too_large', 'That request is too large.');
    chunks.push(buf);
  }
  if (size === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body must be valid JSON.');
  }
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(payload === undefined ? '{}' : JSON.stringify(payload));
}

/** Handle /api/* requests. Returns false if the URL isn't an API route. */
export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return false;
  const method = (req.method ?? 'GET').toUpperCase();

  const candidates = routes.filter((r) => r.pattern.test(url.pathname));
  const route = candidates.find((r) => r.method === method);
  if (!route) {
    send(res, candidates.length ? 405 : 404, {
      error: { code: candidates.length ? 'method_not_allowed' : 'not_found', message: 'Not found.' },
    });
    return true;
  }

  try {
    const match = url.pathname.match(route.pattern);
    const params: Record<string, string> = {};
    route.keys.forEach((key, i) => {
      params[key] = decodeURIComponent(match?.[i + 1] ?? '');
    });
    const auth = req.headers.authorization;
    const cookie=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('partnerup_session='))?.slice(18);
    const token = process.env.VITEST && auth?.startsWith('Bearer ') ? auth.slice(7).trim() : cookie ?? null;
    const origin=req.headers.origin;
    if(!['GET','HEAD'].includes(method)&&origin&&new URL(origin).host!==req.headers.host)throw new ApiError(403,'origin','Please use the app from its own website.');
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const body = await readBody(req);
    let result = await inDatabase(()=>route.handler({ method, params, query: url.searchParams, body, token, ip }));
    const session=result as {accessToken?:string};
    const secure=process.env.NODE_ENV==='production'?'; Secure':'';
    if(session?.accessToken){res.setHeader('Set-Cookie',`partnerup_session=${session.accessToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}`);if(!process.env.VITEST)result={authenticated:true};}
    if(url.pathname==='/api/auth/logout'||url.pathname==='/api/account'&&method==='DELETE')res.setHeader('Set-Cookie',`partnerup_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
    send(res, 200, result);
  } catch (error) {
    if (error instanceof ApiError) {
      send(res, error.status, { error: { code: error.code, message: error.message } });
    } else if (error instanceof ZodError) {
      send(res, 400, { error: { code: 'invalid_input', message: 'Some of that input wasn’t valid.' } });
    } else {
      // Never leak stack traces or provider errors to the client.
      console.error('[partner-up] Unhandled API error:', error);
      send(res, 500, { error: { code: 'server_error', message: 'Something went wrong on our side. Your data is safe — try again.' } });
    }
  }
  return true;
}
