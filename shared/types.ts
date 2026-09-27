// Shared domain types — the contract between the React app, the API and the
// matching engine. Keep this file free of runtime dependencies.

export const MODES = ['connect', 'learn', 'explore'] as const;
export type Mode = (typeof MODES)[number];

export const TIME_SLOTS = ['mornings', 'afternoons', 'evenings', 'late_nights', 'weekdays', 'weekends'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export const GROUP_SIZES = ['one_on_one', 'small_group', 'large_group'] as const;
export type GroupSize = (typeof GROUP_SIZES)[number];

export const SETTINGS = ['online', 'in_person', 'either'] as const;
export type Setting = (typeof SETTINGS)[number];

export const LANGUAGE_LEVELS = ['native', 'fluent', 'conversational', 'learning'] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export interface LanguageSkill {
  language: string;
  level: LanguageLevel;
}

export const EXPLORE_ROLES = ['local', 'traveler', 'international_student', 'exchange_student', 'newcomer'] as const;
export type ExploreRole = (typeof EXPLORE_ROLES)[number];

export const STUDY_STYLES = ['quiet_focus', 'discussion', 'practice_problems', 'teach_back'] as const;
export type StudyStyle = (typeof STUDY_STYLES)[number];

export const GROUP_PREFERENCES = ['pair', 'group', 'either'] as const;
export type GroupPreference = (typeof GROUP_PREFERENCES)[number];

export interface ProfileVisibility {
  age: boolean;
  community: boolean;
  pronouns: boolean;
}

/** Universal Partner Profile (one per person). */
export interface Profile {
  id: string;
  displayName: string;
  age: number | null;
  pronouns: string | null;
  community: string | null;
  city: string | null;
  bio: string;
  interests: string[];
  skills: string[];
  languages: LanguageSkill[];
  availability: TimeSlot[];
  groupSizes: GroupSize[];
  setting: Setting;
  visibility: ProfileVisibility;
  avatarHue: number;
  isDemoPersona: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProfileInput = Omit<Profile, 'id' | 'isDemoPersona' | 'createdAt' | 'updatedAt' | 'avatarHue'>;

export interface ConnectDetails {
  kind: 'connect';
  activities: string[];
}

export interface LearnDetails {
  kind: 'learn';
  strengths: string[];
  needs: string[];
  courses: string[];
  studyStyles: StudyStyle[];
  groupPreference: GroupPreference;
}

export interface ExploreDetails {
  kind: 'explore';
  role: ExploreRole;
  /** Where they are / will be exploring (for locals: their home city). */
  exploringCity: string | null;
  /** Optional, voluntarily shared home country/culture. Never inferred. */
  origin: string | null;
  activities: string[];
}

export type ModeDetails = ConnectDetails | LearnDetails | ExploreDetails;

/** Mode-specific survey answers: what someone offers & seeks in one mode. */
export interface ModeProfile {
  profileId: string;
  mode: Mode;
  lookingFor: string;
  seeks: string[];
  offers: string[];
  details: ModeDetails;
  active: boolean;
  updatedAt: string;
}

export type ModeProfileInput = Pick<ModeProfile, 'lookingFor' | 'seeks' | 'offers' | 'details'>;

// ─── Partner DNA ────────────────────────────────────────────────────────────

export type DnaSectionKey =
  | 'interests'
  | 'strengths'
  | 'learningNeeds'
  | 'languages'
  | 'socialStyle'
  | 'availability'
  | 'lookingFor';

export interface DnaSection {
  key: DnaSectionKey;
  label: string;
  items: string[];
}

export interface PartnerDNA {
  profileId: string;
  headline: string;
  summary: string;
  sections: DnaSection[];
  source: 'ai' | 'local';
  updatedAt: string;
}

// ─── Intent ────────────────────────────────────────────────────────────────

export interface PartnerIntent {
  mode: Mode;
  /** One-line restatement of what the person wants. */
  summary: string;
  /** What they need from a partner (skills, subjects, kinds of people). */
  seeks: string[];
  /** What they bring. */
  offers: string[];
  /** Activities / topics they want to share. */
  interests: string[];
  availability: TimeSlot[];
  groupPreference: GroupPreference | null;
  groupSizeMax: number | null;
  setting: Setting | null;
  location: string | null;
  role: ExploreRole | null;
  languagesSpoken: string[];
  languagesLearning: string[];
  /** Up to two short questions if something critical is missing. */
  followUps: string[];
  source: 'ai' | 'local';
}

// ─── Matching ──────────────────────────────────────────────────────────────

export interface DimensionScore {
  key: string;
  label: string;
  /** Weight in this mode, 0..1 (all weights in a mode sum to 1). */
  weight: number;
  /** Normalised dimension score, 0..1. */
  score: number;
}

export type ReasonKind =
  | 'shared'
  | 'complement'
  | 'mutual'
  | 'availability'
  | 'location'
  | 'language'
  | 'social'
  | 'learning';

export interface MatchReason {
  kind: ReasonKind;
  emoji: string;
  title: string;
  detail: string;
}

export interface MatchResult {
  candidateId: string;
  mode: Mode;
  /** Partner Match score (0–100) from our weighted model — not a probability. */
  score: number;
  dimensions: DimensionScore[];
  reasons: MatchReason[];
  caveats: string[];
  sharedInterests: ConceptTag[];
  youOffer: ConceptTag[];
  theyOffer: ConceptTag[];
  mutualIntent: MutualIntent | null;
  availabilityOverlap: TimeSlot[];
}

export interface ConceptTag {
  id: string;
  label: string;
  emoji: string;
}

export interface MutualIntent {
  detected: boolean;
  youWant: string;
  theyWant: string;
  summary: string;
}

/** The only view of another person the API ever returns before a mutual match. */
export interface PublicProfile {
  id: string;
  displayName: string;
  age: number | null;
  pronouns: string | null;
  community: string | null;
  city: string | null;
  bio: string;
  interests: string[];
  skills: string[];
  availability: TimeSlot[];
  languages: LanguageSkill[];
  avatarHue: number;
  isDemoPersona: boolean;
}

export type RequestStatus = 'none' | 'pending' | 'mutual';

export interface MatchCard {
  profile: PublicProfile;
  match: MatchResult;
  highlights: ConceptTag[];
  headline: string;
  status: RequestStatus;
}

export interface IntentTags {
  seeks: ConceptTag[];
  offers: ConceptTag[];
  interests: ConceptTag[];
}

export interface DiscoverResponse {
  mode: Mode;
  intent: PartnerIntent | null;
  /** Human labels for the intent's concept ids (what Partner AI understood). */
  intentTags: IntentTags | null;
  results: MatchCard[];
  searchedCount: number;
}

export interface MatchDetail {
  profile: PublicProfile;
  match: MatchResult;
  narrative: MatchNarrative;
  status: RequestStatus;
  partnershipId: string | null;
  lookingFor: string;
}

export interface MatchNarrative {
  summary: string;
  ideas: string[];
  source: 'ai' | 'local';
}

// ─── Partner Up / partnerships ─────────────────────────────────────────────

export const CONTACT_KINDS = ['email', 'instagram', 'discord', 'discord_invite', 'phone', 'other'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

export interface ContactMethod {
  kind: ContactKind;
  value: string;
  shareOnMatch: boolean;
}

export interface PartnerUpResponse {
  status: 'pending' | 'mutual';
  partnershipId: string | null;
}

export interface ConnectionBridge {
  common: ConceptTag[];
  exchange: { youOffer: string[]; theyOffer: string[] } | null;
  starters: string[];
  firstStep: string;
  source: 'ai' | 'local';
}

export interface Partnership {
  id: string;
  mode: Mode;
  score: number;
  matchedAt: string;
  active: boolean;
  partner: PublicProfile;
  partnerContacts: Omit<ContactMethod, 'shareOnMatch'>[];
  bridge: ConnectionBridge | null;
}

export interface SentRequest {
  id: string;
  mode: Mode;
  score: number;
  createdAt: string;
  expiresAt: string;
  target: PublicProfile;
}

export interface MatchesResponse {
  partnerships: Partnership[];
  sent: SentRequest[];
  /** Anonymous count of people who privately chose you (never who). */
  incomingInterest: number;
}

// ─── Study groups (LEARN) ──────────────────────────────────────────────────

export interface SubjectCoverage {
  subject: ConceptTag;
  coverage: number;
  coveredBy: string[];
}

export interface GroupMember {
  profile: PublicProfile;
  isYou: boolean;
  strengths: ConceptTag[];
  needs: ConceptTag[];
  gives: string[];
  gets: string[];
}

export interface StudyGroupSuggestion {
  subjects: ConceptTag[];
  members: GroupMember[];
  coverage: SubjectCoverage[];
  complementarity: number;
  explanation: string;
  missing: SubjectCoverage | null;
}

export interface MissingPartnerSuggestion {
  subject: ConceptTag;
  candidate: GroupMember | null;
  coverageAfter: number;
}

// ─── Me / notifications ────────────────────────────────────────────────────

export type NotificationType = 'mutual_match' | 'interest' | 'request_expired' | 'group_formed';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface MeResponse {
  email: string | null;
  profile: Profile | null;
  modeProfiles: ModeProfile[];
  dna: PartnerDNA | null;
  contacts: ContactMethod[];
  isDemoAccount: boolean;
}

export interface AppConfig {
  authMode: 'local';
  dataMode: 'sqlite';
  aiEnabled: boolean;
  demoAvailable: boolean;
  demoOnly?: boolean;
}

export interface ProfileDraft {
  learning?: string[];
  goals?: string[];
  profile: Partial<ProfileInput>;
  modeProfile: Partial<ModeProfileInput>;
  source: 'ai' | 'local';
}

export type FeedbackValue = 'good' | 'not_for_me';

export interface ApiErrorBody {
  error: { code: string; message: string };
}
