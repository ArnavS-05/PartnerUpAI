// Fictional demo world. No real people. Designed so that each of the three
// demo scenarios produces one clearly strong match, a couple of plausible
// ones, and some visibly weak ones (so the scoring is legible to judges).

import type { ContactMethod, GroupSize, LanguageSkill, Mode, ModeProfileInput, Setting, TimeSlot } from '../../shared/types';

export interface SeedPerson {
  id: string;
  displayName: string;
  age: number;
  pronouns: string | null;
  community: string;
  city: string;
  bio: string;
  interests: string[];
  skills: string[];
  languages: LanguageSkill[];
  availability: TimeSlot[];
  groupSizes: GroupSize[];
  setting: Setting;
  avatarHue: number;
  modes: Partial<Record<Mode, ModeProfileInput>>;
  contacts: ContactMethod[];
}

export const seedId = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

export const DEMO_PROFILE_ID = seedId(1);
export const DEMO_USER_ID = seedId(0x1001);
export const DEMO_EMAIL_DEFAULT = 'demo@partnerup.test';

const en = (level: LanguageSkill['level'] = 'native'): LanguageSkill => ({ language: 'English', level });

export const DEMO_PERSON: SeedPerson = {
  id: DEMO_PROFILE_ID,
  displayName: 'Arnav Sawant',
  age: 20,
  pronouns: null,
  community: 'Kennesaw State University',
  city: 'Atlanta',
  bio: "Mechanical engineering student who likes robotics, soccer, music, AI and startups. I build things quickly and love meeting people from different backgrounds.",
  interests: ['Robotics', 'Soccer', 'Music', 'AI', 'Startups', 'Valorant', 'F1', 'Food', 'Photography'],
  skills: ['Engineering', 'CAD', 'Python', 'Product'],
  languages: [en('fluent'), { language: 'Hindi', level: 'native' }, { language: 'Marathi', level: 'native' }, { language: 'Spanish', level: 'learning' }],
  availability: ['evenings', 'late_nights', 'weekends'],
  groupSizes: ['one_on_one', 'small_group'],
  setting: 'either',
  avatarHue: 32,
  modes: {
    connect: {
      lookingFor: 'People to play Valorant with at night — and someone to watch F1 races with.',
      seeks: ['Gaming partners', 'Watch parties'],
      offers: [],
      details: { kind: 'connect', activities: ['Valorant', 'F1', 'Soccer'] },
    },
    learn: {
      lookingFor: 'A study partner for chemistry — I can help with calculus or physics in return.',
      seeks: ['Chemistry'],
      offers: ['Calculus', 'Physics', 'Python'],
      details: {
        kind: 'learn',
        strengths: ['Calculus', 'Physics', 'Python'],
        needs: ['Chemistry'],
        courses: ['MATH 1552', 'CHEM 1310', 'PHYS 2211'],
        studyStyles: ['practice_problems', 'teach_back'],
        groupPreference: 'either',
      },
    },
    explore: {
      lookingFor: 'Just moved to Atlanta from India — looking for a local to explore the city with.',
      seeks: ['A local friend', 'Exploring the city'],
      offers: ['Cultural exchange'],
      details: { kind: 'explore', role: 'international_student', exploringCity: 'Atlanta', origin: 'India', activities: ['Food', 'Photography', 'Music', 'Soccer'] },
    },
  },
  contacts: [
    { kind: 'instagram', value: '@arnav.builds', shareOnMatch: true },
    { kind: 'discord', value: 'arnav.builds', shareOnMatch: true },
    { kind: 'email', value: DEMO_EMAIL_DEFAULT, shareOnMatch: false },
  ],
};

export const PERSONAS: SeedPerson[] = [
  // ── CONNECT ──────────────────────────────────────────────────────────────
  {
    id: seedId(2),
    displayName: 'Alex Rivera',
    age: 21,
    pronouns: 'they/them',
    community: 'Georgia Tech',
    city: 'Atlanta',
    bio: 'Programmer looking for a sustainability hackathon project. I build web apps and enjoy Valorant, F1 and music.',
    interests: ['Valorant', 'F1', 'Music', 'Web development', 'Startups', 'Sustainability', 'Hackathons'],
    skills: ['Python', 'JavaScript', 'Full stack'],
    languages: [en(), { language: 'Spanish', level: 'conversational' }],
    availability: ['late_nights', 'weekends'],
    groupSizes: ['small_group', 'one_on_one'],
    setting: 'online',
    avatarHue: 200,
    modes: {
      connect: {
        lookingFor: 'Looking for a couple of people to queue Valorant with at night — bonus if you watch F1.',
        seeks: ['Gaming partners', 'Watch parties'],
        offers: ['Programming', 'Web development'],
        details: { kind: 'connect', activities: ['Valorant', 'F1', 'Discord'] },
      },
      learn: {
        lookingFor: 'Need calc help; happy to teach programming in return.',
        seeks: ['Calculus'],
        offers: ['Python', 'JavaScript'],
        details: {
          kind: 'learn',
          strengths: ['Python', 'JavaScript', 'Data structures'],
          needs: ['Calculus'],
          courses: ['MATH 1552', 'CS 1332'],
          studyStyles: ['practice_problems'],
          groupPreference: 'group',
        },
      },
    },
    contacts: [
      { kind: 'discord', value: 'alexr.dev', shareOnMatch: true },
      { kind: 'instagram', value: '@alex.rivera.codes', shareOnMatch: true },
    ],
  },
  {
    id: seedId(3),
    displayName: 'Sarah Johnson',
    age: 22,
    pronouns: 'she/her',
    community: 'Kennesaw State University',
    city: 'Atlanta',
    bio: 'Looking for a roommate near KSU next semester. I enjoy gaming, basketball and a quiet home on weeknights.',
    interests: ['Valorant', 'League of Legends', 'Esports', 'Basketball', 'Roommates'],
    skills: ['Shot-calling'],
    languages: [en(), { language: 'Korean', level: 'fluent' }],
    availability: ['mornings', 'afternoons', 'weekdays', 'weekends'],
    groupSizes: ['large_group'],
    setting: 'online',
    avatarHue: 265,
    modes: {
      connect: {
        lookingFor: 'A roommate near KSU next semester, and people to play games with.',
        seeks: ['Roommates', 'Competitive ranked', 'Discord groups'],
        offers: [],
        details: { kind: 'connect', activities: ['Valorant', 'League of Legends'] },
      },
    },
    contacts: [{ kind: 'instagram', value: '@sarah.partnerup.demo', shareOnMatch: true }],
  },
  {
    id: seedId(4),
    displayName: 'Priya Nair',
    age: 20,
    pronouns: 'she/her',
    community: 'Georgia State University',
    city: 'Atlanta',
    bio: 'Formula 1 fanatic, weekend photographer, always hunting for the best cold brew in town.',
    interests: ['F1', 'Photography', 'Coffee', 'Concerts'],
    skills: ['Photography'],
    languages: [en(), { language: 'Malayalam', level: 'native' }],
    availability: ['evenings', 'weekends'],
    groupSizes: ['small_group'],
    setting: 'in_person',
    avatarHue: 330,
    modes: {
      connect: {
        lookingFor: 'Want an F1 watch-party crew in Atlanta for race weekends.',
        seeks: ['Watch parties', 'New friends'],
        offers: [],
        details: { kind: 'connect', activities: ['F1', 'Photography'] },
      },
    },
    contacts: [{ kind: 'instagram', value: '@priya.shoots.f1', shareOnMatch: true }],
  },
  {
    id: seedId(5),
    displayName: 'Sofia Martínez',
    age: 19,
    pronouns: 'she/her',
    community: 'SCAD Atlanta',
    city: 'Atlanta',
    bio: 'Illustration student. Cozy games, anime marathons and K-pop at 2am.',
    interests: ['Minecraft', 'Stardew Valley', 'Anime', 'K-pop', 'Art'],
    skills: ['Illustration'],
    languages: [{ language: 'Spanish', level: 'native' }, en('fluent')],
    availability: ['late_nights', 'weekends'],
    groupSizes: ['one_on_one'],
    setting: 'online',
    avatarHue: 290,
    modes: {
      connect: {
        lookingFor: 'Someone chill to play cozy games with late at night.',
        seeks: ['Gaming partners', 'New friends'],
        offers: [],
        details: { kind: 'connect', activities: ['Minecraft', 'Stardew Valley', 'Anime'] },
      },
    },
    contacts: [{ kind: 'discord', value: 'sofi.sketches', shareOnMatch: true }],
  },
  {
    id: seedId(6),
    displayName: 'Marcus Thompson',
    age: 23,
    pronouns: 'he/him',
    community: 'Georgia Tech',
    city: 'Atlanta',
    bio: 'Pickup basketball at 7am, trail runs on weekends. Looking for people who like getting outside.',
    interests: ['Basketball', 'Hiking', 'Gym', 'Running'],
    skills: ['Coaching'],
    languages: [en()],
    availability: ['mornings', 'weekends'],
    groupSizes: ['large_group'],
    setting: 'in_person',
    avatarHue: 140,
    modes: {
      connect: {
        lookingFor: 'Building a morning pickup basketball group.',
        seeks: ['New friends', 'Basketball'],
        offers: [],
        details: { kind: 'connect', activities: ['Basketball', 'Hiking'] },
      },
    },
    contacts: [{ kind: 'instagram', value: '@marcus.hoops', shareOnMatch: true }],
  },

  // ── LEARN ────────────────────────────────────────────────────────────────
  {
    id: seedId(7),
    displayName: 'Maya Chen',
    age: 19,
    pronouns: 'she/her',
    community: 'Georgia Tech',
    city: 'Atlanta',
    bio: 'Pre-med chem nerd (the fun kind). I love organic chemistry and I am terrible at integrals.',
    interests: ['Biology', 'Coffee', 'Piano', 'Hiking'],
    skills: ['Chemistry'],
    languages: [en(), { language: 'Mandarin', level: 'fluent' }],
    availability: ['evenings', 'late_nights', 'weekdays'],
    groupSizes: ['small_group', 'one_on_one'],
    setting: 'in_person',
    avatarHue: 350,
    modes: {
      learn: {
        lookingFor: "Someone strong in calc who wants chem help in return — I'm great at explaining reactions.",
        seeks: ['Calculus', 'Python'],
        offers: ['Chemistry', 'Organic chemistry'],
        details: {
          kind: 'learn',
          strengths: ['Chemistry', 'Organic chemistry', 'Biology'],
          needs: ['Calculus', 'Python'],
          courses: ['CHEM 1310', 'MATH 1552', 'BIOS 1107'],
          studyStyles: ['practice_problems', 'discussion'],
          groupPreference: 'either',
        },
      },
    },
    contacts: [
      { kind: 'instagram', value: '@maya.molecules', shareOnMatch: true },
      { kind: 'discord', value: 'mayachem', shareOnMatch: true },
    ],
  },
  {
    id: seedId(8),
    displayName: 'Daniel Kim',
    age: 20,
    pronouns: 'he/him',
    community: 'Georgia Tech',
    city: 'Atlanta',
    bio: 'CS sophomore. I can explain recursion to anyone, but linear algebra is humbling me.',
    interests: ['Chess', 'Programming', 'Film', 'Basketball'],
    skills: ['Python', 'Java'],
    languages: [en(), { language: 'Korean', level: 'conversational' }],
    availability: ['evenings', 'weekends'],
    groupSizes: ['small_group'],
    setting: 'either',
    avatarHue: 215,
    modes: {
      learn: {
        lookingFor: 'Trading programming help for math help.',
        seeks: ['Calculus', 'Linear algebra'],
        offers: ['Python', 'Java'],
        details: {
          kind: 'learn',
          strengths: ['Python', 'Java', 'Data structures'],
          needs: ['Calculus', 'Linear algebra'],
          courses: ['CS 1332', 'MATH 1554', 'MATH 1552'],
          studyStyles: ['practice_problems', 'teach_back'],
          groupPreference: 'group',
        },
      },
    },
    contacts: [{ kind: 'discord', value: 'dkim.codes', shareOnMatch: true }],
  },
  {
    id: seedId(9),
    displayName: 'Ethan Brooks',
    age: 19,
    pronouns: 'he/him',
    community: 'Georgia Tech',
    city: 'Atlanta',
    bio: 'Aerospace engineering. Calc and physics make sense to me, chemistry absolutely does not.',
    interests: ['Robotics', 'Soccer', 'Rocket League'],
    skills: ['CAD'],
    languages: [en()],
    availability: ['evenings', 'late_nights'],
    groupSizes: ['one_on_one'],
    setting: 'in_person',
    avatarHue: 20,
    modes: {
      learn: {
        lookingFor: 'Need someone who actually understands chemistry.',
        seeks: ['Chemistry'],
        offers: ['Calculus', 'Physics'],
        details: {
          kind: 'learn',
          strengths: ['Calculus', 'Physics'],
          needs: ['Chemistry'],
          courses: ['CHEM 1310', 'PHYS 2211'],
          studyStyles: ['practice_problems'],
          groupPreference: 'pair',
        },
      },
    },
    contacts: [{ kind: 'instagram', value: '@ethan.flies', shareOnMatch: true }],
  },
  {
    id: seedId(10),
    displayName: 'Hannah Okafor',
    age: 22,
    pronouns: 'she/her',
    community: 'Emory University',
    city: 'Atlanta',
    bio: 'Chemistry TA who genuinely loves helping people get unstuck. Early bird.',
    interests: ['Volunteering', 'Running', 'Reading'],
    skills: ['Teaching'],
    languages: [en(), { language: 'Yoruba', level: 'fluent' }],
    availability: ['mornings', 'afternoons'],
    groupSizes: ['small_group'],
    setting: 'in_person',
    avatarHue: 170,
    modes: {
      learn: {
        lookingFor: 'I love tutoring chem — happy to help anyone who is stuck.',
        seeks: [],
        offers: ['Chemistry', 'Biology'],
        details: {
          kind: 'learn',
          strengths: ['Chemistry', 'Biology'],
          needs: [],
          courses: [],
          studyStyles: ['teach_back', 'discussion'],
          groupPreference: 'group',
        },
      },
    },
    contacts: [{ kind: 'email', value: 'hannah.o@partnerup.test', shareOnMatch: true }],
  },
  {
    id: seedId(11),
    displayName: 'Lucía Fernández',
    age: 21,
    pronouns: 'she/her',
    community: 'Georgia Tech',
    city: 'Atlanta',
    bio: 'Exchange student from Madrid studying physics. I want my English to sound less like a textbook!',
    interests: ['Soccer', 'Dance', 'Photography', 'Travel'],
    skills: ['Physics'],
    languages: [{ language: 'Spanish', level: 'native' }, en('learning')],
    availability: ['evenings', 'weekends'],
    groupSizes: ['one_on_one', 'small_group'],
    setting: 'either',
    avatarHue: 10,
    modes: {
      learn: {
        lookingFor: 'Spanish ⇄ English language exchange, and maybe some calc practice.',
        seeks: ['English', 'Calculus'],
        offers: ['Spanish', 'Physics'],
        details: {
          kind: 'learn',
          strengths: ['Spanish', 'Physics'],
          needs: ['English', 'Calculus'],
          courses: ['PHYS 2211', 'MATH 1552'],
          studyStyles: ['discussion'],
          groupPreference: 'pair',
        },
      },
    },
    contacts: [{ kind: 'instagram', value: '@lucia.en.atl', shareOnMatch: true }],
  },
  {
    id: seedId(12),
    displayName: 'Kenji Watanabe',
    age: 23,
    pronouns: 'he/him',
    community: 'Georgia Tech',
    city: 'Atlanta',
    bio: 'Grad student from Osaka. Linear algebra is my comfort zone; Python and English slang are not.',
    interests: ['Photography', 'Anime', 'Cooking', 'Hiking'],
    skills: ['Linear algebra'],
    languages: [{ language: 'Japanese', level: 'native' }, en('learning')],
    availability: ['afternoons', 'evenings'],
    groupSizes: ['small_group'],
    setting: 'in_person',
    avatarHue: 190,
    modes: {
      learn: {
        lookingFor: 'Happy to teach math or Japanese in exchange for Python or English practice.',
        seeks: ['Python', 'English'],
        offers: ['Linear algebra', 'Japanese'],
        details: {
          kind: 'learn',
          strengths: ['Japanese', 'Linear algebra', 'Physics'],
          needs: ['English', 'Python'],
          courses: ['MATH 1554'],
          studyStyles: ['quiet_focus', 'practice_problems'],
          groupPreference: 'group',
        },
      },
    },
    contacts: [{ kind: 'discord', value: 'kenji.w', shareOnMatch: true }],
  },
  {
    id: seedId(13),
    displayName: 'Aisha Rahman',
    age: 20,
    pronouns: 'she/her',
    community: 'Georgia Tech',
    city: 'Atlanta',
    bio: 'Physics + stats double threat. Organic chemistry is my villain origin story.',
    interests: ['Podcasts', 'Board games', 'Writing'],
    skills: ['Statistics'],
    languages: [en(), { language: 'Bengali', level: 'native' }],
    availability: ['evenings', 'weekends'],
    groupSizes: ['small_group'],
    setting: 'in_person',
    avatarHue: 45,
    modes: {
      learn: {
        lookingFor: 'Looking for a small study group — I can carry physics and stats.',
        seeks: ['Python', 'Organic chemistry'],
        offers: ['Physics', 'Statistics'],
        details: {
          kind: 'learn',
          strengths: ['Physics', 'Statistics', 'Calculus'],
          needs: ['Python', 'Organic chemistry'],
          courses: ['PHYS 2211', 'MATH 3670'],
          studyStyles: ['discussion', 'practice_problems'],
          groupPreference: 'group',
        },
      },
    },
    contacts: [{ kind: 'instagram', value: '@aisha.explains', shareOnMatch: true }],
  },
  {
    id: seedId(14),
    displayName: 'Sam Patel',
    age: 21,
    pronouns: 'they/them',
    community: 'Georgia State University',
    city: 'Atlanta',
    bio: 'Biochem major. Chem clicks for me; physics and calc do not. Morning person, sorry.',
    interests: ['Cooking', 'Cricket', 'Volunteering'],
    skills: ['Chemistry'],
    languages: [en(), { language: 'Gujarati', level: 'native' }],
    availability: ['mornings', 'weekends'],
    groupSizes: ['small_group'],
    setting: 'in_person',
    avatarHue: 95,
    modes: {
      learn: {
        lookingFor: 'Chem help in exchange for physics/calc help.',
        seeks: ['Physics', 'Calculus'],
        offers: ['Chemistry', 'Statistics'],
        details: {
          kind: 'learn',
          strengths: ['Chemistry', 'Statistics'],
          needs: ['Physics', 'Calculus'],
          courses: ['CHEM 1211'],
          studyStyles: ['quiet_focus'],
          groupPreference: 'group',
        },
      },
    },
    contacts: [{ kind: 'email', value: 'sam.p@partnerup.test', shareOnMatch: true }],
  },

  // ── EXPLORE ──────────────────────────────────────────────────────────────
  {
    id: seedId(15),
    displayName: 'Jamal Carter',
    age: 21,
    pronouns: 'he/him',
    community: 'Morehouse College',
    city: 'Atlanta',
    bio: 'Born and raised in Atlanta. I know every food spot on Buford Highway and love shooting film around the city.',
    interests: ['Food', 'Photography', 'Jazz', 'Hiking', 'Markets'],
    skills: ['Film photography'],
    languages: [en(), { language: 'French', level: 'conversational' }],
    availability: ['afternoons', 'evenings', 'weekends'],
    groupSizes: ['one_on_one', 'small_group'],
    setting: 'in_person',
    avatarHue: 25,
    modes: {
      explore: {
        lookingFor: 'I love meeting international students and showing people the best spots in Atlanta.',
        seeks: ['Meeting people from abroad', 'Cultural exchange'],
        offers: ['Showing people around', 'A local friend'],
        details: { kind: 'explore', role: 'local', exploringCity: 'Atlanta', origin: null, activities: ['Food', 'Photography', 'Markets', 'Exploring the city'] },
      },
    },
    contacts: [
      { kind: 'instagram', value: '@jamal.shoots.atl', shareOnMatch: true },
      { kind: 'email', value: 'jamal.c@partnerup.test', shareOnMatch: true },
    ],
  },
  {
    id: seedId(16),
    displayName: 'Mateo Silva',
    age: 20,
    pronouns: 'he/him',
    community: 'Georgia Tech',
    city: 'Atlanta',
    bio: 'Just arrived from São Paulo for my master’s. Looking for pickup soccer and people to explore with.',
    interests: ['Soccer', 'Food', 'Music', 'Dance'],
    skills: ['Data science'],
    languages: [{ language: 'Portuguese', level: 'native' }, en('fluent'), { language: 'Spanish', level: 'conversational' }],
    availability: ['mornings', 'afternoons', 'weekends'],
    groupSizes: ['small_group'],
    setting: 'in_person',
    avatarHue: 120,
    modes: {
      explore: {
        lookingFor: 'New in Atlanta and would love friends to explore the city with.',
        seeks: ['New friends', 'Exploring the city', 'A local friend'],
        offers: ['Cultural exchange'],
        details: { kind: 'explore', role: 'international_student', exploringCity: 'Atlanta', origin: 'Brazil', activities: ['Soccer', 'Food', 'Exploring the city'] },
      },
      connect: {
        lookingFor: 'Pickup soccer on weekends!',
        seeks: ['New friends', 'Soccer'],
        offers: [],
        details: { kind: 'connect', activities: ['Soccer', 'EA FC'] },
      },
    },
    contacts: [{ kind: 'instagram', value: '@mateo.in.atl', shareOnMatch: true }],
  },
  {
    id: seedId(17),
    displayName: 'Grace Liu',
    age: 24,
    pronouns: 'she/her',
    community: 'Atlanta Tech Village',
    city: 'Atlanta',
    bio: 'UX designer. Weekend museum hopper and Beltline walker. Early riser.',
    interests: ['Museums', 'Hiking', 'Coffee', 'Design'],
    skills: ['UX design'],
    languages: [en(), { language: 'Mandarin', level: 'conversational' }],
    availability: ['mornings', 'weekends'],
    groupSizes: ['one_on_one'],
    setting: 'in_person',
    avatarHue: 305,
    modes: {
      explore: {
        lookingFor: 'Looking for new friends to check out museums and coffee spots with.',
        seeks: ['New friends'],
        offers: [],
        details: { kind: 'explore', role: 'local', exploringCity: 'Atlanta', origin: null, activities: ['Museums', 'Coffee', 'Parks'] },
      },
    },
    contacts: [{ kind: 'instagram', value: '@grace.makes.things', shareOnMatch: true }],
  },
  {
    id: seedId(18),
    displayName: 'Emily Park',
    age: 20,
    pronouns: 'she/her',
    community: 'Georgia Tech',
    city: 'Atlanta',
    bio: 'Heading to Paris for a study-abroad semester. Food, photos and too many museums.',
    interests: ['Food', 'Photography', 'Museums', 'Travel'],
    skills: ['French'],
    languages: [en(), { language: 'French', level: 'conversational' }],
    availability: ['evenings', 'weekends'],
    groupSizes: ['one_on_one', 'small_group'],
    setting: 'in_person',
    avatarHue: 340,
    modes: {
      explore: {
        lookingFor: 'Going to Paris next month and want a local to show me around.',
        seeks: ['A local friend', 'Exploring the city'],
        offers: [],
        details: { kind: 'explore', role: 'traveler', exploringCity: 'Paris', origin: null, activities: ['Food', 'Photography', 'Museums'] },
      },
    },
    contacts: [{ kind: 'instagram', value: '@emily.abroad', shareOnMatch: true }],
  },
  {
    id: seedId(19),
    displayName: 'Yuki Tanaka',
    age: 22,
    pronouns: 'she/her',
    community: 'Waseda University',
    city: 'Tokyo',
    bio: 'Tokyo local. Film camera always in my bag; I know the best tiny ramen shops in Shimokitazawa.',
    interests: ['Photography', 'Food', 'Anime', 'Coffee'],
    skills: ['Photography'],
    languages: [{ language: 'Japanese', level: 'native' }, en('conversational')],
    availability: ['evenings', 'weekends'],
    groupSizes: ['one_on_one', 'small_group'],
    setting: 'in_person',
    avatarHue: 0,
    modes: {
      explore: {
        lookingFor: 'I want to meet international visitors and show them the Tokyo I love.',
        seeks: ['Meeting people from abroad', 'Cultural exchange'],
        offers: ['Showing people around', 'A local friend'],
        details: { kind: 'explore', role: 'local', exploringCity: 'Tokyo', origin: null, activities: ['Photography', 'Food', 'Exploring the city'] },
      },
    },
    contacts: [{ kind: 'instagram', value: '@yuki.film.tokyo', shareOnMatch: true }],
  },
  {
    id: seedId(20),
    displayName: 'Haruto Sato',
    age: 25,
    pronouns: 'he/him',
    community: 'Shibuya creative scene',
    city: 'Tokyo',
    bio: 'DJ and night owl. Tokyo after midnight is a different city.',
    interests: ['Electronic music', 'Nightlife', 'Fashion'],
    skills: ['DJing'],
    languages: [{ language: 'Japanese', level: 'native' }, en('learning')],
    availability: ['late_nights', 'weekends'],
    groupSizes: ['large_group'],
    setting: 'in_person',
    avatarHue: 250,
    modes: {
      explore: {
        lookingFor: 'Always happy to bring new people out to the Tokyo music scene.',
        seeks: ['New friends'],
        offers: ['A local friend'],
        details: { kind: 'explore', role: 'local', exploringCity: 'Tokyo', origin: null, activities: ['Nightlife', 'Electronic music'] },
      },
    },
    contacts: [{ kind: 'instagram', value: '@haruto.after.dark', shareOnMatch: true }],
  },
];

/**
 * Pre-existing one-sided interest *towards* the demo account. The demo user is
 * never told who these are — only an anonymous count — until they happen to
 * Partner Up with the same person, at which point it becomes mutual.
 */
export const SEEDED_INCOMING_REQUESTS: Array<{ from: string; mode: Mode; score: number }> = [
  { from: seedId(4), mode: 'connect', score: 71 },
  { from: seedId(5), mode: 'connect', score: 58 },
];

/** A partnership the demo account already has, so "Matches" isn't empty. */
export const SEEDED_PARTNERSHIPS: Array<{ with: string; mode: Mode; score: number; daysAgo: number }> = [
  { with: seedId(11), mode: 'learn', score: 84, daysAgo: 3 },
];
