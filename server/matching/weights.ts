import type { Mode } from '../../shared/types';

export interface DimensionDef {
  key: string;
  label: string;
  weight: number;
}

/**
 * Intent-aware weights: the same two people score differently depending on
 * what they want to do together. Each mode's weights sum to 1.
 *  - CONNECT: similarity matters most (shared interests, mutual intent).
 *  - LEARN: complementarity matters most (you cover each other's gaps).
 *  - EXPLORE: place + mutual intent (newcomer ↔ local) matter most.
 */
export const MODE_DIMENSIONS: Record<Mode, DimensionDef[]> = {
  connect: [
    { key: 'shared_interests', label: 'Shared interests', weight: 0.35 },
    { key: 'mutual_intent', label: 'Shared goals', weight: 0.25 },
    { key: 'availability', label: 'Availability', weight: 0.2 },
    { key: 'social', label: 'Social fit', weight: 0.1 },
    { key: 'context', label: 'Complementary traits', weight: 0.1 },
  ],
  learn: [
    { key: 'complementary', label: 'Complementary strengths', weight: 0.4 },
    { key: 'mutual_value', label: 'Mutual learning value', weight: 0.25 },
    { key: 'availability', label: 'Availability', weight: 0.15 },
    { key: 'learning_fit', label: 'Learning style fit', weight: 0.1 },
    { key: 'context', label: 'Shared courses & context', weight: 0.1 },
  ],
  explore: [
    { key: 'location', label: 'Location relevance', weight: 0.3 },
    { key: 'mutual_intent', label: 'Mutual intent', weight: 0.2 },
    { key: 'shared_interests', label: 'Shared interests', weight: 0.25 },
    { key: 'availability', label: 'Availability', weight: 0.15 },
    { key: 'language', label: 'Language compatibility', weight: 0.1 },
  ],
};
