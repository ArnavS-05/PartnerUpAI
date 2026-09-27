import type {
  DiscoverResponse,
  FeedbackValue,
  MatchCard,
  MatchDetail,
  MatchesResponse,
  Mode,
  PartnerIntent,
  PartnerUpResponse,
  Partnership,
  Profile,
  RequestStatus,
  SentRequest,
} from '../../shared/types';
import { MODE_LABELS } from '../../shared/labels';
import { generateConnectionBridge, generateMatchNarrative, parsePartnerIntent } from '../ai/service';
import type { AuthUser } from '../auth';
import { getStore } from '../data';
import { getMemoryDb } from '../data/memoryStore';
import { naviDb } from './naviStore';
import { toPublicProfile } from '../data/mappers';
import type { MatchRecord, PartnerRequestRecord } from '../data/store';
import { ApiError, forbidden, notFound } from '../http/errors';
import { highlightsFor, recommendPartners, scorePair, type Candidate } from '../matching/recommend';
import { toTag } from '../semantic/similarity';
import { requireProfile } from './profiles';

const REQUEST_TTL_DAYS = 30;
const MAX_PENDING_REQUESTS = 25;


const isExpired = (r: PartnerRequestRecord) => r.status === 'pending' && Date.parse(r.expiresAt) < Date.now();

async function candidateFor(targetId: string, mode: Mode): Promise<Candidate> {
  const store = getStore();
  const [profile, modeProfiles] = await Promise.all([store.getProfile(targetId), store.listModeProfiles(targetId)]);
  const modeProfile = modeProfiles.find((m) => m.mode === mode && m.active);
  if (!profile || !modeProfile) throw notFound('That person');
  return { profile, modeProfile };
}

async function seekerFor(me: Profile, mode: Mode) {
  const modeProfiles = await getStore().listModeProfiles(me.id);
  return { profile: me, modeProfile: modeProfiles.find((m) => m.mode === mode) ?? null };
}

/** What *I* can know about my relationship with someone: never whether they chose me. */
async function statusMap(meId: string, mode: Mode): Promise<Map<string, { status: RequestStatus; partnershipId: string | null }>> {
  const store = getStore();
  const [sent, matches] = await Promise.all([store.listRequestsFrom(meId), store.listMatchesFor(meId)]);
  const map = new Map<string, { status: RequestStatus; partnershipId: string | null }>();
  for (const r of sent) {
    if (r.mode === mode && r.status === 'pending' && !isExpired(r)) map.set(r.targetId, { status: 'pending', partnershipId: null });
  }
  for (const m of matches) {
    if (m.mode === mode && m.active) map.set(m.userA === meId ? m.userB : m.userA, { status: 'mutual', partnershipId: m.id });
  }
  return map;
}

// ─── Discover ──────────────────────────────────────────────────────────────

export async function discover(user: AuthUser, input: { mode?: Mode | null; text?: string }): Promise<DiscoverResponse> {
  const store = getStore();
  const me = await requireProfile(user);
  const text = input.text?.trim() ?? '';
  const intent = text ? await parsePartnerIntent(text, input.mode ?? null) : null;
  const mode: Mode = intent?.mode ?? input.mode ?? 'connect';
  if (intent) await store.saveIntent(me.id, mode, text, intent);

  const [seeker, candidates, statuses] = await Promise.all([seekerFor(me, mode), store.listActiveCandidates(mode), statusMap(me.id, mode)]);
  // Only active, intentionally shared Scout requests influence candidate intent.
  const requestedCandidates = candidates.map(candidate => {
    const request = [...getMemoryDb().intents].reverse().find(i => i.profileId === candidate.profile.id && i.mode === mode && naviDb().watches.some(w => w.owner === i.profileId && w.kind === 'scout' && w.active && w.text === i.rawText));
    return {...candidate, intent:request?.parsed};
  });
  const recs = recommendPartners(seeker, mode, intent, requestedCandidates);

  const results: MatchCard[] = recs.map(({ candidate, match }) => ({
    profile: toPublicProfile(candidate.profile),
    match,
    highlights: highlightsFor(match),
    headline: match.reasons[0]?.title ?? MODE_LABELS[mode].tagline,
    status: statuses.get(candidate.profile.id)?.status ?? 'none',
  }));

  const intentTags = intent
    ? { seeks: intent.seeks.map(toTag), offers: intent.offers.map(toTag), interests: intent.interests.map(toTag) }
    : null;
  return { mode, intent, intentTags, results, searchedCount: candidates.filter((c) => c.profile.id !== me.id).length };
}

// ─── Match detail ──────────────────────────────────────────────────────────

export async function matchDetail(user: AuthUser, targetId: string, mode: Mode, intent: PartnerIntent | null): Promise<MatchDetail> {
  const me = await requireProfile(user);
  if (targetId === me.id) throw new ApiError(400, 'self', 'That’s you!');
  const [target, seeker, statuses] = await Promise.all([candidateFor(targetId, mode), seekerFor(me, mode), statusMap(me.id, mode)]);
  const match = scorePair(seeker, target, mode, intent && intent.mode === mode ? intent : null);
  const firstName = target.profile.displayName.split(' ')[0];
  const narrative = await generateMatchNarrative(match, firstName, mode);
  const st = statuses.get(targetId);
  return {
    profile: toPublicProfile(target.profile),
    match,
    narrative,
    status: st?.status ?? 'none',
    partnershipId: st?.partnershipId ?? null,
    lookingFor: target.modeProfile.lookingFor,
  };
}

// ─── Partner Up (private, mutual-only reveal) ──────────────────────────────

async function createPartnership(a: Profile, b: Profile, mode: Mode, score: number, explanation: MatchRecord['explanation']): Promise<MatchRecord> {
  const store = getStore();
  const existing = await store.findActiveMatch(a.id, b.id, mode);
  if (existing) return existing;
  const match = await store.createMatch({
    userA: a.id,
    userB: b.id,
    mode,
    score,
    explanation,
    bridges: {},
    matchedAt: new Date().toISOString(),
    active: true,
    endedBy: null,
  });
  for (const [me, them] of [
    [a, b],
    [b, a],
  ] as const) {
    if (me.isDemoPersona) continue;
    await store.addNotification({
      profileId: me.id,
      type: 'mutual_match',
      title: 'It’s a partnership 🤝',
      body: `You and ${them.displayName.split(' ')[0]} both chose to Partner Up in ${MODE_LABELS[mode].name}.`,
      link: `/app/partnership/${match.id}`,
    });
  }
  return match;
}

export async function partnerUp(user: AuthUser, targetId: string, mode: Mode, intent: PartnerIntent | null): Promise<PartnerUpResponse> {
  const store = getStore();
  const me = await requireProfile(user);
  if (targetId === me.id) throw new ApiError(400, 'self', 'You can’t Partner Up with yourself.');
  const target = await candidateFor(targetId, mode);
  const seeker = await seekerFor(me, mode);
  const myModeProfile = seeker.modeProfile;
  if (!myModeProfile) {
    throw new ApiError(409, 'mode_profile_required', `Finish your ${MODE_LABELS[mode].name} answers first so they can find you too.`);
  }

  const active = await store.findActiveMatch(me.id, targetId, mode);
  if (active) return { status: 'mutual', partnershipId: active.id };

  let mine = await store.findOpenRequest(me.id, targetId, mode);
  if (mine && isExpired(mine)) {
    await store.updateRequestStatus(mine.id, 'expired');
    mine = null;
  }
  const match = scorePair(seeker, target, mode, intent && intent.mode === mode ? intent : null);
  const isNewRequest = !mine;
  if (!mine) {
    const pending = (await store.listRequestsFrom(me.id)).filter((r) => r.status === 'pending' && !isExpired(r));
    if (pending.length >= MAX_PENDING_REQUESTS) {
      throw new ApiError(429, 'too_many_requests', 'You have a lot of open Partner Up requests. Give people time to respond, or withdraw a few.');
    }
    mine = await store.createRequest({
      requesterId: me.id,
      targetId,
      mode,
      score: match.score,
      intentText: intent?.summary ?? null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + REQUEST_TTL_DAYS * 86_400_000).toISOString(),
    });
  }

  // Did they independently choose me too?
  let theirs = await store.findOpenRequest(targetId, me.id, mode);
  if (theirs && isExpired(theirs)) {
    await store.updateRequestStatus(theirs.id, 'expired');
    theirs = null;
  }

  // All choices, including seeded accounts, require an independent user action.
  if (theirs) {
    await store.updateRequestStatus(mine.id, 'matched');
    await store.updateRequestStatus(theirs.id, 'matched');
    const partnership = await createPartnership(me, target.profile, mode, match.score, match);
    return { status: 'mutual', partnershipId: partnership.id };
  }

  // One-sided: the other person learns only that *someone* chose them.
  if (!target.profile.isDemoPersona && isNewRequest) {
    await store.addNotification({
      profileId: targetId,
      type: 'interest',
      title: 'Someone wants to Partner Up 👀',
      body: `Someone privately chose you in ${MODE_LABELS[mode].name}. If you choose them too, you'll both find out.`,
      link: `/app/discover?mode=${mode}`,
    });
  }
  return { status: 'pending', partnershipId: null };
}

export async function withdrawRequest(user: AuthUser, requestId: string): Promise<{ ok: true }> {
  const store = getStore();
  const me = await requireProfile(user);
  const request = (await store.listRequestsFrom(me.id)).find((r) => r.id === requestId);
  if (!request) throw notFound('That request');
  if (request.status === 'pending') await store.updateRequestStatus(request.id, 'withdrawn');
  return { ok: true };
}

// ─── Matches / partnerships ────────────────────────────────────────────────

function partnerIdOf(match: MatchRecord, meId: string): string {
  return match.userA === meId ? match.userB : match.userA;
}

export async function listMatches(user: AuthUser): Promise<MatchesResponse> {
  const store = getStore();
  const me = await requireProfile(user);
  const [matches, sent, incoming] = await Promise.all([store.listMatchesFor(me.id), store.listRequestsFrom(me.id), store.listPendingTo(me.id)]);

  const activeMatches = matches.filter((m) => m.active);
  const openSent = sent.filter((r) => r.status === 'pending' && !isExpired(r));
  const people = await store.getProfiles([...new Set([...activeMatches.map((m) => partnerIdOf(m, me.id)), ...openSent.map((r) => r.targetId)])]);
  const byId = new Map(people.map((p) => [p.id, p]));

  const partnerships: Partnership[] = [];
  for (const m of activeMatches.sort((x, y) => y.matchedAt.localeCompare(x.matchedAt))) {
    const partner = byId.get(partnerIdOf(m, me.id));
    if (!partner) continue;
    partnerships.push({
      id: m.id,
      mode: m.mode,
      score: m.score,
      matchedAt: m.matchedAt,
      active: m.active,
      partner: toPublicProfile(partner),
      partnerContacts: [],
      bridge: null,
    });
  }

  const sentOut: SentRequest[] = [];
  for (const r of openSent.sort((x, y) => y.createdAt.localeCompare(x.createdAt))) {
    const target = byId.get(r.targetId);
    if (target) sentOut.push({ id: r.id, mode: r.mode, score: r.score, createdAt: r.createdAt, expiresAt: r.expiresAt, target: toPublicProfile(target) });
  }

  return { partnerships, sent: sentOut, incomingInterest: incoming.filter((r) => !isExpired(r)).length };
}

async function ownedMatch(meId: string, matchId: string): Promise<MatchRecord> {
  const match = await getStore().getMatch(matchId);
  if (!match) throw notFound('That partnership');
  // Only the two people in a partnership can ever see it.
  if (match.userA !== meId && match.userB !== meId) throw forbidden();
  return match;
}

export async function getPartnership(user: AuthUser, matchId: string): Promise<Partnership> {
  const store = getStore();
  const me = await requireProfile(user);
  const match = await ownedMatch(me.id, matchId);
  const partnerId = partnerIdOf(match, me.id);
  const partner = await store.getProfile(partnerId);
  if (!partner) throw notFound('That partner');

  // Contact info: only after mutual consent, only methods the partner opted to share.
  const partnerContacts = match.active
    ? (await store.listContacts(partnerId)).filter((c) => c.shareOnMatch).map(({ kind, value }) => ({ kind, value }))
    : [];

  let bridge = match.bridges[me.id] ?? null;
  if (!bridge && match.active) {
    const partnerModeProfiles = await store.listModeProfiles(partnerId);
    const partnerMode = partnerModeProfiles.find((m) => m.mode === match.mode);
    if (partnerMode) {
      const seeker = await seekerFor(me, match.mode);
      const view = scorePair(seeker, { profile: partner, modeProfile: partnerMode }, match.mode);
      bridge = await generateConnectionBridge(view, partner.displayName.split(' ')[0], match.mode);
      await store.updateMatch(match.id, { bridges: { ...match.bridges, [me.id]: bridge } });
    }
  }

  return {
    id: match.id,
    mode: match.mode,
    score: match.score,
    matchedAt: match.matchedAt,
    active: match.active,
    partner: toPublicProfile(partner),
    partnerContacts,
    bridge,
  };
}

export async function endPartnership(user: AuthUser, matchId: string): Promise<{ ok: true }> {
  const me = await requireProfile(user);
  const store = getStore();
  const match = await ownedMatch(me.id, matchId);
  if (match.active) {
    await store.updateMatch(match.id, { active: false, endedBy: me.id });
    // Consent is reset: reconnecting later requires both people to choose again.
    const partnerId = partnerIdOf(match, me.id);
    for (const [from, to] of [
      [me.id, partnerId],
      [partnerId, me.id],
    ] as const) {
      const request = await store.findOpenRequest(from, to, match.mode);
      if (request) await store.updateRequestStatus(request.id, 'withdrawn');
    }
  }
  return { ok: true };
}

export async function saveFeedback(user: AuthUser, targetId: string, mode: Mode, value: FeedbackValue): Promise<{ ok: true }> {
  const me = await requireProfile(user);
  if (targetId === me.id) throw new ApiError(400, 'self', 'That’s you!');
  await getStore().saveFeedback(me.id, targetId, mode, value);
  return { ok: true };
}
