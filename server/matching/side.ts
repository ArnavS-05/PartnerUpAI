import type {
  ExploreRole,
  GroupPreference,
  GroupSize,
  LanguageLevel,
  Mode,
  ModeProfile,
  PartnerIntent,
  Profile,
  Setting,
  StudyStyle,
  TimeSlot,
} from '../../shared/types';
import { CONCEPT_BY_ID } from '../semantic/ontology';
import { canonicalize, canonicalizeAll } from '../semantic/similarity';

/**
 * A "side" is one person as seen by the matching engine for one mode:
 * WHO THEY ARE (profile) + WHAT THEY WANT (mode profile, optionally overridden
 * by a live natural-language intent), all canonicalised to concept ids.
 */
export interface Side {
  profile: Profile;
  firstName: string;
  mode: Mode;
  modeProfile: ModeProfile | null;
  intent: PartnerIntent | null;
  lookingFor: string;
  interests: string[];
  focusInterests: string[];
  /** What they want right now (live intent overrides their saved mode profile). */
  seeks: string[];
  /** Everything they said they want — used for what they can *be* to others. */
  allSeeks: string[];
  offers: string[];
  availability: TimeSlot[];
  availabilityRequested: boolean;
  groupSizes: GroupSize[];
  setting: Setting;
  city: string | null;
  community: string | null;
  languages: Array<{ id: string; level: LanguageLevel }>;
  strengths: string[];
  needs: string[];
  courses: string[];
  studyStyles: StudyStyle[];
  groupPreference: GroupPreference;
  role: ExploreRole | null;
  roleTags: string[];
}

const INTENT_CATEGORIES = new Set(['social', 'learning']);

/** Subjects/skills only — drops "study partner"-style intent words. */
function subjectsOnly(ids: string[]): string[] {
  return ids.filter((id) => !INTENT_CATEGORIES.has(CONCEPT_BY_ID.get(id)?.category ?? ''));
}

function union(...lists: string[][]): string[] {
  const out: string[] = [];
  for (const list of lists) for (const item of list) if (item && !out.includes(item)) out.push(item);
  return out;
}

const CITY_ALIASES: Record<string, string> = {
  atl: 'atlanta',
  'atlanta ga': 'atlanta',
  'atlanta georgia': 'atlanta',
  'midtown atlanta': 'atlanta',
  nyc: 'new york',
  'new york city': 'new york',
  sf: 'san francisco',
  'tokyo japan': 'tokyo',
};

export function normalizeCity(city: string | null | undefined): string | null {
  if (!city) return null;
  const key = city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!key) return null;
  return CITY_ALIASES[key] ?? key.replace(/ (ga|georgia|usa|us|japan)$/, '');
}

function normalizeCourse(course: string): string {
  return course.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/([A-Z]+)s*(d+)/, '$1 $2').trim();
}

export function roleTags(role: ExploreRole | null): string[] {
  switch (role) {
    case 'local':
      return ['local', 'local-friend'];
    case 'traveler':
      return ['traveler'];
    case 'international_student':
    case 'exchange_student':
      return ['international-student', 'newcomer'];
    case 'newcomer':
      return ['newcomer'];
    default:
      return [];
  }
}

export function buildSide(profile: Profile, mode: Mode, modeProfile: ModeProfile | null, intent: PartnerIntent | null = null): Side {
  const details = modeProfile?.details;
  const activities = details && details.kind !== 'learn' ? details.activities : [];

  const intentSeeks = canonicalizeAll(intent?.seeks ?? []);
  const intentOffers = canonicalizeAll(intent?.offers ?? []);
  const focusInterests = canonicalizeAll(intent?.interests ?? []);

  const baseInterests = canonicalizeAll([...profile.interests, ...activities]);
  const interests = union(focusInterests, baseInterests);
  const seeks = intentSeeks.length > 0 ? intentSeeks : canonicalizeAll(modeProfile?.seeks ?? []);
  const offers = union(intentOffers, canonicalizeAll(modeProfile?.offers ?? []));

  const languages: Array<{ id: string; level: LanguageLevel }> = [];
  const addLanguage = (name: string, level: LanguageLevel) => {
    const id = canonicalize(name);
    if (!id) return;
    const existing = languages.find((l) => l.id === id);
    if (!existing) languages.push({ id, level });
    else if (level !== 'learning' && existing.level === 'learning') existing.level = level;
  };
  for (const l of profile.languages) addLanguage(l.language, l.level);
  for (const l of intent?.languagesSpoken ?? []) addLanguage(l, 'fluent');
  for (const l of intent?.languagesLearning ?? []) addLanguage(l, 'learning');

  const learning = details?.kind === 'learn' ? details : null;
  const spokenLanguages = languages.filter((l) => l.level === 'native' || l.level === 'fluent').map((l) => l.id);
  const learningLanguages = languages.filter((l) => l.level === 'learning').map((l) => l.id);
  const intentLearningLanguages = canonicalizeAll(intent?.languagesLearning ?? []);

  const strengths = union(subjectsOnly(intentOffers), canonicalizeAll(learning?.strengths ?? []), spokenLanguages);
  const intentNeeds = union(subjectsOnly(intentSeeks), intentLearningLanguages);
  const needs =
    intentNeeds.length > 0 ? intentNeeds : union(canonicalizeAll(learning?.needs ?? []), learningLanguages);

  const explore = details?.kind === 'explore' ? details : null;
  const role = intent?.role ?? explore?.role ?? null;
  const cityRaw = mode === 'explore' ? (intent?.location ?? explore?.exploringCity ?? profile.city) : profile.city;

  return {
    profile,
    firstName: profile.displayName.split(' ')[0] ?? profile.displayName,
    mode,
    modeProfile,
    intent,
    lookingFor: modeProfile?.lookingFor ?? '',
    interests,
    focusInterests,
    seeks,
    allSeeks: union(seeks, canonicalizeAll(modeProfile?.seeks ?? [])),
    offers,
    availability: intent && intent.availability.length > 0 ? intent.availability : profile.availability,
    availabilityRequested: Boolean(intent && intent.availability.length > 0),
    groupSizes: profile.groupSizes,
    setting: intent?.setting ?? profile.setting,
    city: normalizeCity(cityRaw),
    community: profile.community ? profile.community.trim().toLowerCase() : null,
    languages,
    strengths,
    needs,
    courses: (learning?.courses ?? []).map(normalizeCourse).filter(Boolean),
    studyStyles: learning?.studyStyles ?? [],
    groupPreference: intent?.groupPreference ?? learning?.groupPreference ?? 'either',
    role,
    roleTags: roleTags(role),
  };
}
