import type { MissingPartnerSuggestion, PartnerUpResponse, StudyGroupSuggestion } from '../../shared/types';
import type { AuthUser } from '../auth';
import { getStore } from '../data';
import { ApiError } from '../http/errors';
import { buildStudyGroup, findMissingPartner, groupObjective } from '../matching/groups';
import { buildSide, type Side } from '../matching/side';
import { canonicalize, canonicalizeAll } from '../semantic/similarity';
import { partnerUp } from './matching';
import { requireProfile } from './profiles';

async function learnContext(user: AuthUser): Promise<{ me: Side; pool: Side[] }> {
  const store = getStore();
  const profile = await requireProfile(user);
  const modeProfile = (await store.listModeProfiles(profile.id)).find((m) => m.mode === 'learn') ?? null;
  if (!modeProfile) {
    throw new ApiError(409, 'mode_profile_required', 'Tell Partner AI what you’re learning first (Learn mode), then we can build your group.');
  }
  const me = buildSide(profile, 'learn', modeProfile);
  const pool = (await store.listActiveCandidates('learn'))
    .filter((c) => c.profile.id !== profile.id)
    .map((c) => buildSide(c.profile, 'learn', c.modeProfile));
  return { me, pool };
}

function resolveSubjects(me: Side, requested?: string[]): string[] {
  const subjects = requested && requested.length ? canonicalizeAll(requested) : [...me.needs, ...me.strengths];
  return [...new Set(subjects)].slice(0, 6);
}

export async function buildGroup(user: AuthUser, input: { subjects?: string[]; size?: number }): Promise<StudyGroupSuggestion> {
  const { me, pool } = await learnContext(user);
  const subjects = resolveSubjects(me, input.subjects);
  if (subjects.length === 0) throw new ApiError(400, 'invalid_input', 'Add at least one subject for your group.');
  return buildStudyGroup(me, pool, subjects, input.size ?? 3);
}

export async function completeGroup(
  user: AuthUser,
  input: { memberIds: string[]; subjects: string[]; subject: string },
): Promise<MissingPartnerSuggestion> {
  const { me, pool } = await learnContext(user);
  const members = [me, ...pool.filter((p) => input.memberIds.includes(p.profile.id))];
  return findMissingPartner(me, members, pool, canonicalize(input.subject), canonicalizeAll(input.subjects));
}

export async function partnerUpWithGroup(
  user: AuthUser,
  input: { memberIds: string[]; subjects: string[] },
): Promise<{ results: Array<{ profileId: string } & PartnerUpResponse> }> {
  const { me, pool } = await learnContext(user);
  const memberIds = [...new Set(input.memberIds)].filter((id) => id !== me.profile.id);
  const members = pool.filter((p) => memberIds.includes(p.profile.id));
  if (members.length !== memberIds.length) throw new ApiError(404, 'not_found', 'Someone in that group is no longer available.');

  // Each member still has to independently choose you — groups never bypass consent.
  const results: Array<{ profileId: string } & PartnerUpResponse> = [];
  for (const id of memberIds) results.push({ profileId: id, ...(await partnerUp(user, id, 'learn', null)) });

  const subjects = canonicalizeAll(input.subjects);
  await getStore().saveStudyGroup({
    creatorId: me.profile.id,
    subjects,
    memberIds: [me.profile.id, ...memberIds],
    complementarity: Math.round(groupObjective([me, ...members], subjects) * 100),
  });
  return { results };
}
