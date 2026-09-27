import type {
  AppNotification,
  ConnectionBridge,
  ContactMethod,
  FeedbackValue,
  MatchResult,
  Mode,
  ModeProfile,
  NotificationType,
  PartnerDNA,
  PartnerIntent,
  Profile,
  ProfileInput,
} from '../../shared/types';
import type { Candidate } from '../matching/recommend';

export type RequestStatusRecord = 'pending' | 'matched' | 'withdrawn' | 'expired';

export interface PartnerRequestRecord {
  id: string;
  requesterId: string;
  targetId: string;
  mode: Mode;
  score: number;
  intentText: string | null;
  status: RequestStatusRecord;
  createdAt: string;
  expiresAt: string;
}

export interface MatchRecord {
  id: string;
  /** Always stored with userA < userB. */
  userA: string;
  userB: string;
  mode: Mode;
  score: number;
  /** Engine output from userA's perspective at match time (audit/explainability). */
  explanation: MatchResult | null;
  /** Connection Bridges are written per viewer ("you" differs). */
  bridges: Record<string, ConnectionBridge>;
  matchedAt: string;
  active: boolean;
  endedBy: string | null;
}

export interface StudyGroupRecord {
  id: string;
  creatorId: string;
  subjects: string[];
  memberIds: string[];
  complementarity: number;
  createdAt: string;
}

export interface NewNotification {
  profileId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
}

/** SQLite-backed working state. Authorization is enforced by server services. */
export interface DataStore {
  readonly kind: 'sqlite';

  getProfileByUserId(userId: string): Promise<Profile | null>;
  getProfile(id: string): Promise<Profile | null>;
  getProfiles(ids: string[]): Promise<Profile[]>;
  createProfile(userId: string, input: ProfileInput): Promise<Profile>;
  updateProfile(id: string, input: Partial<ProfileInput>): Promise<Profile>;
  /** Deletes the profile and everything that references it. */
  deleteProfile(id: string): Promise<void>;

  listModeProfiles(profileId: string): Promise<ModeProfile[]>;
  upsertModeProfile(modeProfile: ModeProfile): Promise<ModeProfile>;
  listActiveCandidates(mode: Mode): Promise<Candidate[]>;

  getDna(profileId: string): Promise<PartnerDNA | null>;
  saveDna(dna: PartnerDNA): Promise<void>;

  listContacts(profileId: string): Promise<ContactMethod[]>;
  replaceContacts(profileId: string, contacts: ContactMethod[]): Promise<void>;

  findOpenRequest(requesterId: string, targetId: string, mode: Mode): Promise<PartnerRequestRecord | null>;
  createRequest(request: Omit<PartnerRequestRecord, 'id'>): Promise<PartnerRequestRecord>;
  updateRequestStatus(id: string, status: RequestStatusRecord): Promise<void>;
  listRequestsFrom(requesterId: string): Promise<PartnerRequestRecord[]>;
  listPendingTo(targetId: string): Promise<PartnerRequestRecord[]>;

  createMatch(match: Omit<MatchRecord, 'id'>): Promise<MatchRecord>;
  getMatch(id: string): Promise<MatchRecord | null>;
  findActiveMatch(a: string, b: string, mode: Mode): Promise<MatchRecord | null>;
  listMatchesFor(profileId: string): Promise<MatchRecord[]>;
  updateMatch(id: string, patch: Partial<Pick<MatchRecord, 'active' | 'endedBy' | 'bridges'>>): Promise<void>;

  saveIntent(profileId: string, mode: Mode, rawText: string, parsed: PartnerIntent): Promise<void>;
  saveFeedback(profileId: string, targetId: string, mode: Mode, value: FeedbackValue): Promise<void>;

  saveStudyGroup(group: Omit<StudyGroupRecord, 'id' | 'createdAt'>): Promise<StudyGroupRecord>;

  addNotification(notification: NewNotification): Promise<void>;
  listNotifications(profileId: string): Promise<AppNotification[]>;
  markNotificationsRead(profileId: string): Promise<void>;

  /** Demo only: clear the demo account's requests/matches so the demo can be rerun. */
  resetDemoState(profileId: string): Promise<void>;
}

export function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
