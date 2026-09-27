import type { IncomingMessage, ServerResponse } from 'node:http';
import { registerRoutes } from './api/routes';
import { handleApi } from './http/router';

registerRoutes();

/** Framework-agnostic entry: returns false when the request isn't for /api. */
export function apiMiddleware(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  return handleApi(req, res);
}
