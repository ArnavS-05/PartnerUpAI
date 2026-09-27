import type {
  ContactKind,
  ExploreRole,
  GroupPreference,
  GroupSize,
  LanguageLevel,
  Mode,
  Setting,
  StudyStyle,
  TimeSlot,
} from './types';

export const MODE_LABELS: Record<Mode, { name: string; emoji: string; tagline: string }> = {
  connect: { name: 'Connect', emoji: '🤝', tagline: 'Find your people.' },
  learn: { name: 'Learn', emoji: '📚', tagline: 'Learn better together.' },
  explore: { name: 'Explore', emoji: '🌎', tagline: 'Make somewhere new feel familiar.' },
};

export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  mornings: 'Mornings',
  afternoons: 'Afternoons',
  evenings: 'Evenings',
  late_nights: 'Late nights',
  weekdays: 'Weekdays',
  weekends: 'Weekends',
};

export const GROUP_SIZE_LABELS: Record<GroupSize, string> = {
  one_on_one: '1-on-1',
  small_group: 'Small groups',
  large_group: 'Larger groups',
};

export const SETTING_LABELS: Record<Setting, string> = {
  online: 'Online',
  in_person: 'In person',
  either: 'Online or in person',
};

export const ROLE_LABELS: Record<ExploreRole, string> = {
  local: 'Local',
  traveler: 'Traveler',
  international_student: 'International student',
  exchange_student: 'Exchange student',
  newcomer: 'Newcomer',
};

export const STUDY_STYLE_LABELS: Record<StudyStyle, string> = {
  quiet_focus: 'Quiet focus',
  discussion: 'Talking it through',
  practice_problems: 'Practice problems',
  teach_back: 'Teaching each other',
};

export const GROUP_PREFERENCE_LABELS: Record<GroupPreference, string> = {
  pair: 'A study partner',
  group: 'A small group',
  either: 'Either works',
};

export const LANGUAGE_LEVEL_LABELS: Record<LanguageLevel, string> = {
  native: 'Native',
  fluent: 'Fluent',
  conversational: 'Conversational',
  learning: 'Learning',
};

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  email: 'Email',
  instagram: 'Instagram',
  discord: 'Discord',
  discord_invite: 'Discord server invite',
  phone: 'Phone',
  other: 'Other',
};

export function listToSentence(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
