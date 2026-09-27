import type {
  ContactMethod,
  MeResponse,
  Mode,
  ModeProfile,
  ModeProfileInput,
  PartnerDNA,
  Profile,
  ProfileInput,
} from '../../shared/types';
import { generatePartnerDNA } from '../ai/service';
import { buildDnaSections, fallbackDnaHeadline, fallbackDnaSummary } from '../ai/templates';
import { deleteAuthUser, isDemoUser, type AuthUser } from '../auth';
import { getStore } from '../data';
import { ApiError, needsProfile } from '../http/errors';
import { connections, persistConnections } from './connections';
import { identityFor, naviDb, saveNavi } from './naviStore';

export async function requireProfile(user: AuthUser): Promise<Profile> {
  const profile = await getStore().getProfileByUserId(user.id);
  if (!profile) throw needsProfile();
  return profile;
}

export async function getMe(user: AuthUser): Promise<MeResponse> {
  const store = getStore();
  const profile = await store.getProfileByUserId(user.id);
  if (!profile) {
    return { email: user.email, profile: null, modeProfiles: [], dna: null, contacts: [], isDemoAccount: isDemoUser(user) };
  }
  const [modeProfiles, contacts] = await Promise.all([store.listModeProfiles(profile.id), store.listContacts(profile.id)]);
  let dna = await store.getDna(profile.id);
  if (!dna) dna = await refreshDna(profile, modeProfiles, { useAI: false });
  return { email: user.email, profile, modeProfiles, dna, contacts, isDemoAccount: isDemoUser(user) };
}

/**
 * Partner DNA is cached. Sections are always rebuilt deterministically from
 * the profile (so edits show instantly); the AI-written headline/summary is
 * only regenerated on first creation or when explicitly requested.
 */
export async function refreshDna(
  profile: Profile,
  modeProfiles: ModeProfile[],
  options: { useAI: boolean },
): Promise<PartnerDNA> {
  const store = getStore();
  const existing = await store.getDna(profile.id);
  let dna: PartnerDNA;
  if (options.useAI) {
    dna = await generatePartnerDNA(profile, modeProfiles);
  } else {
    dna = { ...(existing ?? { profileId: profile.id, headline: fallbackDnaHeadline(profile, modeProfiles), summary: fallbackDnaSummary(profile, buildDnaSections(profile, modeProfiles)), source: 'local' as const }), sections: buildDnaSections(profile, modeProfiles), updatedAt: new Date().toISOString() };
  }
  await store.saveDna(dna);
  return dna;
}

export async function saveProfile(user: AuthUser, input: ProfileInput): Promise<MeResponse> {
  const store = getStore();
  const existing = await store.getProfileByUserId(user.id);
  if(existing&&identityFor(existing.id)&&(existing.displayName!==input.displayName||existing.age!==input.age))throw new ApiError(409,'immutable_identity','Your name and age cannot be changed after setup.');
  const profile = existing ? await store.updateProfile(existing.id, input) : await store.createProfile(user.id, input);
  const modeProfiles = await store.listModeProfiles(profile.id);
  await refreshDna(profile, modeProfiles, { useAI: false });
  return getMe(user);
}

export async function saveModeProfile(user: AuthUser, mode: Mode, input: ModeProfileInput & { active?: boolean }): Promise<MeResponse> {
  const store = getStore();
  const profile = await requireProfile(user);
  if (input.details.kind !== mode) throw new ApiError(400, 'invalid_input', 'Those answers don’t belong to this mode.');
  await store.upsertModeProfile({
    profileId: profile.id,
    mode,
    lookingFor: input.lookingFor,
    seeks: input.seeks,
    offers: input.offers,
    details: input.details,
    active: input.active ?? true,
    updatedAt: new Date().toISOString(),
  });
  const modeProfiles = await store.listModeProfiles(profile.id);
  await refreshDna(profile, modeProfiles, { useAI: false });
  return getMe(user);
}

export async function regenerateDna(user: AuthUser): Promise<MeResponse> {
  const profile = await requireProfile(user);
  const modeProfiles = await getStore().listModeProfiles(profile.id);
  await refreshDna(profile, modeProfiles, { useAI: true });
  return getMe(user);
}

export async function saveContacts(user: AuthUser, contacts: ContactMethod[]): Promise<MeResponse> {
  const profile = await requireProfile(user);
  await getStore().replaceContacts(profile.id, contacts);
  return getMe(user);
}

export async function deleteAccount(user: AuthUser): Promise<void> {
  if (isDemoUser(user)) {
    throw new ApiError(403, 'demo_account', 'The shared demo account can’t be deleted — use “Reset demo” instead.');
  }
  const store = getStore();
  const profile = await store.getProfileByUserId(user.id);
  if (profile) {
    const c=connections();c.requests=c.requests.filter(r=>r.from!==profile.id&&r.to!==profile.id);c.searches=c.searches.filter(s=>s.from!==profile.id&&s.to!==profile.id);c.circles=c.circles.filter(g=>!g.members.includes(profile.id));
    for(const [key,value] of Object.entries(c.proposals))if(value.owner===profile.id||value.proposal.members.some(m=>m.profile.id===profile.id))delete c.proposals[key];persistConnections();
    delete naviDb().identities[profile.id];naviDb().watches=naviDb().watches.filter(w=>w.owner!==profile.id);naviDb().notices=naviDb().notices.filter(n=>n.owner!==profile.id);saveNavi();await store.deleteProfile(profile.id);
  }
  await deleteAuthUser(user);
}
