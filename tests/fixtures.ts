import type { Mode } from '../shared/types';
import { seedPersonToModeProfiles, seedPersonToProfile } from '../server/data/mappers';
import { DEMO_PERSON, PERSONAS } from '../server/data/seed';
import type { Candidate } from '../server/matching/recommend';

const NOW = '2026-09-25T00:00:00.000Z';

export const demoProfile = seedPersonToProfile(DEMO_PERSON, false, NOW);
export const demoModeProfiles = seedPersonToModeProfiles(DEMO_PERSON, NOW);
export const demoModeProfile = (mode: Mode) => demoModeProfiles.find((m) => m.mode === mode) ?? null;

export const candidates: Candidate[] = PERSONAS.flatMap((person) => {
  const profile = seedPersonToProfile(person, true, NOW);
  return seedPersonToModeProfiles(person, NOW).map((modeProfile) => ({ profile, modeProfile }));
});
