import type { Mode, ModeProfile, Profile, PublicProfile } from '../../shared/types';
import type { SeedPerson } from './seed';

export function seedPersonToProfile(person: SeedPerson, isDemoPersona: boolean, now: string): Profile {
  return {
    id: person.id,
    displayName: person.displayName,
    age: person.age,
    pronouns: person.pronouns,
    community: person.community,
    city: person.city,
    bio: person.bio,
    interests: person.interests,
    skills: person.skills,
    languages: person.languages,
    availability: person.availability,
    groupSizes: person.groupSizes,
    setting: person.setting,
    visibility: { age: true, community: true, pronouns: true },
    avatarHue: person.avatarHue,
    isDemoPersona,
    createdAt: now,
    updatedAt: now,
  };
}

export function seedPersonToModeProfiles(person: SeedPerson, now: string): ModeProfile[] {
  return (Object.entries(person.modes) as Array<[Mode, SeedPerson['modes'][Mode]]>)
    .filter((entry): entry is [Mode, NonNullable<SeedPerson['modes'][Mode]>] => Boolean(entry[1]))
    .map(([mode, input]) => ({ profileId: person.id, mode, ...input, active: true, updatedAt: now }));
}

/** The only shape of another person that ever leaves the server pre-match. */
export function toPublicProfile(profile: Profile): PublicProfile {
  return {
    id: profile.id,
    displayName: profile.displayName,
    age: profile.visibility.age ? profile.age : null,
    pronouns: profile.visibility.pronouns ? profile.pronouns : null,
    community: profile.visibility.community ? profile.community : null,
    city: profile.city,
    bio: profile.bio,
      interests: profile.interests.slice(0, 8),
      skills: profile.skills,
      availability: profile.availability,
    languages: profile.languages,
    avatarHue: profile.avatarHue,
    isDemoPersona: profile.isDemoPersona,
  };
}
