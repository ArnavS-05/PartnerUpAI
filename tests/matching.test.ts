import { describe, expect, it } from 'vitest';
import { parseIntentLocally } from '../server/ai/heuristics';
import { recommendPartners, scorePair } from '../server/matching/recommend';
import { canonicalize, conceptSimilarity, extractConcepts } from '../server/semantic/similarity';
import { candidates, demoModeProfile, demoProfile } from './fixtures';

const me = (mode: 'connect' | 'learn' | 'explore') => ({ profile: demoProfile, modeProfile: demoModeProfile(mode) });
const person = (name: string, mode: string) => {
  const c = candidates.find((x) => x.profile.displayName.startsWith(name) && x.modeProfile.mode === mode);
  if (!c) throw new Error(`${name}/${mode} missing from seed`);
  return c;
};

describe('semantic layer', () => {
  it('maps different phrasings to the same concept', () => {
    expect(canonicalize('machine learning')).toBe(canonicalize('AI'));
    expect(canonicalize('orgo')).toBe('organic-chemistry');
    expect(canonicalize('Formula 1')).toBe('formula-1');
  });

  it('grades related concepts', () => {
    expect(conceptSimilarity('chemistry', 'organic-chemistry')).toBeGreaterThan(0.8);
    expect(conceptSimilarity('valorant', 'counter-strike')).toBeGreaterThan(0.5);
    expect(conceptSimilarity('valorant', 'chemistry')).toBe(0);
  });

  it('prefers the longest phrase when extracting', () => {
    expect(extractConcepts('I enjoy meeting international students')).toEqual(['meet-internationals']);
  });
});

describe('intent understanding (offline)', () => {
  it('splits what you offer from what you need', () => {
    const intent = parseIntentLocally("I'm good at calculus but struggling with chemistry. I want someone to study with at night.");
    expect(intent.mode).toBe('learn');
    expect(intent.offers).toContain('calculus');
    expect(intent.seeks).toEqual(['chemistry']);
    expect(intent.availability).toEqual(expect.arrayContaining(['evenings', 'late_nights']));
  });

  it('detects role and city for explore', () => {
    const intent = parseIntentLocally("I'm visiting Tokyo for a week and want to meet someone local who likes food and photography.");
    expect(intent.mode).toBe('explore');
    expect(intent.location).toBe('Tokyo');
    expect(intent.role).toBe('traveler');
    expect(intent.interests).toEqual(expect.arrayContaining(['food', 'photography']));
  });
});

describe('matching engine', () => {
  it('is intent-aware: the same two people score differently per mode', () => {
    const alex = candidates.filter((c) => c.profile.displayName === 'Alex Rivera');
    const connect = scorePair(me('connect'), alex.find((c) => c.modeProfile.mode === 'connect')!, 'connect');
    const learn = scorePair(me('learn'), alex.find((c) => c.modeProfile.mode === 'learn')!, 'learn');
    expect(connect.score - learn.score).toBeGreaterThan(25);
  });

  it('similarity is not compatibility: two people needing the same subject score low in Learn', () => {
    const ethan = scorePair(me('learn'), person('Ethan', 'learn'), 'learn');
    const maya = scorePair(me('learn'), person('Maya', 'learn'), 'learn');
    expect(ethan.caveats.join(' ')).toMatch(/You both need help with Chemistry/);
    expect(maya.score).toBeGreaterThan(ethan.score + 25);
  });

  it('rewards two-way exchange over one-way tutoring', () => {
    const intent = parseIntentLocally("I'm good at calculus but struggling with chemistry.", 'learn');
    const maya = scorePair(me('learn'), person('Maya', 'learn'), 'learn', intent);
    const hannah = scorePair(me('learn'), person('Hannah', 'learn'), 'learn', intent);
    expect(maya.mutualIntent?.detected).toBe(true);
    expect(hannah.mutualIntent?.detected).toBe(false);
    expect(maya.score).toBeGreaterThan(hannah.score);
  });

  it('halves the score when a hard requirement (city) is not met', () => {
    const intent = parseIntentLocally("I just moved to Atlanta and want someone local to explore the city with.");
    const yuki = scorePair(me('explore'), person('Yuki', 'explore'), 'explore', intent);
    expect(yuki.score).toBeLessThan(50);
    expect(yuki.caveats.join(' ')).toMatch(/Tokyo, not Atlanta/);
    expect(yuki.theyOffer.map((t) => t.id)).not.toContain('local-friend');
  });

  it('only claims interests are shared when they genuinely are', () => {
    const recs = recommendPartners(me('connect'), 'connect', null, candidates);
    for (const r of recs) {
      for (const reason of r.match.reasons.filter((x) => x.kind === 'shared' && x.title.startsWith('Both'))) {
        // "Both …" must name a concept on the demo profile (or a parent of one on theirs).
        const concept = reason.title.replace(/^Both (play|follow|love|into) /, '');
        const mine = [...demoProfile.interests, 'Valorant', 'F1', 'Soccer'].map(canonicalize);
        expect(mine).toContain(canonicalize(concept));
      }
    }
  });

  it('returns a deterministic, explainable breakdown whose weights sum to 1', () => {
    for (const mode of ['connect', 'learn', 'explore'] as const) {
      const [top] = recommendPartners(me(mode), mode, null, candidates);
      const weights = top.match.dimensions.reduce((s, d) => s + d.weight, 0);
      expect(weights).toBeCloseTo(1, 5);
      expect(top.match.reasons.length).toBeGreaterThan(0);
      expect(recommendPartners(me(mode), mode, null, candidates)[0].match.score).toBe(top.match.score);
    }
  });
});
