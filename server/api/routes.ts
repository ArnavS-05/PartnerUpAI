import type { AppConfig, MeResponse } from '../../shared/types';
import { registerConnections } from './connections';
import { registerNavi, rescanWatches } from './navi';
import { draftProfileFromText, aiStatus } from '../ai/service';
import { authMode, demoSession, isDemoUser, localSignIn, localSignOut, localSignUp } from '../auth';
import { getStore } from '../data';
import { ApiError } from '../http/errors';
import { rateLimit } from '../http/rateLimit';
import { authedRoute, parseBody, publicRoute } from '../http/router';
import { buildGroup, completeGroup, partnerUpWithGroup } from '../services/groups';
import {
  discover,
  endPartnership,
  getPartnership,
  listMatches,
  matchDetail,
  partnerUp,
  saveFeedback,
  withdrawRequest,
} from '../services/matching';
import { deleteAccount, getMe, regenerateDna, requireProfile, saveContacts, saveModeProfile, saveProfile } from '../services/profiles';
import {
  ContactsSchema,
  CredentialsSchema,
  DiscoverSchema,
  FeedbackSchema,
  GroupBuildSchema,
  GroupCompleteSchema,
  GroupPartnerUpSchema,
  MatchTargetSchema,
  ModeProfileInputSchema,
  ModeSchema,
  ProfileDraftSchema,
  ProfileInputSchema,
  UuidSchema,
} from './schemas';

let registered = false;

export function registerRoutes(): void {
  if (registered) return;
  registered = true;
  registerConnections();
  registerNavi();

  // ── Public ───────────────────────────────────────────────────────────────
  publicRoute('GET', '/api/health', async () => ({ ok: true }));

  publicRoute('GET', '/api/config', async (): Promise<AppConfig> => ({
    authMode:'local',dataMode:'sqlite',aiEnabled:aiStatus().enabled,demoAvailable:process.env.DEMO_ENABLED!=='false',demoOnly:process.env.DEMO_ONLY==='true',
  }));

  const requireLocalAuth = () => {
    if (authMode() !== 'local') throw new ApiError(404, 'not_found', 'Not found.');
  };

  publicRoute('POST', '/api/auth/signup', async (ctx) => {
    if(process.env.DEMO_ONLY==='true')throw new ApiError(403,'demo_only','This free hosted demo uses fictional accounts. Use Try the demo instead.');
    requireLocalAuth();
    rateLimit(`auth:${ctx.ip}`, 10);
    const { email, password } = parseBody(CredentialsSchema, ctx.body);
    return localSignUp(email, password);
  });

  publicRoute('POST', '/api/auth/login', async (ctx) => {
    requireLocalAuth();
    rateLimit(`auth:${ctx.ip}`, 10);
    const { email, password } = parseBody(CredentialsSchema, ctx.body);
    return localSignIn(email, password);
  });

  publicRoute('POST', '/api/auth/logout', async (ctx) => {
    if (authMode() === 'local' && ctx.token) localSignOut(ctx.token);
    return { ok: true };
  });

  publicRoute('POST', '/api/auth/demo', async (ctx) => {
    rateLimit(`demo:${ctx.ip}`, 20);
    return demoSession();
  });

  // ── Me / profile ─────────────────────────────────────────────────────────
  authedRoute('GET', '/api/me', async ({ user }): Promise<MeResponse> => getMe(user));

  authedRoute('PUT', '/api/profile', async ({ user, body }) => saveProfile(user, parseBody(ProfileInputSchema, body)));

  authedRoute('PUT', '/api/mode-profiles/:mode', async ({ user, body, params }) => {
    const mode = parseBody(ModeSchema, params.mode);
    const saved = await saveModeProfile(user, mode, parseBody(ModeProfileInputSchema, body));
    await rescanWatches();
    return saved;
  });

  authedRoute('PUT', '/api/contacts', async ({ user, body }) => saveContacts(user, parseBody(ContactsSchema, body).contacts));

  authedRoute('POST', '/api/dna/generate', async ({ user }) => {
    rateLimit(`ai:${user.id}`, 30);
    return regenerateDna(user);
  });

  authedRoute('DELETE', '/api/account', async ({ user }) => {
    await deleteAccount(user);
    return { ok: true };
  });

  // ── Partner AI ───────────────────────────────────────────────────────────
  authedRoute('POST', '/api/ai/profile-draft', async ({ user, body }) => {
    rateLimit(`ai:${user.id}`, 30);
    const { text, mode } = parseBody(ProfileDraftSchema, body);
    return draftProfileFromText(text, mode);
  });

  // ── Matching ─────────────────────────────────────────────────────────────
  authedRoute('POST', '/api/discover', async ({ user, body }) => {
    const input = parseBody(DiscoverSchema, body);
    if (input.text) rateLimit(`ai:${user.id}`, 30);
    return discover(user, input);
  });

  authedRoute('POST', '/api/match/detail', async ({ user, body }) => {
    rateLimit(`ai:${user.id}`, 60);
    const { targetId, mode, intent } = parseBody(MatchTargetSchema, body);
    return matchDetail(user, targetId, mode, intent ?? null);
  });

  authedRoute('POST', '/api/partner-up', async ({ user, body }) => {
    rateLimit(`partner-up:${user.id}`, 40);
    const { targetId, mode, intent } = parseBody(MatchTargetSchema, body);
    return partnerUp(user, targetId, mode, intent ?? null);
  });

  authedRoute('DELETE', '/api/partner-up/:id', async ({ user, params }) => withdrawRequest(user, parseBody(UuidSchema, params.id)));

  authedRoute('GET', '/api/matches', async ({ user }) => listMatches(user));

  authedRoute('GET', '/api/partnerships/:id', async ({ user, params }) => {
    rateLimit(`ai:${user.id}`, 60);
    return getPartnership(user, parseBody(UuidSchema, params.id));
  });

  authedRoute('POST', '/api/partnerships/:id/end', async ({ user, params }) => endPartnership(user, parseBody(UuidSchema, params.id)));

  authedRoute('POST', '/api/feedback', async ({ user, body }) => {
    const { targetId, mode, value } = parseBody(FeedbackSchema, body);
    return saveFeedback(user, targetId, mode, value);
  });

  // ── Study groups (Learn) ─────────────────────────────────────────────────
  authedRoute('POST', '/api/groups/build', async ({ user, body }) => buildGroup(user, parseBody(GroupBuildSchema, body)));
  authedRoute('POST', '/api/groups/complete', async ({ user, body }) => completeGroup(user, parseBody(GroupCompleteSchema, body)));
  authedRoute('POST', '/api/groups/partner-up', async ({ user, body }) => {
    rateLimit(`partner-up:${user.id}`, 40);
    return partnerUpWithGroup(user, parseBody(GroupPartnerUpSchema, body));
  });

  // ── Notifications ────────────────────────────────────────────────────────
  authedRoute('GET', '/api/notifications', async ({ user }) => {
    const me = await requireProfile(user);
    return { notifications: await getStore().listNotifications(me.id) };
  });
  authedRoute('POST', '/api/notifications/read', async ({ user }) => {
    const me = await requireProfile(user);
    await getStore().markNotificationsRead(me.id);
    return { ok: true };
  });

  // ── Demo ─────────────────────────────────────────────────────────────────
  authedRoute('POST', '/api/demo/reset', async ({ user }) => {
    if (!isDemoUser(user)) throw new ApiError(403, 'forbidden', 'Only the demo account can be reset.');
    const me = await requireProfile(user);
    await getStore().resetDemoState(me.id);
    return { ok: true };
  });
}
