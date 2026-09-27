import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { getMemoryDb, persistMemoryDb } from './data/memoryStore';
import { DEMO_USER_ID } from './data/seed';
import { ApiError } from './http/errors';

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string | null;
}

const sessionKey=(token:string)=>createHmac('sha256',process.env.SESSION_SECRET||'local-development-only').update(token).digest('hex');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Local auth (demo data mode) ───────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

function createLocalSession(userId: string): SessionTokens {
  const db = getMemoryDb();
  const token = randomBytes(32).toString('base64url');
  db.sessions[sessionKey(token)] = { userId, createdAt: new Date().toISOString() };
  persistMemoryDb();
  return { accessToken: token, refreshToken: null };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function localSignUp(email: string, password: string): SessionTokens {
  const db = getMemoryDb();
  const normalized = normalizeEmail(email);
  if (db.users.some((u) => u.email === normalized)) {
    throw new ApiError(409, 'email_taken', 'An account with that email already exists. Try signing in.');
  }
  const user = { id: randomUUID(), email: normalized, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
  db.users.push(user);
  return createLocalSession(user.id);
}

export function localSignIn(email: string, password: string): SessionTokens {
  const db = getMemoryDb();
  const user = db.users.find((u) => u.email === normalizeEmail(email));
  // Same message either way: don't reveal which emails exist.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new ApiError(401, 'invalid_credentials', 'That email and password don’t match.');
  }
  return createLocalSession(user.id);
}

export function localSignOut(token: string): void {
  const db = getMemoryDb();
  if (db.sessions[sessionKey(token)]) {
    delete db.sessions[sessionKey(token)];
    persistMemoryDb();
  }
}

export function changeLocalPassword(user:AuthUser,currentPassword:string,newPassword:string):void {
  const account=getMemoryDb().users.find(u=>u.id===user.id);
  if(!account||!verifyPassword(currentPassword,account.passwordHash))throw new ApiError(400,'wrong_password','Your current password does not match.');
  account.passwordHash=hashPassword(newPassword);persistMemoryDb();
}

function resolveLocal(token: string): AuthUser | null {
  const db = getMemoryDb();
  const session = db.sessions[sessionKey(token)];
  if (!session) return null;
  if (Date.now() - Date.parse(session.createdAt) > SESSION_TTL_MS) {
    delete db.sessions[sessionKey(token)];
    persistMemoryDb();
    return null;
  }
  const user = db.users.find((u) => u.id === session.userId);
  return user ? { id: user.id, email: user.email } : null;
}

// ─── Public API ────────────────────────────────────────────────────────────

export function authMode(): 'local' { return 'local'; }
export async function resolveUser(token:string|null):Promise<AuthUser|null>{return token&&token.length<=4096?resolveLocal(token):null;}
export async function demoSession():Promise<SessionTokens>{
 if(process.env.DEMO_ENABLED==='false')throw new ApiError(404,'demo_unavailable','Demo is disabled.');
 return createLocalSession(DEMO_USER_ID);
}
export function isDemoUser(user:AuthUser):boolean{return process.env.DEMO_ENABLED!=='false'&&(user.id===DEMO_USER_ID||getMemoryDb().profiles.some(p=>p.isDemoPersona&&p.userId===user.id));}
export function switchDemoPersona(user: AuthUser, profileId: string): SessionTokens {
  if (authMode() !== 'local' || !isDemoUser(user)) throw new ApiError(403, 'demo_only', 'Account switching is only available in the fictional local demo.');
  const db = getMemoryDb();
  const profile = db.profiles.find(p => p.id === profileId && (p.isDemoPersona || p.userId === DEMO_USER_ID));
  if (!profile) throw new ApiError(404, 'not_found', 'Demo account not found.');
  if (!profile.userId) {
    profile.userId = randomUUID();
    db.users.push({ id: profile.userId, email: `${profile.id}@demo.partnerup.test`, passwordHash: null, createdAt: new Date().toISOString() });
  }
  return createLocalSession(profile.userId);
}

/** Remove the login itself (after the profile and its data are gone). */
export async function deleteAuthUser(user:AuthUser):Promise<void>{
 const db=getMemoryDb();db.users=db.users.filter(u=>u.id!==user.id);
 for(const [key,session] of Object.entries(db.sessions))if(session.userId===user.id)delete db.sessions[key];
 persistMemoryDb();
}
