// Deterministic writers: Partner DNA sections, match narratives and Connection
// Bridges built only from real profile data. Used as-is when AI is off, and as
// the grounded fact sheet the model is allowed to rephrase when it's on.

import type {
  ConceptTag,
  ConnectionBridge,
  DnaSection,
  MatchNarrative,
  MatchResult,
  Mode,
  ModeProfile,
  Profile,
} from '../../shared/types';
import {
  GROUP_SIZE_LABELS,
  LANGUAGE_LEVEL_LABELS,
  ROLE_LABELS,
  SETTING_LABELS,
  TIME_SLOT_LABELS,
  listToSentence,
} from '../../shared/labels';
import { CONCEPT_BY_ID } from '../semantic/ontology';
import { canonicalize, conceptLabel } from '../semantic/similarity';

function uniqueLabels(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const label = conceptLabel(canonicalize(item)) || item;
    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(label);
    }
  }
  return out;
}

// ─── Partner DNA ───────────────────────────────────────────────────────────

export function buildDnaSections(profile: Profile, modeProfiles: ModeProfile[]): DnaSection[] {
  const learn = modeProfiles.find((m) => m.details.kind === 'learn')?.details;
  const explore = modeProfiles.find((m) => m.details.kind === 'explore')?.details;
  const activities = modeProfiles.flatMap((m) => (m.details.kind === 'learn' ? [] : m.details.activities));

  const strengths = uniqueLabels([...(learn?.kind === 'learn' ? learn.strengths : []), ...profile.skills]);
  const needs = uniqueLabels(learn?.kind === 'learn' ? learn.needs : []);
  const social = [
    ...profile.groupSizes.map((g) => GROUP_SIZE_LABELS[g]),
    SETTING_LABELS[profile.setting],
    ...(explore?.kind === 'explore' ? [ROLE_LABELS[explore.role]] : []),
  ];
  const lookingFor = uniqueLabels(modeProfiles.filter((m) => m.active).flatMap((m) => m.seeks)).slice(0, 5);

  const sections: DnaSection[] = [
    { key: 'interests', label: 'Interests', items: uniqueLabels([...profile.interests, ...activities]).slice(0, 8) },
    { key: 'strengths', label: 'Strengths', items: strengths.slice(0, 6) },
    { key: 'learningNeeds', label: 'Learning needs', items: needs.slice(0, 5) },
    {
      key: 'languages',
      label: 'Languages',
      items: profile.languages.map((l) => (l.level === 'native' || l.level === 'fluent' ? l.language : `${l.language} (${LANGUAGE_LEVEL_LABELS[l.level].toLowerCase()})`)),
    },
    { key: 'socialStyle', label: 'Social style', items: social },
    { key: 'availability', label: 'Availability', items: profile.availability.map((s) => TIME_SLOT_LABELS[s]) },
    { key: 'lookingFor', label: 'Looking for', items: lookingFor },
  ];
  return sections.filter((s) => s.items.length > 0);
}

const ARCHETYPES: Array<{ word: string; test: (cat: string, id: string) => boolean }> = [
  { word: 'Builder', test: (cat) => cat === 'tech' },
  { word: 'Explorer', test: (cat, id) => cat === 'explore' || id === 'travel' || cat === 'outdoors' },
  { word: 'Gamer', test: (cat) => cat === 'game' },
  { word: 'Creative', test: (cat) => cat === 'creative' || cat === 'music' },
  { word: 'Athlete', test: (cat) => cat === 'sport' },
  { word: 'Foodie', test: (cat) => cat === 'food' },
  { word: 'Thinker', test: (cat) => cat === 'math' || cat === 'science' || cat === 'humanities' },
];

export function fallbackDnaHeadline(profile: Profile, modeProfiles: ModeProfile[]): string {
  const terms = [...profile.interests, ...profile.skills, ...modeProfiles.flatMap((m) => (m.details.kind === 'learn' ? m.details.strengths : m.details.activities))];
  const counts = new Map<string, number>();
  for (const term of terms) {
    const id = canonicalize(term);
    const cat = CONCEPT_BY_ID.get(id)?.category ?? '';
    for (const a of ARCHETYPES) if (a.test(cat, id)) counts.set(a.word, (counts.get(a.word) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w);
  return top.length ? top.join(' · ') : 'Connector';
}

export function fallbackDnaSummary(profile: Profile, sections: DnaSection[]): string {
  const get = (key: DnaSection['key']) => sections.find((s) => s.key === key)?.items ?? [];
  const first = profile.displayName.split(' ')[0];
  const parts = [`${first} is into ${listToSentence(get('interests').slice(0, 3).map((s) => s.toLowerCase())) || 'meeting new people'}`];
  const strengths = get('strengths');
  if (strengths.length) parts.push(`brings ${listToSentence(strengths.slice(0, 2))}`);
  const avail = get('availability');
  if (avail.length) parts.push(`is usually free ${listToSentence(avail.slice(0, 2).map((s) => s.toLowerCase()))}`);
  return `${parts.join(', ')}.`;
}

// ─── Match narrative ───────────────────────────────────────────────────────

const IDEAS_BY_CONCEPT: Record<string, string> = {
  valorant: 'Queue up a few Valorant games one night this week',
  'formula-1': 'Watch the next F1 race together',
  soccer: 'Join a pickup soccer game',
  photography: 'Go on a photo walk around the city',
  food: 'Try a restaurant neither of you has been to',
  markets: 'Explore a local market together',
  music: 'Swap playlists, then catch a live show',
  jazz: 'Catch a live jazz set',
  hiking: 'Take a weekend hike',
  coffee: 'Grab coffee somewhere new',
  'explore-city': 'Pick a neighborhood neither of you knows well and wander',
  museums: 'Spend an afternoon at a museum',
  anime: 'Start a new anime series together',
  robotics: 'Tinker on a small robotics build together',
  'video-games': 'Find a co-op game to play together',
};

function ideaFor(tag: ConceptTag): string {
  const concept = CONCEPT_BY_ID.get(tag.id);
  if (IDEAS_BY_CONCEPT[tag.id]) return IDEAS_BY_CONCEPT[tag.id];
  if (concept?.category === 'game') return `Play a few rounds of ${tag.label} together`;
  if (concept?.category === 'sport') return `Catch a ${tag.label} game together`;
  return `Bond over ${tag.label.toLowerCase()}`;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** A short, factual summary assembled only from the engine's reasons. */
function fallbackSummary(match: MatchResult, name: string, mode: Mode): string {
  const sentences: string[] = [];
  const shared = match.sharedInterests.slice(0, 2).map((t) => t.label);
  if (mode === 'learn' && match.theyOffer[0] && match.youOffer[0]) {
    sentences.push(`${name} can help you with ${match.theyOffer[0].label}, and you can help ${name} with ${match.youOffer[0].label}.`);
  } else if (mode === 'explore') {
    const place = match.reasons.find((r) => r.kind === 'location');
    if (place) sentences.push(`${place.title}${shared.length ? `, and you share ${listToSentence(shared.map((s) => s.toLowerCase()))}` : ''}.`);
  } else if (shared.length) {
    sentences.push(`You and ${name} share ${listToSentence(shared)}.`);
  }
  const mutual = match.reasons.find((r) => r.kind === 'mutual');
  if (match.mutualIntent?.detected && mutual) {
    sentences.push(mode === 'learn' ? 'Neither of you is just “the tutor” — it’s a two-way exchange.' : `It’s two-way: ${lowerFirst(mutual.title)}.`);
  }
  const avail = match.reasons.find((r) => r.kind === 'availability');
  if (avail) sentences.push(`${avail.title}, so it’s easy to actually meet.`);
  if (sentences.length === 0) {
    const top = match.reasons.slice(0, 2).map((r) => lowerFirst(r.title));
    return top.length ? `You and ${name} line up on a few things: ${listToSentence(top)}.` : `You and ${name} have some overlap worth exploring.`;
  }
  return sentences.slice(0, 3).join(' ');
}

export function fallbackNarrative(match: MatchResult, partnerFirstName: string, mode: Mode): MatchNarrative {
  const summary = fallbackSummary(match, partnerFirstName, mode);

  const ideas: string[] = [];
  if (mode === 'learn' && match.youOffer[0] && match.theyOffer[0]) {
    ideas.push(`Trade sessions: ${partnerFirstName} walks you through ${match.theyOffer[0].label}, you walk them through ${match.youOffer[0].label}`);
    ideas.push('Work through a practice set together before the next exam');
  }
  for (const tag of [...match.sharedInterests, ...match.theyOffer]) {
    const idea = ideaFor(tag);
    if (!ideas.includes(idea) && !idea.startsWith('Bond over')) ideas.push(idea);
    if (ideas.length >= 3) break;
  }
  if (ideas.length === 0) ideas.push('Start with a quick 20-minute call to see if you click');
  return { summary, ideas: ideas.slice(0, 3), source: 'local' };
}

// ─── Connection Bridge ─────────────────────────────────────────────────────

const STARTERS_BY_CONCEPT: Record<string, string> = {
  valorant: 'You both play Valorant — who do you main, and what rank are you chasing this act?',
  'formula-1': 'You both follow F1 — who’s your team this season, and who’s winning the next race?',
  soccer: 'You both love soccer — do you play, watch, or both? Which club?',
  photography: 'You’re both into photography — what’s the best shot you’ve taken recently?',
  food: 'You both love food — what’s the one dish everyone should try?',
  music: 'You both love music — what have you had on repeat lately?',
  robotics: 'You both mentioned robotics — what’s the coolest thing you’ve built so far?',
  hiking: 'You both hike — what’s the best trail you’ve done?',
  anime: 'You both watch anime — what should the other person start next?',
};

export function fallbackBridge(match: MatchResult, partnerFirstName: string, mode: Mode): ConnectionBridge {
  const common = match.sharedInterests.slice(0, 4);
  const starters: string[] = [];
  let firstStep: string;
  let exchange: ConnectionBridge['exchange'] = null;

  if (mode === 'learn' && match.youOffer.length && match.theyOffer.length) {
    exchange = { youOffer: match.youOffer.map((t) => t.label), theyOffer: match.theyOffer.map((t) => t.label) };
    starters.push(
      `${partnerFirstName} can help you with ${match.theyOffer[0].label}, while you help with ${match.youOffer[0].label}. Start by choosing one topic each.`,
      `What’s the one ${match.theyOffer[0].label} concept that’s tripping you up right now?`,
    );
    firstStep = 'Pick one topic each and set up a 45-minute session this week.';
  } else if (mode === 'explore') {
    const labels = common.slice(0, 2).map((t) => t.label.toLowerCase());
    if (labels.length) starters.push(`You both mentioned ${listToSentence(labels)}. Consider exploring a local market together.`);
    starters.push(`Ask ${partnerFirstName}: what’s one place in the city you think everyone should see first?`);
    firstStep = 'Suggest a daytime meetup in a public place for your first hangout.';
  } else {
    firstStep = 'Say hi and suggest one specific thing to do together this week.';
  }

  for (const tag of common) {
    const starter = STARTERS_BY_CONCEPT[tag.id];
    if (starter && !starters.includes(starter)) starters.push(starter);
    if (starters.length >= 3) break;
  }
  if (starters.length === 0 && common[0]) starters.push(`You both mentioned ${common[0].label}. What got you into it?`);
  if (starters.length === 0) starters.push(`What made you decide to try Partner Up, ${partnerFirstName}?`);

  return { common, exchange, starters: starters.slice(0, 3), firstStep, source: 'local' };
}
