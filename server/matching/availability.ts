import type { TimeSlot } from '../../shared/types';

const TIMES_OF_DAY: TimeSlot[] = ['mornings', 'afternoons', 'evenings', 'late_nights'];
const DAY_TYPES: TimeSlot[] = ['weekdays', 'weekends'];

/** Partial credit for adjacent times of day ("evenings" ≈ "late nights"). */
const ADJACENT: Partial<Record<TimeSlot, Partial<Record<TimeSlot, number>>>> = {
  evenings: { late_nights: 0.6, afternoons: 0.3 },
  late_nights: { evenings: 0.6 },
  afternoons: { evenings: 0.3, mornings: 0.3 },
  mornings: { afternoons: 0.3 },
};

function slotSimilarity(a: TimeSlot, b: TimeSlot): number {
  if (a === b) return 1;
  return ADJACENT[a]?.[b] ?? 0;
}

function directional(wanted: TimeSlot[], offered: TimeSlot[]): number | null {
  if (wanted.length === 0 || offered.length === 0) return null;
  let total = 0;
  for (const w of wanted) total += Math.max(...offered.map((o) => slotSimilarity(w, o)));
  return total / wanted.length;
}

function part(a: TimeSlot[], b: TimeSlot[], requested: boolean): number | null {
  if (a.length === 0 || b.length === 0) return null;
  if (requested) return directional(a, b);
  // Overlap coefficient: how well the smaller schedule fits inside the larger one.
  const [small, large] = a.length <= b.length ? [a, b] : [b, a];
  return directional(small, large);
}

/**
 * Availability compatibility, 0..1. Times of day and day types are scored
 * separately (they're orthogonal) and averaged. When the seeker explicitly
 * asked for a time ("at night"), we score directionally: is the other person
 * free when they asked?
 */
export function availabilityScore(a: TimeSlot[], b: TimeSlot[], requested = false): number {
  const aTimes = a.filter((s) => TIMES_OF_DAY.includes(s));
  const bTimes = b.filter((s) => TIMES_OF_DAY.includes(s));
  const aDays = a.filter((s) => DAY_TYPES.includes(s));
  const bDays = b.filter((s) => DAY_TYPES.includes(s));
  const parts = [part(aTimes, bTimes, requested), part(aDays, bDays, requested)].filter((x): x is number => x !== null);
  if (parts.length === 0) return 0.5; // Unknown schedules — neutral.
  return parts.reduce((s, x) => s + x, 0) / parts.length;
}

export function availabilityOverlap(a: TimeSlot[], b: TimeSlot[]): TimeSlot[] {
  return a.filter((slot) => b.includes(slot));
}
