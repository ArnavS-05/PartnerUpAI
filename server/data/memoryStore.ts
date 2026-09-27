import { randomUUID } from 'node:crypto';
import type {
  AppNotification,
  ContactMethod,
  FeedbackValue,
  Mode,
  ModeProfile,
  PartnerDNA,
  PartnerIntent,
  Profile,
  ProfileInput,
} from '../../shared/types';
import type { Candidate } from '../matching/recommend';
import { seedPersonToModeProfiles, seedPersonToProfile } from './mappers';
import {
  DEMO_EMAIL_DEFAULT,
  DEMO_PERSON,
  DEMO_PROFILE_ID,
  DEMO_USER_ID,
  PERSONAS,
  SEEDED_INCOMING_REQUESTS,
  SEEDED_PARTNERSHIPS,
} from './seed';
import {
  orderPair,
  type DataStore,
  type MatchRecord,
  type NewNotification,
  type PartnerRequestRecord,
  type RequestStatusRecord,
  type StudyGroupRecord,
} from './store';

export interface LocalUser {
  id: string;
  email: string;
  passwordHash: string | null;
  createdAt: string;
}

interface OwnedProfile extends Profile {
  userId: string | null;
}

export interface MemoryDb {
  version: string;
  users: LocalUser[];
  sessions: Record<string, { userId: string; createdAt: string }>;
  profiles: OwnedProfile[];
  modeProfiles: ModeProfile[];
  dna: PartnerDNA[];
  contacts: Array<ContactMethod & { profileId: string }>;
  requests: PartnerRequestRecord[];
  matches: MatchRecord[];
  intents: Array<{ id: string; profileId: string; mode: Mode; rawText: string; parsed: PartnerIntent; createdAt: string }>;
  feedback: Array<{ profileId: string; targetId: string; mode: Mode; value: FeedbackValue; createdAt: string }>;
  groups: StudyGroupRecord[];
  notifications: Array<AppNotification & { profileId: string }>;
}

// Changing the seed invalidates persisted demo data automatically.
function seedVersion(): string {
  const text = JSON.stringify([DEMO_PERSON, PERSONAS, SEEDED_INCOMING_REQUESTS, SEEDED_PARTNERSHIPS]);
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  return `v3-${(hash >>> 0).toString(16)}`;
}


function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function seedDemoInteractions(db: MemoryDb): void {
  const now = new Date().toISOString();
  for (const req of SEEDED_INCOMING_REQUESTS) {
    db.requests.push({
      id: randomUUID(),
      requesterId: req.from,
      targetId: DEMO_PROFILE_ID,
      mode: req.mode,
      score: req.score,
      intentText: null,
      status: 'pending',
      createdAt: now,
      expiresAt: daysFromNow(30),
    });
  }
  for (const p of SEEDED_PARTNERSHIPS) {
    const [userA, userB] = orderPair(DEMO_PROFILE_ID, p.with);
    db.matches.push({
      id: randomUUID(),
      userA,
      userB,
      mode: p.mode,
      score: p.score,
      explanation: null,
      bridges: {},
      matchedAt: daysFromNow(-p.daysAgo),
      active: true,
      endedBy: null,
    });
  }
}

export function createSeededDb(): MemoryDb {
  const now = new Date().toISOString();
  const db: MemoryDb = {
    version: seedVersion(),
    users: [{ id: DEMO_USER_ID, email: DEMO_EMAIL_DEFAULT, passwordHash: null, createdAt: now }],
    sessions: {},
    profiles: [],
    modeProfiles: [],
    dna: [],
    contacts: [],
    requests: [],
    matches: [],
    intents: [],
    feedback: [],
    groups: [],
    notifications: [],
  };
  const everyone = [DEMO_PERSON, ...PERSONAS];
  for (const person of everyone) {
    const isDemoPersona = person.id !== DEMO_PROFILE_ID;
    db.profiles.push({ ...seedPersonToProfile(person, isDemoPersona, now), userId: isDemoPersona ? null : DEMO_USER_ID });
    db.modeProfiles.push(...seedPersonToModeProfiles(person, now));
    db.contacts.push(...person.contacts.map((c) => ({ ...c, profileId: person.id })));
  }
  seedDemoInteractions(db);
  return db;
}

type Global = typeof globalThis & { __partnerUpDb?: MemoryDb; __partnerUpSaveTimer?: ReturnType<typeof setTimeout> };

/** One db per process, surviving Vite's server-module hot reloads. */
export function getMemoryDb(): MemoryDb {
  const g = globalThis as Global;
  if (!g.__partnerUpDb) g.__partnerUpDb = createSeededDb();
  return g.__partnerUpDb;
}

export function persistMemoryDb(): void { /* Prisma commits at the API transaction boundary. */ }

function strip({ userId: _userId, ...profile }: OwnedProfile): Profile {
  return structuredClone(profile);
}

const clone = <T>(value: T): T => structuredClone(value);

export class MemoryStore implements DataStore {
  readonly kind = 'sqlite' as const;

  private get db(): MemoryDb {
    return getMemoryDb();
  }

  private changed(): void {
    persistMemoryDb();
  }

  async getProfileByUserId(userId: string) {
    const p = this.db.profiles.find((x) => x.userId === userId);
    return p ? strip(p) : null;
  }

  async getProfile(id: string) {
    const p = this.db.profiles.find((x) => x.id === id);
    return p ? strip(p) : null;
  }

  async getProfiles(ids: string[]) {
    return this.db.profiles.filter((p) => ids.includes(p.id)).map(strip);
  }

  async createProfile(userId: string, input: ProfileInput) {
    const now = new Date().toISOString();
    const profile: OwnedProfile = {
      ...clone(input),
      id: randomUUID(),
      userId,
      avatarHue: Math.floor(Math.random() * 360),
      isDemoPersona: false,
      createdAt: now,
      updatedAt: now,
    };
    this.db.profiles.push(profile);
    this.changed();
    return strip(profile);
  }

  async updateProfile(id: string, input: Partial<ProfileInput>) {
    const p = this.db.profiles.find((x) => x.id === id);
    if (!p) throw new Error('Profile not found');
    Object.assign(p, clone(input), { updatedAt: new Date().toISOString() });
    this.changed();
    return strip(p);
  }

  async deleteProfile(id: string) {
    const db = this.db;
    const owner = db.profiles.find((p) => p.id === id)?.userId;
    db.profiles = db.profiles.filter((p) => p.id !== id);
    db.modeProfiles = db.modeProfiles.filter((m) => m.profileId !== id);
    db.dna = db.dna.filter((d) => d.profileId !== id);
    db.contacts = db.contacts.filter((c) => c.profileId !== id);
    db.requests = db.requests.filter((r) => r.requesterId !== id && r.targetId !== id);
    db.matches = db.matches.filter((m) => m.userA !== id && m.userB !== id);
    db.intents = db.intents.filter((i) => i.profileId !== id);
    db.feedback = db.feedback.filter((f) => f.profileId !== id && f.targetId !== id);
    db.groups = db.groups
      .filter((g) => g.creatorId !== id)
      .map((g) => ({ ...g, memberIds: g.memberIds.filter((m) => m !== id) }));
    db.notifications = db.notifications.filter((n) => n.profileId !== id);
    if (owner) {
      db.users = db.users.filter((u) => u.id !== owner);
      for (const [token, s] of Object.entries(db.sessions)) if (s.userId === owner) delete db.sessions[token];
    }
    this.changed();
  }

  async listModeProfiles(profileId: string) {
    return clone(this.db.modeProfiles.filter((m) => m.profileId === profileId));
  }

  async upsertModeProfile(modeProfile: ModeProfile) {
    const db = this.db;
    const idx = db.modeProfiles.findIndex((m) => m.profileId === modeProfile.profileId && m.mode === modeProfile.mode);
    const value = clone({ ...modeProfile, updatedAt: new Date().toISOString() });
    if (idx >= 0) db.modeProfiles[idx] = value;
    else db.modeProfiles.push(value);
    this.changed();
    return clone(value);
  }

  async listActiveCandidates(mode: Mode): Promise<Candidate[]> {
    const byId = new Map(this.db.profiles.map((p) => [p.id, p]));
    const out: Candidate[] = [];
    for (const mp of this.db.modeProfiles) {
      if (mp.mode !== mode || !mp.active) continue;
      const profile = byId.get(mp.profileId);
      if (profile) out.push({ profile: strip(profile), modeProfile: clone(mp) });
    }
    return out;
  }

  async getDna(profileId: string) {
    const d = this.db.dna.find((x) => x.profileId === profileId);
    return d ? clone(d) : null;
  }

  async saveDna(dna: PartnerDNA) {
    this.db.dna = [...this.db.dna.filter((d) => d.profileId !== dna.profileId), clone(dna)];
    this.changed();
  }

  async listContacts(profileId: string) {
    return this.db.contacts
      .filter((c) => c.profileId === profileId)
      .map(({ kind, value, shareOnMatch }) => ({ kind, value, shareOnMatch }));
  }

  async replaceContacts(profileId: string, contacts: ContactMethod[]) {
    this.db.contacts = [...this.db.contacts.filter((c) => c.profileId !== profileId), ...contacts.map((c) => ({ ...c, profileId }))];
    this.changed();
  }

  async findOpenRequest(requesterId: string, targetId: string, mode: Mode) {
    const r = this.db.requests.find(
      (x) => x.requesterId === requesterId && x.targetId === targetId && x.mode === mode && (x.status === 'pending' || x.status === 'matched'),
    );
    return r ? clone(r) : null;
  }

  async createRequest(request: Omit<PartnerRequestRecord, 'id'>) {
    const record = { ...clone(request), id: randomUUID() };
    this.db.requests.push(record);
    this.changed();
    return clone(record);
  }

  async updateRequestStatus(id: string, status: RequestStatusRecord) {
    const r = this.db.requests.find((x) => x.id === id);
    if (r) r.status = status;
    this.changed();
  }

  async listRequestsFrom(requesterId: string) {
    return clone(this.db.requests.filter((r) => r.requesterId === requesterId));
  }

  async listPendingTo(targetId: string) {
    return clone(this.db.requests.filter((r) => r.targetId === targetId && r.status === 'pending'));
  }

  async createMatch(match: Omit<MatchRecord, 'id'>) {
    const [userA, userB] = orderPair(match.userA, match.userB);
    const record: MatchRecord = { ...clone(match), userA, userB, id: randomUUID() };
    this.db.matches.push(record);
    this.changed();
    return clone(record);
  }

  async getMatch(id: string) {
    const m = this.db.matches.find((x) => x.id === id);
    return m ? clone(m) : null;
  }

  async findActiveMatch(a: string, b: string, mode: Mode) {
    const [userA, userB] = orderPair(a, b);
    const m = this.db.matches.find((x) => x.userA === userA && x.userB === userB && x.mode === mode && x.active);
    return m ? clone(m) : null;
  }

  async listMatchesFor(profileId: string) {
    return clone(this.db.matches.filter((m) => m.userA === profileId || m.userB === profileId));
  }

  async updateMatch(id: string, patch: Partial<Pick<MatchRecord, 'active' | 'endedBy' | 'bridges'>>) {
    const m = this.db.matches.find((x) => x.id === id);
    if (m) Object.assign(m, clone(patch));
    this.changed();
  }

  async saveIntent(profileId: string, mode: Mode, rawText: string, parsed: PartnerIntent) {
    this.db.intents.push({ id: randomUUID(), profileId, mode, rawText, parsed: clone(parsed), createdAt: new Date().toISOString() });
    if (this.db.intents.length > 2000) this.db.intents.splice(0, this.db.intents.length - 2000);
    this.changed();
  }

  async saveFeedback(profileId: string, targetId: string, mode: Mode, value: FeedbackValue) {
    this.db.feedback = this.db.feedback.filter((f) => !(f.profileId === profileId && f.targetId === targetId && f.mode === mode));
    this.db.feedback.push({ profileId, targetId, mode, value, createdAt: new Date().toISOString() });
    this.changed();
  }

  async saveStudyGroup(group: Omit<StudyGroupRecord, 'id' | 'createdAt'>) {
    const record: StudyGroupRecord = { ...clone(group), id: randomUUID(), createdAt: new Date().toISOString() };
    this.db.groups.push(record);
    this.changed();
    return clone(record);
  }

  async addNotification(n: NewNotification) {
    this.db.notifications.push({ ...n, id: randomUUID(), read: false, createdAt: new Date().toISOString() });
    this.changed();
  }

  async listNotifications(profileId: string) {
    return this.db.notifications
      .filter((n) => n.profileId === profileId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 30)
      .map(({ profileId: _p, ...n }) => clone(n));
  }

  async markNotificationsRead(profileId: string) {
    for (const n of this.db.notifications) if (n.profileId === profileId) n.read = true;
    this.changed();
  }

  async resetDemoState(profileId: string) {
    const db = this.db;
    db.requests = db.requests.filter((r) => r.requesterId !== profileId && r.targetId !== profileId);
    db.matches = db.matches.filter((m) => m.userA !== profileId && m.userB !== profileId);
    db.notifications = db.notifications.filter((n) => n.profileId !== profileId);
    db.intents = db.intents.filter((i) => i.profileId !== profileId);
    db.feedback = db.feedback.filter((f) => f.profileId !== profileId);
    db.groups = db.groups.filter((g) => g.creatorId !== profileId);
    if (profileId === DEMO_PROFILE_ID) {
      // Restore the demo account exactly as seeded (profile edits included).
      const now = new Date().toISOString();
      db.profiles = db.profiles.map((p) =>
        p.id === DEMO_PROFILE_ID ? { ...seedPersonToProfile(DEMO_PERSON, false, now), userId: DEMO_USER_ID } : p,
      );
      db.modeProfiles = [...db.modeProfiles.filter((m) => m.profileId !== DEMO_PROFILE_ID), ...seedPersonToModeProfiles(DEMO_PERSON, now)];
      db.contacts = [...db.contacts.filter((c) => c.profileId !== DEMO_PROFILE_ID), ...DEMO_PERSON.contacts.map((c) => ({ ...c, profileId: DEMO_PROFILE_ID }))];
      db.dna = db.dna.filter((d) => d.profileId !== DEMO_PROFILE_ID);
      seedDemoInteractions(db);
    }
    this.changed();
  }
}
