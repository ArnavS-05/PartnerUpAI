import type {
  ConceptTag,
  DimensionScore,
  GroupSize,
  MatchReason,
  MatchResult,
  MutualIntent,
  Setting,
  TimeSlot,
} from '../../shared/types';
import { GROUP_SIZE_LABELS, STUDY_STYLE_LABELS, TIME_SLOT_LABELS, listToSentence } from '../../shared/labels';
import { CONCEPT_BY_ID } from '../semantic/ontology';
import { bestMatch, commonConcept, conceptLabel, coverage, softOverlap, toTag, type OverlapPair } from '../semantic/similarity';
import { availabilityOverlap, availabilityScore } from './availability';
import type { Side } from './side';
import { MODE_DIMENSIONS } from './weights';

// Engine contract: every number here is computed deterministically from
// profile data. The LLM never produces or adjusts a score.

const STRONG = 0.75;

/** Seeks that describe doing something *together* — wanting it also means offering it. */
const SYMMETRIC_SEEKS = new Set([
  'explore-city', 'make-friends', 'cultural-exchange', 'gaming-buddy', 'watch-party', 'event-buddy', 'study-partner', 'language-exchange', 'discord-community',
]);

/** Anyone actively looking in a social mode can be a new friend. */
const IMPLICIT_OFFERS = ['make-friends'];

interface ModeScore {
  scores: Record<string, number>;
  reasons: MatchReason[];
  caveats: string[];
  sharedInterests: ConceptTag[];
  youOffer: ConceptTag[];
  theyOffer: ConceptTag[];
  mutualIntent: MutualIntent | null;
  /** Hard requirement not met → the total is scaled by this factor. */
  cap?: number;
}

// ─── Small helpers ─────────────────────────────────────────────────────────

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function labels(ids: string[], max = 3): string {
  return listToSentence(ids.slice(0, max).map(conceptLabel));
}

const SEEK_PHRASES: Record<string, string> = {
  'meet-internationals': 'meet international students and visitors',
  'show-around': 'show people around',
  'cultural-exchange': 'share cultures',
  'local-friend': 'find a local friend',
  local: 'meet a local',
  'explore-city': 'explore the city',
  'make-friends': 'make new friends',
  'gaming-buddy': 'find people to game with',
  'watch-party': 'find people for watch parties',
  'event-buddy': 'find people to go to events with',
  'discord-community': 'find a small Discord group',
  'language-exchange': 'do a language exchange',
  'study-partner': 'find study partners',
  newcomer: 'meet other newcomers',
  'international-student': 'meet international students',
};

function seekPhrase(id: string): string {
  return SEEK_PHRASES[id] ?? `connect over ${conceptLabel(id)}`;
}

function sharedVerb(id: string): string {
  const concept = CONCEPT_BY_ID.get(id);
  if (!concept) return 'Both into';
  if (concept.category === 'game') return concept.parent ? 'Both play' : 'Both into';
  if (concept.category === 'sport') {
    return ['formula-1', 'motorsport', 'american-football'].includes(id) ? 'Both follow' : 'Both into';
  }
  if (concept.category === 'music' || concept.category === 'food') return 'Both love';
  return 'Both into';
}

/**
 * Reasons must be literally true. "Both love Music" is only said when both
 * listed Music, or one listed Music and the other a kind of music (Jazz).
 * Merely related interests are labelled as related, never as shared.
 */
function sharedReasons(pairs: OverlapPair[], other: Side, max = 2): MatchReason[] {
  return pairs.slice(0, max).map((pair) => {
    const common = commonConcept(pair.a, pair.b);
    if (common) {
      const tag = toTag(common);
      return {
        kind: 'shared' as const,
        emoji: tag.emoji,
        title: `${sharedVerb(common)} ${tag.label}`,
        detail:
          pair.a === pair.b
            ? `${tag.label} is on both of your profiles.`
            : `You mentioned ${conceptLabel(pair.a)}; ${other.firstName} mentioned ${conceptLabel(pair.b)}.`,
      };
    }
    const tag = toTag(pair.b);
    return {
      kind: 'shared' as const,
      emoji: tag.emoji,
      title: `Related interests: ${conceptLabel(pair.a)} & ${tag.label}`,
      detail: `You mentioned ${conceptLabel(pair.a)}; ${other.firstName} is into ${tag.label}.`,
    };
  });
}

/** Tags that are genuinely shared (exact, or one is a kind of the other). */
function sharedTags(pairs: OverlapPair[]): ConceptTag[] {
  const ids: string[] = [];
  for (const pair of pairs) {
    const common = commonConcept(pair.a, pair.b);
    if (common && !ids.includes(common)) ids.push(common);
  }
  return ids.map(toTag);
}

function availabilityReason(overlap: TimeSlot[], score: number): MatchReason | null {
  if (score < 0.6 || overlap.length === 0) return null;
  const night = overlap.includes('late_nights') || overlap.includes('evenings');
  return {
    kind: 'availability',
    emoji: night ? '🌙' : '🗓️',
    title: `Both usually free ${listToSentence(overlap.map((s) => TIME_SLOT_LABELS[s].toLowerCase()))}`,
    detail: 'Your schedules overlap, so actually meeting up is realistic.',
  };
}

function groupSizeCompat(a: GroupSize[], b: GroupSize[]): number {
  if (a.length === 0 || b.length === 0) return 0.6;
  if (a.some((g) => b.includes(g))) return 1;
  const order: GroupSize[] = ['one_on_one', 'small_group', 'large_group'];
  const adjacent = a.some((x) => b.some((y) => Math.abs(order.indexOf(x) - order.indexOf(y)) === 1));
  return adjacent ? 0.5 : 0;
}

function settingCompat(a: Setting, b: Setting): number {
  if (a === 'either' || b === 'either' || a === b) return 1;
  return 0.2;
}

function sharedInterestScore(a: Side, b: Side): { score: number; pairs: OverlapPair[] } {
  const poolB = unique([...b.interests, ...b.offers]);
  const base = softOverlap(a.interests, b.interests, { categoryCredit: 0.25 });
  const focus = coverage(a.focusInterests, poolB, { categoryCredit: 0.25 });
  const score = focus === null ? base.score : 0.7 * focus + 0.3 * base.score;
  // Only strong, real overlaps are shown to people — what they asked for first.
  const display = softOverlap(unique([...a.focusInterests, ...a.interests]), poolB, { minPairScore: STRONG, target: 3 });
  const focusRank = (p: OverlapPair) => {
    const i = a.focusInterests.indexOf(p.a);
    return i === -1 ? a.focusInterests.length : i;
  };
  const pairs = [...display.pairs].sort((p, q) => focusRank(p) - focusRank(q) || q.score - p.score);
  return { score, pairs };
}

/** For each wanted item, what (if anything) in pool satisfies it strongly. */
function strongHits(wanted: string[], pool: string[]): Array<{ want: string; by: string; score: number }> {
  const hits: Array<{ want: string; by: string; score: number }> = [];
  for (const want of wanted) {
    const m = bestMatch(want, pool);
    if (m.match && m.score >= STRONG) hits.push({ want, by: m.match, score: m.score });
  }
  return hits;
}

function sameCommunity(a: Side, b: Side): boolean {
  return Boolean(a.community && a.community === b.community);
}

function sameCity(a: Side, b: Side): boolean {
  return Boolean(a.city && a.city === b.city);
}

function cityLabel(side: Side): string {
  return side.city ? side.city.replace(/\b\w/g, (c) => c.toUpperCase()) : 'your city';
}

// ─── CONNECT ───────────────────────────────────────────────────────────────

function scoreConnect(a: Side, b: Side): ModeScore {
  const reasons: MatchReason[] = [];
  const caveats: string[] = [];

  const shared = sharedInterestScore(a, b);

  const aPool = unique([...a.offers, ...a.allSeeks, ...a.interests, ...IMPLICIT_OFFERS]);
  const bPool = unique([...b.offers, ...b.allSeeks, ...b.interests, ...IMPLICIT_OFFERS]);
  const aWantsList = a.seeks.length > 0 ? a.seeks : a.focusInterests;
  const aWants = coverage(aWantsList, bPool, { categoryCredit: 0.2 }) ?? 0.5;
  const bWants = coverage(b.seeks, aPool, { categoryCredit: 0.2 }) ?? 0.5;
  const mutual = Math.sqrt(aWants * bWants);

  const avail = availabilityScore(a.availability, b.availability, a.availabilityRequested);
  const overlap = availabilityOverlap(a.availability, b.availability);

  const group = groupSizeCompat(a.groupSizes, b.groupSizes);
  const setting = settingCompat(a.setting, b.setting);
  const social = 0.6 * group + 0.4 * setting;

  const online = a.setting !== 'in_person' && b.setting !== 'in_person';
  const context = b.profile.skills.length ? b.profile.skills.filter(s => !a.profile.skills.includes(s)).length / b.profile.skills.length : 0;

  reasons.push(...sharedReasons(shared.pairs, b));

  const bSeekHit = strongHits(b.seeks, aPool)[0];
  const detected = aWants >= 0.7 && bWants >= 0.7 && b.seeks.length > 0;
  if (detected && bSeekHit) {
    reasons.push({
      kind: 'mutual',
      emoji: '🤝',
      title: `${b.firstName} is also looking to ${seekPhrase(bSeekHit.want)}`,
      detail: b.lookingFor ? `In their words: “${b.lookingFor}”` : `${b.firstName} is actively looking in Connect right now.`,
    });
  }

  const availReason = availabilityReason(overlap, avail);
  if (availReason) reasons.push(availReason);

  const sharedGroup = a.groupSizes.find((g) => b.groupSizes.includes(g));
  if (sharedGroup) {
    reasons.push({
      kind: 'social',
      emoji: '💬',
      title: `Both prefer ${GROUP_SIZE_LABELS[sharedGroup].toLowerCase()}`,
      detail: online ? 'You’re both happy to hang out online.' : 'Similar social energy makes the first hangout easier.',
    });
  }
  if (sameCommunity(a, b)) {
    reasons.push({ kind: 'location', emoji: '🏫', title: `Both at ${b.profile.community}`, detail: 'Easy to meet up in person too.' });
  }

  if (avail < 0.4) caveats.push('Your usual schedules don’t overlap much.');
  if (setting < 1) caveats.push(`${b.firstName} prefers ${b.setting === 'online' ? 'online' : 'in-person'} hangouts.`);

  const mutualIntent: MutualIntent = {
    detected,
    youWant: a.intent?.summary || (aWantsList.length ? `To ${seekPhrase(aWantsList[0])}` : 'To meet people who share your interests'),
    theyWant: b.lookingFor || (b.seeks.length ? `To ${seekPhrase(b.seeks[0])}` : 'Open to meeting new people'),
    summary: detected
      ? `You're looking for what ${b.firstName} offers — and ${b.firstName} is looking for someone like you.`
      : `${b.firstName} shares some of your interests, but is looking for something a little different right now.`,
  };

  return {
    scores: { shared_interests: shared.score, mutual_intent: mutual, availability: avail, social, context },
    reasons,
    caveats,
    sharedInterests: sharedTags(shared.pairs),
    youOffer: [],
    theyOffer: [],
    mutualIntent,
  };
}

// ─── LEARN ─────────────────────────────────────────────────────────────────

function isLanguage(id: string): boolean {
  return CONCEPT_BY_ID.get(id)?.category === 'language';
}

function scoreLearn(a: Side, b: Side): ModeScore {
  const reasons: MatchReason[] = [];
  const caveats: string[] = [];

  const aGetsRaw = coverage(a.needs, b.strengths);
  const bGetsRaw = coverage(b.needs, a.strengths);
  const aGets = aGetsRaw ?? 0.4;
  const bGets = bGetsRaw ?? 0.3; // They only want to help: useful, but not a two-way exchange.
  const complementary = (aGets + bGets) / 2;
  const mutualValue = Math.sqrt(aGets * bGets);

  const avail = availabilityScore(a.availability, b.availability, a.availabilityRequested);
  const overlap = availabilityOverlap(a.availability, b.availability);

  const sharedStyles = a.studyStyles.filter((s) => b.studyStyles.includes(s));
  const styleScore =
    a.studyStyles.length === 0 || b.studyStyles.length === 0
      ? 0.6
      : sharedStyles.length / Math.min(a.studyStyles.length, b.studyStyles.length);
  const groupScore =
    a.groupPreference === 'either' || b.groupPreference === 'either' || a.groupPreference === b.groupPreference ? 1 : 0.3;
  const learningFit = 0.5 * clamp01(styleScore) + 0.5 * groupScore;

  const sharedCourses = a.courses.filter((c) => b.courses.includes(c));
  const courseScore = a.courses.length && b.courses.length ? sharedCourses.length / Math.min(a.courses.length, b.courses.length) : 0;
  const context = 0.5 * (sameCommunity(a, b) ? 1 : 0) + 0.3 * clamp01(courseScore) + 0.2 * (sameCity(a, b) ? 1 : 0);

  const theyHelp = strongHits(a.needs, b.strengths);
  const youHelp = strongHits(b.needs, a.strengths);

  for (const hit of theyHelp.slice(0, 2)) {
    const tag = toTag(hit.want);
    reasons.push(
      isLanguage(hit.want)
        ? {
            kind: 'complement',
            emoji: '🗣️',
            title: `${b.firstName} speaks ${tag.label} fluently`,
            detail: `You're learning ${tag.label} — ${b.firstName} can practice with you.`,
          }
        : {
            kind: 'complement',
            emoji: tag.emoji,
            title: `${b.firstName} can help you with ${tag.label}`,
            detail: `${b.firstName} lists ${conceptLabel(hit.by)} as a strength — you said you need help with ${tag.label}.`,
          },
    );
  }
  for (const hit of youHelp.slice(0, 2)) {
    const tag = toTag(hit.want);
    reasons.push(
      isLanguage(hit.want)
        ? {
            kind: 'complement',
            emoji: '🗣️',
            title: `You can help ${b.firstName} practice ${tag.label}`,
            detail: `${b.firstName} is learning ${tag.label}, which you speak fluently.`,
          }
        : {
            kind: 'complement',
            emoji: tag.emoji,
            title: `You can help ${b.firstName} with ${tag.label}`,
            detail: `${b.firstName} is looking for help with ${tag.label} — one of your strengths.`,
          },
    );
  }

  const detected = theyHelp.length > 0 && youHelp.length > 0;
  if (detected) {
    reasons.unshift({
      kind: 'mutual',
      emoji: '🔁',
      title: 'Mutual learning match',
      detail: 'Neither of you is “the tutor” — you each teach something and learn something.',
    });
  }

  const availReason = availabilityReason(overlap, avail);
  if (availReason) reasons.push(availReason);
  if (sharedStyles.length > 0) {
    reasons.push({
      kind: 'learning',
      emoji: '📝',
      title: `Both learn best with ${STUDY_STYLE_LABELS[sharedStyles[0]].toLowerCase()}`,
      detail: 'Similar study habits mean smoother sessions.',
    });
  }
  if (sharedCourses.length > 0) {
    reasons.push({
      kind: 'location',
      emoji: '🏫',
      title: `Both taking ${sharedCourses.slice(0, 2).join(' & ')}`,
      detail: 'Same syllabus, same deadlines.',
    });
  } else if (sameCommunity(a, b)) {
    reasons.push({ kind: 'location', emoji: '🏫', title: `Both at ${b.profile.community}`, detail: 'Easy to meet on campus.' });
  }

  // Similarity ≠ compatibility: flag shared gaps nobody can fill.
  const sharedGaps = a.needs.filter(
    (n) => b.needs.some((m) => m === n) && bestMatch(n, b.strengths).score < STRONG && bestMatch(n, a.strengths).score < STRONG,
  );
  if (sharedGaps.length > 0) {
    caveats.push(`You both need help with ${labels(sharedGaps)} — similar, but neither of you can cover it.`);
  }
  if (bGetsRaw === null) caveats.push(`${b.firstName} is mostly offering help — less of a two-way exchange.`);
  else if (youHelp.length === 0) caveats.push(`You can't cover what ${b.firstName} needs help with (${labels(b.needs, 2)}).`);
  if (a.needs.length > 0 && theyHelp.length === 0) caveats.push(`${b.firstName} isn't strong in ${labels(a.needs, 2)}.`);
  if (avail < 0.4) caveats.push('Your study schedules don’t overlap much.');

  const mutualIntent: MutualIntent = {
    detected,
    youWant: a.needs.length ? `Help with ${labels(a.needs)}` : 'To learn together',
    theyWant: b.needs.length ? `Help with ${labels(b.needs)}` : b.lookingFor || 'To help others learn',
    summary: detected
      ? `You need ${labels(theyHelp.map((h) => h.want))}, which ${b.firstName} is strong in. ${b.firstName} needs ${labels(
          youHelp.map((h) => h.want),
        )}, which you're strong in.`
      : `This would be more one-directional than a mutual learning match.`,
  };

  return {
    scores: { complementary, mutual_value: mutualValue, availability: avail, learning_fit: learningFit, context },
    reasons,
    caveats,
    sharedInterests: [],
    youOffer: youHelp.map((h) => toTag(h.want)),
    theyOffer: theyHelp.map((h) => toTag(h.want)),
    mutualIntent,
  };
}

// ─── EXPLORE ───────────────────────────────────────────────────────────────

const LANGUAGE_LEVEL_RANK = { native: 3, fluent: 3, conversational: 2, learning: 1 } as const;

function scoreExplore(a: Side, b: Side): ModeScore {
  const reasons: MatchReason[] = [];
  const caveats: string[] = [];

  const cityMatch = sameCity(a, b);
  const aLocal = a.role === 'local';
  const bLocal = b.role === 'local';
  const roleFit = aLocal !== bLocal ? 1 : !aLocal && !bLocal ? 0.7 : 0.5;
  const location = cityMatch ? 0.6 + 0.4 * roleFit : 0;

  const symmetric = (side: Side) => side.allSeeks.filter((id) => SYMMETRIC_SEEKS.has(id));
  const aPool = unique([...a.offers, ...a.roleTags, ...a.interests, ...symmetric(a), ...IMPLICIT_OFFERS]);
  const bPool = unique([...b.offers, ...b.roleTags, ...b.interests, ...symmetric(b), ...IMPLICIT_OFFERS]);
  const aWants = coverage(a.seeks, bPool) ?? 0.5;
  const bWants = coverage(b.seeks, aPool) ?? 0.5;
  const mutual = Math.sqrt(aWants * bWants);

  const shared = sharedInterestScore(a, b);
  const avail = availabilityScore(a.availability, b.availability, a.availabilityRequested);
  const overlap = availabilityOverlap(a.availability, b.availability);

  // Language: can they comfortably talk? (both at least conversational)
  let language = 0;
  let sharedLanguage: string | null = null;
  for (const la of a.languages) {
    const lb = b.languages.find((l) => l.id === la.id);
    if (!lb) continue;
    const minRank = Math.min(LANGUAGE_LEVEL_RANK[la.level], LANGUAGE_LEVEL_RANK[lb.level]);
    const s = minRank >= 3 ? 1 : minRank === 2 ? 0.85 : 0.4;
    if (s > language) {
      language = s;
      sharedLanguage = la.id;
    }
  }

  if (cityMatch) {
    reasons.push({
      kind: 'location',
      emoji: '📍',
      title: bLocal ? `${b.firstName} lives in ${cityLabel(b)}` : `${b.firstName} is also new to ${cityLabel(b)}`,
      detail: bLocal
        ? `A local who knows ${cityLabel(b)} — right where you are.`
        : 'You can figure out the city together.',
    });
  }

  // Local knowledge only counts in the city you're actually exploring.
  const PLACE_BOUND = new Set(['local', 'local-friend', 'show-around']);
  const theyGive = strongHits(a.seeks, bPool).filter((h) => cityMatch || !PLACE_BOUND.has(h.by));
  const youGive = strongHits(b.seeks, aPool);
  const detected = theyGive.length > 0 && youGive.length > 0;
  if (youGive[0]) {
    reasons.push({
      kind: 'mutual',
      emoji: '🤝',
      title: `${b.firstName} wants to ${seekPhrase(youGive[0].want)}`,
      detail: b.lookingFor ? `In their words: “${b.lookingFor}”` : `${b.firstName} is actively looking in Explore right now.`,
    });
  }
  reasons.push(...sharedReasons(shared.pairs, b));
  if (sharedLanguage && language >= 0.85) {
    reasons.push({
      kind: 'language',
      emoji: '🗣️',
      title: `You can both talk in ${conceptLabel(sharedLanguage)}`,
      detail: 'No language barrier to getting started.',
    });
  }
  const availReason = availabilityReason(overlap, avail);
  if (availReason) reasons.push(availReason);

  let cap: number | undefined;
  if (a.city && !cityMatch) {
    cap = 0.5;
    caveats.push(`${b.firstName} will be in ${b.city ? cityLabel(b) : 'a different city'}, not ${cityLabel(a)}.`);
  }
  if (language < 0.4) caveats.push('You may not share a common language yet.');
  if (avail < 0.4) caveats.push('Your free time doesn’t overlap much.');

  const mutualIntent: MutualIntent = {
    detected,
    youWant: a.intent?.summary || (a.seeks.length ? `To ${seekPhrase(a.seeks[0])}` : 'To explore somewhere new with someone'),
    theyWant: b.lookingFor || (b.seeks.length ? `To ${seekPhrase(b.seeks[0])}` : 'Open to meeting new people'),
    summary: detected
      ? `You want to ${seekPhrase(theyGive[0].want)} — ${b.firstName} wants to ${seekPhrase(youGive[0].want)}. You're what each other is looking for.`
      : `${b.firstName} could be a good companion, though you're looking for slightly different things.`,
  };

  return {
    scores: { location, mutual_intent: mutual, shared_interests: shared.score, availability: avail, language },
    reasons,
    caveats,
    sharedInterests: sharedTags(shared.pairs),
    youOffer: youGive.map((h) => toTag(h.by)),
    theyOffer: theyGive.map((h) => toTag(h.by)),
    mutualIntent,
    cap,
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Score how well `b` fits `a` for a's current mode and intent.
 * Final score = Σ weight(mode, dim) × score(dim), halved when a hard
 * requirement (e.g. being in the city you asked for) isn't met, reported as
 * an integer 1–99.
 */
export function scoreMatch(a: Side, b: Side): MatchResult {
  const mode = a.mode;
  const result = mode === 'connect' ? scoreConnect(a, b) : mode === 'learn' ? scoreLearn(a, b) : scoreExplore(a, b);

  const dimensions: DimensionScore[] = MODE_DIMENSIONS[mode].map((d) => ({
    key: d.key,
    label: d.label,
    weight: d.weight,
    score: Math.round(clamp01(result.scores[d.key] ?? 0) * 100) / 100,
  }));
  let total = MODE_DIMENSIONS[mode].reduce((sum, d) => sum + d.weight * clamp01(result.scores[d.key] ?? 0), 0);
  if (result.cap !== undefined) total *= result.cap;

  return {
    candidateId: b.profile.id,
    mode,
    score: Math.max(1, Math.min(99, Math.round(total * 100))),
    dimensions,
    reasons: result.reasons.slice(0, 5),
    caveats: result.caveats.slice(0, 2),
    sharedInterests: result.sharedInterests,
    youOffer: result.youOffer,
    theyOffer: result.theyOffer,
    mutualIntent: result.mutualIntent,
    availabilityOverlap: availabilityOverlap(a.availability, b.availability),
  };
}
