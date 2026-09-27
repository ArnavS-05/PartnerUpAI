import { z } from 'zod';
import { EXPLORE_ROLES, GROUP_PREFERENCES, MODES, SETTINGS, TIME_SLOTS } from '../../shared/types';

// ─── Output schemas (what the model must return) ───────────────────────────

export const IntentOutput = z.object({
  mode: z.enum(MODES),
  summary: z.string(),
  seeks: z.array(z.string()),
  offers: z.array(z.string()),
  interests: z.array(z.string()),
  availability: z.array(z.enum(TIME_SLOTS)),
  groupPreference: z.enum(GROUP_PREFERENCES).nullable(),
  groupSizeMax: z.number().nullable(),
  setting: z.enum(SETTINGS).nullable(),
  location: z.string().nullable(),
  role: z.enum(EXPLORE_ROLES).nullable(),
  languagesSpoken: z.array(z.string()),
  languagesLearning: z.array(z.string()),
  followUps: z.array(z.string()),
});
export type IntentOutput = z.infer<typeof IntentOutput>;

export const ProfileDraftOutput = z.object({
  bio: z.string(),
  community: z.string().nullable(),
  city: z.string().nullable(),
  age: z.number().nullable(),
  interests: z.array(z.string()),
  skills: z.array(z.string()),
  languagesSpoken: z.array(z.string()),
  languagesLearning: z.array(z.string()),
  availability: z.array(z.enum(TIME_SLOTS)),
  setting: z.enum(SETTINGS).nullable(),
  lookingFor: z.string(),
  seeks: z.array(z.string()),
  offers: z.array(z.string()),
  activities: z.array(z.string()),
  strengths: z.array(z.string()),
  needs: z.array(z.string()),
  courses: z.array(z.string()),
  groupPreference: z.enum(GROUP_PREFERENCES).nullable(),
  role: z.enum(EXPLORE_ROLES).nullable(),
  exploringCity: z.string().nullable(),
});
export type ProfileDraftOutput = z.infer<typeof ProfileDraftOutput>;

export const DnaOutput = z.object({ headline: z.string(), summary: z.string() });
export type DnaOutput = z.infer<typeof DnaOutput>;

export const NarrativeOutput = z.object({ summary: z.string(), ideas: z.array(z.string()) });
export type NarrativeOutput = z.infer<typeof NarrativeOutput>;

export const BridgeOutput = z.object({ starters: z.array(z.string()), firstStep: z.string() });
export type BridgeOutput = z.infer<typeof BridgeOutput>;

// ─── Provider abstraction ──────────────────────────────────────────────────

export interface StructuredRequest<T> {
  /** Stable task name (used for logging/caching). */
  task: string;
  system: string;
  user: string;
  schema: z.ZodType<T>;
}

/**
 * Anything that can turn a prompt into schema-validated JSON. Swap Muse endpoints or use
 * another model by implementing this one method. Providers throw on any
 * failure; callers always have a deterministic fallback.
 */
export interface AIProvider {
  readonly name: string;
  structured<T>(request: StructuredRequest<T>): Promise<T>;
}

export class AIUnavailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'AIUnavailableError';
  }
}
