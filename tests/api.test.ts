import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  DiscoverResponse,
  MatchDetail,
  MatchesResponse,
  MeResponse,
  Partnership,
  PartnerUpResponse,
  StudyGroupSuggestion,
} from '../shared/types';

process.env.PERSIST_DEMO_DATA = 'false';
delete process.env.MUSE_API_KEY;
delete process.env.AI_PROVIDER;

let server: Server;
let base = '';

async function call<T>(method: string, path: string, token?: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json()) as T };
}

beforeAll(async () => {
  const { apiMiddleware } = await import('../server/app');
  server = createServer((req, res) => {
    void apiMiddleware(req, res).then((handled) => {
      if (!handled) {
        res.statusCode = 404;
        res.end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const CONNECT_Q = 'I want someone to play Valorant with at night who also likes F1.';
const LEARN_Q = "I'm good at calculus but struggling with chemistry. I want someone to study with at night.";
const EXPLORE_Q = "I'm an international student who just moved to Atlanta and want someone local to explore the city with.";

describe('demo path', () => {
  let demo = '';

  it('logs into the demo account and loads Partner DNA', async () => {
    const login = await call<{ accessToken: string }>('POST', '/api/auth/demo');
    expect(login.status).toBe(200);
    demo = login.data.accessToken;
    await call('POST', '/api/demo/reset', demo);
    const me = await call<MeResponse>('GET', '/api/me', demo);
    expect(me.data.profile?.displayName).toBe('Arnav Sawant');
    expect(me.data.dna?.sections.length).toBeGreaterThan(3);
    expect(me.data.isDemoAccount).toBe(true);
  });

  it('CONNECT: Valorant + F1 at night -> Alex is the top mutual match', async () => {
    const r = await call<DiscoverResponse>('POST', '/api/discover', demo, { text: CONNECT_Q });
    expect(r.data.mode).toBe('connect');
    expect(r.data.results[0].profile.displayName).toBe('Alex Rivera');
    expect(r.data.results[0].match.score).toBeGreaterThanOrEqual(90);
    expect(r.data.results[0].match.mutualIntent?.detected).toBe(true);
    // Privacy: cards never carry contact info.
    const raw = JSON.stringify(r.data);
    expect(raw).not.toContain('alexr.dev');
    expect(raw).not.toContain('@partnerup.test');
  });

  it('LEARN: calculus <-> chemistry -> Maya is a mutual learning match', async () => {
    const r = await call<DiscoverResponse>('POST', '/api/discover', demo, { text: LEARN_Q });
    expect(r.data.mode).toBe('learn');
    const top = r.data.results[0];
    expect(top.profile.displayName).toBe('Maya Chen');
    expect(top.match.mutualIntent?.detected).toBe(true);
    expect(top.match.theyOffer.map((t) => t.label)).toContain('Chemistry');
    expect(top.match.youOffer.map((t) => t.label)).toContain('Calculus');
    // Similarity != compatibility: Ethan needs the same thing and ranks low.
    const ethan = r.data.results.find((c) => c.profile.displayName === 'Ethan Brooks');
    expect(ethan?.match.score ?? 0).toBeLessThan(50);
  });

  it('EXPLORE: new international student in Atlanta -> Jamal (local) with mutual intent', async () => {
    const r = await call<DiscoverResponse>('POST', '/api/discover', demo, { text: EXPLORE_Q });
    expect(r.data.mode).toBe('explore');
    expect(r.data.intent?.location).toBe('Atlanta');
    expect(r.data.results[0].profile.displayName).toBe('Jamal Carter');
    expect(r.data.results[0].match.mutualIntent?.detected).toBe(true);
  });

  it('Partner Up -> mutual -> contacts + Connection Bridge only for the pair', async () => {
    const found = await call<DiscoverResponse>('POST', '/api/discover', demo, { text: CONNECT_Q });
    const alex = found.data.results[0];
    const detail = await call<MatchDetail>('POST', '/api/match/detail', demo, {
      targetId: alex.profile.id,
      mode: 'connect',
      intent: found.data.intent,
    });
    expect(detail.status).toBe(200);
    expect(detail.data.match.score).toBe(alex.match.score);
    expect(detail.data.narrative.ideas.length).toBeGreaterThan(0);

    const up = await call<PartnerUpResponse>('POST', '/api/partner-up', demo, {
      targetId: alex.profile.id,
      mode: 'connect',
      intent: found.data.intent,
    });
    expect(up.data.status).toBe('pending');
    const switched = await call<{ accessToken: string }>('POST', '/api/demo/switch', demo, { id: alex.profile.id });
    const me = await call<MeResponse>('GET', '/api/me', demo);
    const reverse = await call<PartnerUpResponse>('POST', '/api/partner-up', switched.data.accessToken, { targetId: me.data.profile?.id, mode:'connect' });
    expect(reverse.data.status).toBe('mutual');
    up.data.partnershipId = reverse.data.partnershipId;
    const p = await call<Partnership>('GET', `/api/partnerships/${up.data.partnershipId}`, demo);
    expect(p.data.partnerContacts.map((c) => c.value)).toContain('alexr.dev');
    expect(p.data.bridge?.starters.length).toBeGreaterThan(0);

    // A stranger can't see it.
    const stranger = await call<{ accessToken: string }>('POST', '/api/auth/signup', undefined, {
      email: 'stranger@example.test',
      password: 'correct horse battery',
    });
    const denied = await call('GET', `/api/partnerships/${up.data.partnershipId}`, stranger.data.accessToken);
    expect([403, 409]).toContain(denied.status);
  });

  it('shows anonymous incoming interest only; choosing a secret admirer is instantly mutual', async () => {
    const m = await call<MatchesResponse>('GET', '/api/matches', demo);
    expect(m.data.incomingInterest).toBe(2);
    expect(JSON.stringify(m.data)).not.toContain('Sofia');
    const r = await call<DiscoverResponse>('POST', '/api/discover', demo, { mode: 'connect' });
    const priya = r.data.results.find((c) => c.profile.displayName === 'Priya Nair');
    expect(priya?.status).toBe('none'); // her one-sided choice is not leaked
    const up = await call<PartnerUpResponse>('POST', '/api/partner-up', demo, { targetId: priya?.profile.id, mode: 'connect' });
    expect(up.data.status).toBe('mutual');
  });

  it('builds a complementary study group', async () => {
    const g = await call<StudyGroupSuggestion>('POST', '/api/groups/build', demo, {
      subjects: ['Calculus', 'Chemistry', 'Python'],
      size: 3,
    });
    expect(g.status).toBe(200);
    expect(g.data.members).toHaveLength(3);
    expect(g.data.coverage.every((c) => c.coverage >= 0.75)).toBe(true);
  });
});

describe('auth & validation', () => {
  it('rejects unauthenticated access', async () => {
    const r = await call('GET', '/api/me');
    expect(r.status).toBe(401);
  });

  it('validates input server-side', async () => {
    const s = await call<{ accessToken: string }>('POST', '/api/auth/signup', undefined, {
      email: 'new@example.test',
      password: 'long enough pw',
    });
    const bad = await call('PUT', '/api/profile', s.data.accessToken, { displayName: '', age: 5 });
    expect(bad.status).toBe(400);
    const noProfile = await call('POST', '/api/discover', s.data.accessToken, { mode: 'learn' });
    expect(noProfile.status).toBe(409);
  });

  it('new users can onboard, match, and delete their account', async () => {
    const s = await call<{ accessToken: string }>('POST', '/api/auth/signup', undefined, {
      email: 'fresh@example.test',
      password: 'long enough pw',
    });
    const t = s.data.accessToken;
    const created = await call<MeResponse>('PUT', '/api/profile', t, {
      displayName: 'Rin',
      bio: 'New to Atlanta',
      interests: ['Food', 'Photography'],
      languages: [{ language: 'English', level: 'fluent' }],
      availability: ['evenings', 'weekends'],
    });
    expect(created.status).toBe(200);
    const mp = await call<MeResponse>('PUT', '/api/mode-profiles/explore', t, {
      lookingFor: 'Someone local to explore Atlanta with',
      seeks: ['A local friend'],
      offers: [],
      details: { kind: 'explore', role: 'newcomer', exploringCity: 'Atlanta', origin: null, activities: ['Food'] },
    });
    expect(mp.data.modeProfiles).toHaveLength(1);
    const r = await call<DiscoverResponse>('POST', '/api/discover', t, { mode: 'explore' });
    expect(r.data.results.length).toBeGreaterThan(0);
    expect(r.data.results[0].profile.displayName).toBe('Jamal Carter');
    const del = await call('DELETE', '/api/account', t);
    expect(del.status).toBe(200);
    expect((await call('GET', '/api/me', t)).status).toBe(401);
  });

  it('never lets the demo account be deleted', async () => {
    const login = await call<{ accessToken: string }>('POST', '/api/auth/demo');
    expect((await call('DELETE', '/api/account', login.data.accessToken)).status).toBe(403);
  });
});
