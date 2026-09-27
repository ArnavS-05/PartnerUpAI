import { z } from 'zod';
import {
  CONTACT_KINDS,
  EXPLORE_ROLES,
  GROUP_PREFERENCES,
  GROUP_SIZES,
  LANGUAGE_LEVELS,
  MODES,
  SETTINGS,
  STUDY_STYLES,
  TIME_SLOTS,
} from '../../shared/types';

// Server-side validation + sanitisation for every write. The client is never
// trusted: strings are trimmed, control characters stripped, lengths capped.

// Intentionally matches control characters so they can be stripped.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const text = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim())
    .pipe(z.string().max(max, `must be at most ${max} characters`));

const nullableText = (max: number) =>
  z
    .union([text(max), z.null()])
    .optional()
    .transform((v) => (v ? v : null));

const tagList = (maxItems = 20) =>
  z
    .array(text(48))
    .max(maxItems)
    .transform((items) => {
      const seen = new Set<string>();
      return items.filter((item) => {
        const key = item.toLowerCase();
        if (!item || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });

export const ModeSchema = z.enum(MODES);
export const UuidSchema = z.string().uuid('must be a valid id');

export const ProfileInputSchema = z.object({
  displayName: text(60).pipe(z.string().min(1, 'is required')),
  age: z.union([z.number().int().min(13, 'must be at least 13').max(120), z.null()]).optional().transform((v) => v ?? null),
  pronouns: nullableText(30),
  community: nullableText(80),
  city: nullableText(80),
  bio: text(600).default(''),
  interests: tagList().default([]),
  skills: tagList().default([]),
  languages: z
    .array(z.object({ language: text(40).pipe(z.string().min(1)), level: z.enum(LANGUAGE_LEVELS) }))
    .max(10)
    .default([]),
  availability: z.array(z.enum(TIME_SLOTS)).max(6).default([]),
  groupSizes: z.array(z.enum(GROUP_SIZES)).max(3).default([]),
  setting: z.enum(SETTINGS).default('either'),
  visibility: z
    .object({ age: z.boolean(), community: z.boolean(), pronouns: z.boolean() })
    .default({ age: true, community: true, pronouns: true }),
});

const ConnectDetailsSchema = z.object({ kind: z.literal('connect'), activities: tagList() });
const LearnDetailsSchema = z.object({
  kind: z.literal('learn'),
  strengths: tagList(),
  needs: tagList(),
  courses: tagList(10),
  studyStyles: z.array(z.enum(STUDY_STYLES)).max(4),
  groupPreference: z.enum(GROUP_PREFERENCES),
});
const ExploreDetailsSchema = z.object({
  kind: z.literal('explore'),
  role: z.enum(EXPLORE_ROLES),
  exploringCity: nullableText(80),
  origin: nullableText(60),
  activities: tagList(),
});

export const ModeProfileInputSchema = z.object({
  lookingFor: text(280).default(''),
  seeks: tagList(12).default([]),
  offers: tagList(12).default([]),
  details: z.discriminatedUnion('kind', [ConnectDetailsSchema, LearnDetailsSchema, ExploreDetailsSchema]),
  active: z.boolean().default(true),
});

export const ContactsSchema = z.object({
  contacts: z
    .array(z.object({ kind: z.enum(CONTACT_KINDS), value: text(200).pipe(z.string().min(1, 'is required')), shareOnMatch: z.boolean() }))
    .max(8),
});

export const PartnerIntentSchema = z.object({
  mode: ModeSchema,
  summary: text(300),
  seeks: tagList(15),
  offers: tagList(15),
  interests: tagList(15),
  availability: z.array(z.enum(TIME_SLOTS)).max(6),
  groupPreference: z.enum(GROUP_PREFERENCES).nullable(),
  groupSizeMax: z.number().int().min(1).max(10).nullable(),
  setting: z.enum(SETTINGS).nullable(),
  location: nullableText(80),
  role: z.enum(EXPLORE_ROLES).nullable(),
  languagesSpoken: tagList(8),
  languagesLearning: tagList(8),
  followUps: z.array(text(200)).max(2),
  source: z.enum(['ai', 'local']),
});

export const DiscoverSchema = z.object({
  mode: ModeSchema.nullable().optional(),
  text: text(600).optional(),
});

export const MatchTargetSchema = z.object({
  targetId: UuidSchema,
  mode: ModeSchema,
  intent: PartnerIntentSchema.nullable().optional(),
});

export const FeedbackSchema = z.object({
  targetId: UuidSchema,
  mode: ModeSchema,
  value: z.enum(['good', 'not_for_me']),
});

export const ProfileDraftSchema = z.object({
  text: text(1200).pipe(z.string().min(10, 'needs a little more detail')),
  mode: ModeSchema,
});

export const GroupBuildSchema = z.object({
  subjects: tagList(8).optional(),
  size: z.number().int().min(2).max(4).optional(),
});

export const GroupCompleteSchema = z.object({
  memberIds: z.array(UuidSchema).min(1).max(4),
  subjects: tagList(8),
  subject: text(48).pipe(z.string().min(1)),
});

export const GroupPartnerUpSchema = z.object({
  memberIds: z.array(UuidSchema).min(1).max(4),
  subjects: tagList(8),
});

export const CredentialsSchema = z.object({
  email: text(254).pipe(z.string().email('must be a valid email')),
  password: z.string().min(8, 'must be at least 8 characters').max(200),
});
