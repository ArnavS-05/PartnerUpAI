import type { ConceptTag } from '../../shared/types';
import { CONCEPTS, CONCEPT_BY_ID, type ConceptDef } from './ontology';

// ─── Normalisation & alias index ───────────────────────────────────────────

export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9+&/' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(input: string): string {
  return normalizeText(input).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const ALIAS_TO_ID = new Map<string, string>();
for (const concept of CONCEPTS) {
  for (const alias of [concept.label, concept.id.replace(/-/g, ' '), ...(concept.aliases ?? [])]) {
    const key = normalizeText(alias);
    if (key && !ALIAS_TO_ID.has(key)) ALIAS_TO_ID.set(key, concept.id);
  }
}
/** Longest aliases first so "meet international students" wins over "international student". */
const ALIASES_BY_LENGTH = [...ALIAS_TO_ID.entries()].sort((a, b) => b[0].length - a[0].length);

// ─── Canonicalisation ──────────────────────────────────────────────────────

/** Map a free-text term to a concept id (known concept or a stable slug). */
export function canonicalize(term: string): string {
  const key = normalizeText(term);
  if (!key) return '';
  const direct = ALIAS_TO_ID.get(key) ?? (key.endsWith('s') ? ALIAS_TO_ID.get(key.slice(0, -1)) : undefined);
  if (direct) return direct;
  const inside = extractConcepts(key);
  if (inside.length === 1) return inside[0];
  return slugify(term);
}

export function canonicalizeAll(terms: readonly string[]): string[] {
  const out: string[] = [];
  for (const term of terms) {
    const id = canonicalize(term);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Find every known concept mentioned in free text, in reading order. */
export function extractConcepts(text: string): string[] {
  let padded = ` ${normalizeText(text)} `;
  const hits: Array<{ pos: number; id: string }> = [];
  for (const [alias, id] of ALIASES_BY_LENGTH) {
    const needle = ` ${alias} `;
    let from = 0;
    for (;;) {
      const pos = padded.indexOf(needle, from);
      if (pos === -1) break;
      hits.push({ pos, id });
      // Consume the match (keep the bounding spaces) so shorter aliases can't re-match it.
      padded = padded.slice(0, pos + 1) + '#'.repeat(alias.length) + padded.slice(pos + 1 + alias.length);
      from = pos + alias.length;
    }
  }
  hits.sort((a, b) => a.pos - b.pos);
  const ids: string[] = [];
  for (const hit of hits) if (!ids.includes(hit.id)) ids.push(hit.id);
  return ids;
}

export function getConcept(id: string): ConceptDef | undefined {
  return CONCEPT_BY_ID.get(id);
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function conceptLabel(id: string): string {
  return CONCEPT_BY_ID.get(id)?.label ?? titleCase(id);
}

export function toTag(id: string): ConceptTag {
  const concept = CONCEPT_BY_ID.get(id);
  return { id, label: concept?.label ?? titleCase(id), emoji: concept?.emoji ?? '✨' };
}

// ─── Similarity ────────────────────────────────────────────────────────────

function ancestors(id: string): string[] {
  const chain: string[] = [];
  let current = CONCEPT_BY_ID.get(id)?.parent;
  while (current && !chain.includes(current)) {
    chain.push(current);
    current = CONCEPT_BY_ID.get(current)?.parent;
  }
  return chain;
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split('-').filter((t) => t.length > 2));
  const tb = new Set(b.split('-').filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

export interface SimilarityOptions {
  /** Credit for two different concepts in the same broad category (e.g. two games). */
  categoryCredit?: number;
}

/**
 * Graded semantic similarity between two concept ids, 0..1.
 *  1.00 identical · 0.85 parent/child · 0.75 explicitly related
 *  0.55 siblings · 0.40 cousins · categoryCredit same category.
 */
export function conceptSimilarity(a: string, b: string, options: SimilarityOptions = {}): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ca = CONCEPT_BY_ID.get(a);
  const cb = CONCEPT_BY_ID.get(b);
  if (!ca || !cb) return tokenOverlap(a, b) * 0.7;

  const ancA = ancestors(a);
  const ancB = ancestors(b);
  const depthAinB = ancB.indexOf(a);
  const depthBinA = ancA.indexOf(b);
  if (depthAinB >= 0) return Math.max(0.6, 0.85 - 0.1 * depthAinB);
  if (depthBinA >= 0) return Math.max(0.6, 0.85 - 0.1 * depthBinA);

  if (ca.related?.includes(b) || cb.related?.includes(a)) return 0.75;
  if (ancA[0] && ancA[0] === ancB[0]) return 0.55;
  if (ancA.some((x) => ancB.includes(x))) return 0.4;
  if (ca.category === cb.category) return options.categoryCredit ?? 0;
  return 0;
}

/**
 * The concept two terms genuinely share: the term itself when identical, or
 * the more general one when one is a kind of the other (Music ⊃ Jazz).
 */
export function commonConcept(a: string, b: string): string | null {
  if (a === b) return a;
  if (ancestors(b).includes(a)) return a;
  if (ancestors(a).includes(b)) return b;
  return null;
}

export interface BestMatch {
  score: number;
  match: string | null;
}

export function bestMatch(term: string, pool: readonly string[], options?: SimilarityOptions): BestMatch {
  let best: BestMatch = { score: 0, match: null };
  for (const candidate of pool) {
    const score = conceptSimilarity(term, candidate, options);
    if (score > best.score) best = { score, match: candidate };
    if (score === 1) break;
  }
  return best;
}

/**
 * How well `pool` covers what `wanted` asks for: mean over wanted items of the
 * best similarity found in pool. Returns null when nothing is wanted.
 */
export function coverage(wanted: readonly string[], pool: readonly string[], options?: SimilarityOptions): number | null {
  if (wanted.length === 0) return null;
  let total = 0;
  for (const term of wanted) total += bestMatch(term, pool, options).score;
  return total / wanted.length;
}

export interface OverlapPair {
  a: string;
  b: string;
  score: number;
}

/**
 * Soft overlap between two sets. Greedy one-to-one pairing by similarity;
 * saturates once `target` strong shared items are found (3 by default), so a
 * person with 12 interests isn't penalised versus someone with 4.
 */
export function softOverlap(
  a: readonly string[],
  b: readonly string[],
  options: SimilarityOptions & { target?: number; minPairScore?: number } = {},
): { score: number; pairs: OverlapPair[] } {
  if (a.length === 0 || b.length === 0) return { score: 0, pairs: [] };
  const candidates: OverlapPair[] = [];
  for (const x of a) {
    for (const y of b) {
      const s = conceptSimilarity(x, y, options);
      if (s >= (options.minPairScore ?? 0.25)) candidates.push({ a: x, b: y, score: s });
    }
  }
  candidates.sort((p, q) => q.score - p.score || p.a.localeCompare(q.a));
  const usedA = new Set<string>();
  const usedB = new Set<string>();
  const pairs: OverlapPair[] = [];
  for (const pair of candidates) {
    if (usedA.has(pair.a) || usedB.has(pair.b)) continue;
    usedA.add(pair.a);
    usedB.add(pair.b);
    pairs.push(pair);
  }
  const target = Math.max(1, Math.min(options.target ?? 3, a.length, b.length));
  const sum = pairs.reduce((acc, p) => acc + p.score, 0);
  return { score: Math.min(1, sum / target), pairs };
}
