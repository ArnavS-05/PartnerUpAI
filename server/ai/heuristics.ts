// Deterministic language understanding. This is Partner AI's offline brain:
// used when no model is configured, when the model times out, and as a
// safety net for the live demo. It is intentionally conservative — it only
// extracts things that are literally present in the text.

import type {
  ExploreRole,
  GroupPreference,
  LanguageSkill,
  Mode,
  ModeProfileInput,
  PartnerIntent,
  ProfileDraft,
  ProfileInput,
  Setting,
  TimeSlot,
} from '../../shared/types';
import { listToSentence, TIME_SLOT_LABELS } from '../../shared/labels';
import { CONCEPT_BY_ID, type ConceptCategory } from '../semantic/ontology';
import { conceptLabel, extractConcepts, normalizeText } from '../semantic/similarity';

const SUBJECT_CATEGORIES = new Set<ConceptCategory>(['math', 'science', 'tech', 'humanities', 'language']);
const INTEREST_CATEGORIES = new Set<ConceptCategory>([
  'game', 'sport', 'music', 'creative', 'food', 'outdoors', 'lifestyle', 'tech',
]);
const EXPLORE_ACTIVITY_IDS = new Set(['museums', 'nightlife', 'festivals', 'markets', 'parks', 'explore-city']);
const EXPLORE_SEEK_IDS = new Set(['local-friend', 'show-around', 'explore-city', 'cultural-exchange', 'meet-internationals', 'make-friends']);
const ROLE_CONCEPTS = new Set(['international-student', 'newcomer', 'traveler', 'local']);

const KNOWN_CITIES = [
  'atlanta', 'tokyo', 'kyoto', 'osaka', 'new york', 'paris', 'london', 'seoul', 'chicago', 'boston', 'mexico city',
  'san francisco', 'los angeles', 'barcelona', 'madrid', 'berlin', 'mumbai', 'delhi', 'bangalore', 'toronto', 'austin',
  'seattle', 'lisbon', 'sao paulo', 'rome', 'singapore', 'dubai', 'sydney', 'bogota', 'lagos', 'nairobi', 'miami',
];

const OFFER_CUES = [
  'good at', 'strong in', 'strong at', 'great at', 'i know', 'i can help', 'i can teach', 'i teach', 'fluent',
  'native', 'i speak', 'i am good', "i'm good", 'im good', 'experienced', 'familiar with', 'i tutor', 'comfortable with',
  'i ace', 'my strength', 'lived here', 'grew up',
];
const NEED_CUES = [
  'struggling', 'struggle', 'need help', 'help with', 'bad at', 'weak in', 'weak at', 'not good at', 'want to learn',
  'trying to learn', 'learning', 'practice', 'improve', 'confused', 'failing', 'behind in', 'need someone who knows',
  'looking for someone who knows', 'hard time',
];

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function clauses(text: string): string[] {
  return text.split(/[.;!?,]|\bbut\b|\bwhile\b|\balthough\b|\bthough\b|\bhowever\b/i)
    .map((c) => normalizeText(c).trim())
    .filter(Boolean);
}

function category(id: string): ConceptCategory | undefined {
  return CONCEPT_BY_ID.get(id)?.category;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

// ─── Individual extractors ─────────────────────────────────────────────────

export function detectAvailability(text: string): TimeSlot[] {
  const t = normalizeText(text);
  const slots: TimeSlot[] = [];
  if (/\b(night|nights|tonight|late|nighttime|night owl)\b/.test(t)) slots.push('evenings', 'late_nights');
  if (/\b(evening|evenings|after class|after classes|after work|weeknights?)\b/.test(t)) slots.push('evenings');
  if (/\b(morning|mornings|early)\b/.test(t)) slots.push('mornings');
  if (/\b(afternoon|afternoons)\b/.test(t)) slots.push('afternoons');
  if (/\b(weekend|weekends|saturday|saturdays|sunday|sundays)\b/.test(t)) slots.push('weekends');
  if (/\b(weekday|weekdays|weeknight|weeknights)\b/.test(t)) slots.push('weekdays');
  return unique(slots);
}

export function detectSetting(text: string): Setting | null {
  const t = normalizeText(text);
  const online = /\b(online|discord|remote|remotely|virtual|virtually|voice chat)\b/.test(t);
  const inPerson = /\b(in person|in-person|irl|meet up|meetup|on campus|hang out in person)\b/.test(t);
  if (online && inPerson) return 'either';
  if (online) return 'online';
  if (inPerson) return 'in_person';
  return null;
}

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

export function detectGroup(text: string): { preference: GroupPreference | null; max: number | null } {
  const t = normalizeText(text);
  const range = t.match(/\b(\d|one|two|three|four|five)\s*(?:or|to|-)\s*(\d|two|three|four|five)\s+(?:people|friends|others|students|partners)/);
  if (range) {
    const hi = NUMBER_WORDS[range[2]] ?? Number(range[2]);
    return { preference: hi >= 2 ? 'group' : 'pair', max: Number.isFinite(hi) ? hi : null };
  }
  const single = t.match(/\b(\d|two|three|four|five)\s+(?:people|friends|others|students)\b/);
  if (single) {
    const n = NUMBER_WORDS[single[1]] ?? Number(single[1]);
    return { preference: n >= 2 ? 'group' : 'pair', max: Number.isFinite(n) ? n : null };
  }
  if (/\b(study group|group|squad|crew|team)\b/.test(t)) return { preference: 'group', max: null };
  if (/\b(someone|a partner|study partner|study buddy|one on one|1 on 1|1:1|a person)\b/.test(t)) return { preference: 'pair', max: 1 };
  return { preference: null, max: null };
}

export function detectCity(text: string): string | null {
  const t = ` ${normalizeText(text)} `;
  for (const city of KNOWN_CITIES) if (t.includes(` ${city} `)) return titleCase(city);
  if (/\batl\b/.test(t)) return 'Atlanta';
  const m = text.match(/\b(?:in|to|visiting|around|explore|exploring|moved to|moving to|live in|living in)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/);
  if (m && !['I', 'The', 'English', 'Spanish'].includes(m[1])) return m[1];
  return null;
}

export function detectRole(text: string): ExploreRole | null {
  const t = normalizeText(text);
  if (/\bexchange student\b/.test(t)) return 'exchange_student';
  if (/\binternational student\b/.test(t)) return 'international_student';
  if (/\b(i'm a local|im a local|i am a local|born and raised|grew up here|lived here|i've lived|ive lived|native atlantan|i live here)\b/.test(t)) return 'local';
  if (/\b(visiting|trip|vacation|traveling to|travelling to|tourist|for a week|for the weekend|backpacking)\b/.test(t)) return 'traveler';
  if (/\b(just moved|moved to|new to|new in town|recently moved|don't know anyone|dont know anyone|newcomer|relocated)\b/.test(t)) return 'newcomer';
  return null;
}

interface LanguageMentions {
  spoken: string[];
  learning: string[];
}

export function detectLanguages(text: string): LanguageMentions {
  const spoken: string[] = [];
  const learning: string[] = [];
  for (const clause of clauses(text)) {
    const langs = extractConcepts(clause).filter((id) => category(id) === 'language');
    if (langs.length === 0) continue;
    if (/\b(learn|learning|practice|practise|improve|study|studying|get better)\b/.test(clause)) learning.push(...langs);
    else if (/\b(speak|native|fluent|mother tongue|grew up speaking|bilingual)\b/.test(clause)) spoken.push(...langs);
  }
  return { spoken: unique(spoken), learning: unique(learning.filter((l) => !spoken.includes(l))) };
}

function splitOffersAndNeeds(text: string): { offers: string[]; needs: string[]; neutral: string[] } {
  const offers: string[] = [];
  const needs: string[] = [];
  const neutral: string[] = [];
  for (const clause of clauses(text)) {
    const subjects = extractConcepts(clause).filter((id) => SUBJECT_CATEGORIES.has(category(id) ?? 'social'));
    if (subjects.length === 0) continue;
    const isNeed = includesAny(clause, NEED_CUES);
    const isOffer = includesAny(clause, OFFER_CUES);
    if (isNeed && !isOffer) needs.push(...subjects);
    else if (isOffer && !isNeed) offers.push(...subjects);
    else neutral.push(...subjects);
  }
  return { offers: unique(offers), needs: unique(needs), neutral: unique(neutral) };
}

// ─── Mode detection ────────────────────────────────────────────────────────

export function detectMode(text: string, hint: Mode | null = null): Mode {
  const t = normalizeText(text);
  const count = (re: RegExp) => (t.match(re) ?? []).length;
  const concepts = extractConcepts(t);
  let learn = count(/\b(study|studying|learn|learning|struggling|tutor|exam|exams|midterm|finals|class|course|homework|good at|strong in|help with|language exchange|practice)\b/g);
  learn += concepts.filter((id) => ['math', 'science'].includes(category(id) ?? '')).length;
  let explore = count(/\b(explore|exploring|visiting|travel|traveling|trip|moved|new to|international student|exchange student|local|city|show me around|tourist|abroad|new in town|sightseeing)\b/g);
  explore += concepts.filter((id) => ROLE_CONCEPTS.has(id) || EXPLORE_SEEK_IDS.has(id)).length * 0.5;
  let connect = count(/\b(play|game|gaming|games|friend|friends|hang out|hangout|watch|concert|discord|chill|duo|squad)\b/g);
  connect += concepts.filter((id) => ['game', 'sport', 'music'].includes(category(id) ?? '')).length * 0.5;
  if (hint === 'learn') learn += 1.5;
  if (hint === 'explore') explore += 1.5;
  if (hint === 'connect') connect += 1.5;
  const best = Math.max(learn, explore, connect);
  if (best === 0) return hint ?? 'connect';
  if (learn === best) return 'learn';
  if (explore === best) return 'explore';
  return 'connect';
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function slotPhrase(slots: TimeSlot[]): string {
  return listToSentence(slots.map((s) => TIME_SLOT_LABELS[s].toLowerCase()));
}

// ─── Intent ────────────────────────────────────────────────────────────────

export function parseIntentLocally(text: string, hint: Mode | null = null): PartnerIntent {
  const mode = detectMode(text, hint);
  const t = normalizeText(text);
  const concepts = extractConcepts(text);
  const availability = detectAvailability(text);
  const group = detectGroup(text);
  const setting = detectSetting(text);
  const languages = detectLanguages(text);
  const followUps: string[] = [];

  let seeks: string[];
  let offers: string[] = [];
  let interests: string[] = [];
  let role: ExploreRole | null = null;
  let location: string | null = null;
  let summary: string;

  if (mode === 'learn') {
    const split = splitOffersAndNeeds(text);
    const langNeeds = languages.learning;
    seeks = unique([...split.needs.filter((id) => category(id) !== 'language'), ...langNeeds]);
    offers = unique([...split.offers.filter((id) => category(id) !== 'language' || languages.spoken.includes(id)), ...languages.spoken]);
    if (seeks.length === 0 && split.neutral.length > 0) seeks = split.neutral.filter((id) => !offers.includes(id));
    if (t.includes('language exchange') && langNeeds.length === 0) seeks.push('language-exchange');
    if (seeks.length === 0) followUps.push('What subject or skill do you want help with?');
    if (offers.length === 0 && seeks.length > 0) followUps.push('What are you strong in? (so we can find a two-way match)');
    const parts = [
      seeks.length ? `Help with ${listToSentence(seeks.map(conceptLabel))}` : 'A study partner',
      offers.length ? `you can offer ${listToSentence(offers.map(conceptLabel))}` : '',
    ].filter(Boolean);
    summary = parts.join(' — ');
  } else if (mode === 'explore') {
    role = detectRole(text);
    location = detectCity(text);
    seeks = concepts.filter((id) => EXPLORE_SEEK_IDS.has(id));
    interests = concepts.filter(
      (id) => (INTEREST_CATEGORIES.has(category(id) ?? 'social') || EXPLORE_ACTIVITY_IDS.has(id)) && !EXPLORE_SEEK_IDS.has(id),
    );
    if (role === 'local') {
      offers = ['show-around', 'local-friend'];
      if (seeks.length === 0) seeks = ['meet-internationals'];
    } else {
      if (role === 'international_student' || role === 'exchange_student') offers = ['cultural-exchange'];
      if (seeks.length === 0) seeks = ['local-friend', 'explore-city'];
    }
    if (!location) followUps.push('Which city are you in, or heading to?');
    const where = location ?? 'the city';
    summary =
      role === 'local'
        ? `Meet newcomers and show them around ${where}`
        : seeks.includes('local-friend')
          ? `A local to explore ${where} with`
          : `Someone to explore ${where} with`;
    if (interests.length) summary += ` — into ${listToSentence(interests.slice(0, 3).map(conceptLabel).map((l) => l.toLowerCase()))}`;
  } else {
    seeks = concepts.filter((id) => category(id) === 'social');
    interests = concepts.filter((id) => INTEREST_CATEGORIES.has(category(id) ?? 'social') || EXPLORE_ACTIVITY_IDS.has(id));
    const mentionsGame = interests.some((id) => category(id) === 'game');
    if (!seeks.includes('gaming-buddy') && mentionsGame && /\b(play|game|gaming|duo|squad|queue|ranked)\b/.test(t)) {
      seeks.unshift('gaming-buddy');
    }
    if (/\bwatch\b/.test(t) && !seeks.includes('watch-party') && interests.some((id) => category(id) === 'sport')) {
      seeks.push('watch-party');
    }
    if (seeks.length === 0) seeks = ['make-friends'];
    if (interests.length === 0 && seeks[0] === 'make-friends') followUps.push('What would you like to do together?');
    const who = seeks.includes('gaming-buddy')
      ? `Someone to play ${interests.filter((id) => category(id) === 'game').map(conceptLabel)[0] ?? 'games'} with`
      : 'New friends';
    const others = interests.filter((id) => category(id) !== 'game').map(conceptLabel);
    summary = who + (others.length ? ` who's into ${listToSentence(others.slice(0, 2))}` : '');
  }

  if (availability.includes('late_nights')) {
    const rest = availability.filter((s) => s !== 'late_nights' && s !== 'evenings');
    summary += rest.length ? `, at night and ${slotPhrase(rest)}` : ', at night';
  } else if (availability.length) {
    summary += `, ${slotPhrase(availability)}`;
  }

  return {
    mode,
    summary: summary.charAt(0).toUpperCase() + summary.slice(1),
    seeks: unique(seeks),
    offers: unique(offers),
    interests: unique(interests),
    availability,
    groupPreference: group.preference,
    groupSizeMax: group.max,
    setting,
    location,
    role,
    languagesSpoken: languages.spoken,
    languagesLearning: languages.learning,
    followUps: followUps.slice(0, 2),
    source: 'local',
  };
}

// ─── Profile drafting (natural-language onboarding) ────────────────────────

export function draftProfileLocally(text: string, mode: Mode): ProfileDraft {
  const concepts = extractConcepts(text);
  const langs = detectLanguages(text);
  const interests = concepts.filter((id) => INTEREST_CATEGORIES.has(category(id) ?? 'social')).map(conceptLabel);
  const stated = splitOffersAndNeeds(text);
  const skills = stated.offers.map(conceptLabel);
  const languages: LanguageSkill[] = [
    ...langs.spoken.map((id) => ({ language: conceptLabel(id), level: 'fluent' as const })),
    ...langs.learning.map((id) => ({ language: conceptLabel(id), level: 'learning' as const })),
  ];

  const communityMatch = text.match(/\b(?:at|attend|attending|go to|study at|student at)\s+((?:Georgia Tech|[A-Z][\w&]*(?:\s[A-Z][\w&]*){0,3}\s(?:University|College|Institute)|University of [A-Z][\w]*(?:\s[A-Z][\w]*)?))/);
  const ageMatch = text.match(/\b(?:i'm|i am|im)\s(\d{2})\b|\b(\d{2})\s?(?:years old|yo|y\/o)\b/i);
  const age = ageMatch ? Number(ageMatch[1] ?? ageMatch[2]) : null;

  const profile: Partial<ProfileInput> = {
    bio: text.trim().slice(0, 280),
    interests,
    skills,
    languages,
    availability: detectAvailability(text),
    ...(communityMatch ? { community: communityMatch[1] } : {}),
    ...(age && age >= 13 && age < 100 ? { age } : {}),
  };
  const setting = detectSetting(text);
  if (setting) profile.setting = setting;
  const city = detectCity(text);
  if (city) profile.city = city;

  const intent = parseIntentLocally(text, mode);
  let modeProfile: Partial<ModeProfileInput>;
  if (mode === 'learn') {
    const split = splitOffersAndNeeds(text);
    modeProfile = {
      lookingFor: intent.summary,
      seeks: intent.seeks.map(conceptLabel),
      offers: intent.offers.map(conceptLabel),
      details: {
        kind: 'learn',
        strengths: split.offers.filter((id) => category(id) !== 'language').map(conceptLabel),
        needs: split.needs.filter((id) => category(id) !== 'language').map(conceptLabel),
        courses: unique(text.match(/\b[A-Z]{2,4}\s?\d{4}\b/g) ?? []),
        studyStyles: [],
        groupPreference: intent.groupPreference ?? 'either',
      },
    };
  } else if (mode === 'explore') {
    modeProfile = {
      lookingFor: intent.summary,
      seeks: intent.seeks.map(conceptLabel),
      offers: intent.offers.map(conceptLabel),
      details: {
        kind: 'explore',
        role: intent.role ?? 'newcomer',
        exploringCity: intent.location,
        origin: null,
        activities: intent.interests.map(conceptLabel),
      },
    };
  } else {
    modeProfile = {
      lookingFor: intent.summary,
      seeks: intent.seeks.map(conceptLabel),
      offers: [],
      details: { kind: 'connect', activities: intent.interests.map(conceptLabel) },
    };
  }
  return { profile, modeProfile, learning: stated.needs.map(conceptLabel), goals: [], source: 'local' };
}
