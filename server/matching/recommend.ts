import type { ConceptTag, MatchResult, Mode, ModeProfile, PartnerIntent, Profile } from '../../shared/types';
import { scoreMatch } from './engine';
import { buildSide, type Side } from './side';

export interface Candidate {
  profile: Profile;
  modeProfile: ModeProfile;
  intent?: PartnerIntent;
}

export interface Recommendation {
  candidate: Candidate;
  match: MatchResult;
}

export const MIN_SCORE_TO_SHOW = 25;

/**
 * Rank everyone active in `mode` for the seeker. Deterministic: ties broken
 * by id so the demo is reproducible.
 */
export function recommendPartners(
  seeker: { profile: Profile; modeProfile: ModeProfile | null },
  mode: Mode,
  intent: PartnerIntent | null,
  candidates: Candidate[],
  limit = 12,
): Recommendation[] {
  const side = buildSide(seeker.profile, mode, seeker.modeProfile, intent);
  return candidates
    .filter((c) => c.profile.id !== seeker.profile.id && c.modeProfile.mode === mode && c.modeProfile.active)
    .map((candidate) => ({ candidate, match: scoreMatch(side, buildSide(candidate.profile, mode, candidate.modeProfile, candidate.intent)) }))
    .filter((r) => r.match.score >= MIN_SCORE_TO_SHOW)
    .sort((x, y) => y.match.score - x.match.score || x.candidate.profile.id.localeCompare(y.candidate.profile.id))
    .slice(0, limit);
}

export function scorePair(
  seeker: { profile: Profile; modeProfile: ModeProfile | null },
  target: Candidate,
  mode: Mode,
  intent: PartnerIntent | null = null,
): MatchResult {
  const a: Side = buildSide(seeker.profile, mode, seeker.modeProfile, intent);
  const b: Side = buildSide(target.profile, mode, target.modeProfile);
  return scoreMatch(a, b);
}

/** Top attributes to show on a card: what you share, then what they bring. */
export function highlightsFor(match: MatchResult): ConceptTag[] {
  const out: ConceptTag[] = [];
  for (const tag of [...match.theyOffer, ...match.sharedInterests, ...match.youOffer]) {
    if (!out.some((t) => t.id === tag.id)) out.push(tag);
    if (out.length === 3) break;
  }
  return out;
}
