import type { GroupMember, MissingPartnerSuggestion, StudyGroupSuggestion, SubjectCoverage } from '../../shared/types';
import { listToSentence } from '../../shared/labels';
import { toPublicProfile } from '../data/mappers';
import { bestMatch, conceptLabel, toTag } from '../semantic/similarity';
import { availabilityScore } from './availability';
import type { Side } from './side';

// Group complementarity (LEARN). A good study group is one where the members
// *collectively* cover the requested subjects and every member both gives and
// gets something. Greedy selection is plenty for groups of 3–4.

const STRONG = 0.75;

function subjectCoverage(members: Side[], subject: string): { coverage: number; by: Side[] } {
  let best = 0;
  let by: Side[] = [];
  for (const m of members) {
    const s = bestMatch(subject, m.strengths).score;
    if (s > best + 1e-9) {
      best = s;
      by = [m];
    } else if (s >= STRONG && Math.abs(s - best) < 1e-9) {
      by.push(m);
    }
  }
  return { coverage: best, by: best >= STRONG ? by : [] };
}

interface Exchange {
  gives: Array<{ subject: string; to: Side }>;
  gets: Array<{ subject: string; from: Side }>;
}

function exchanges(member: Side, members: Side[]): Exchange {
  const others = members.filter((m) => m !== member);
  const gives: Exchange['gives'] = [];
  const gets: Exchange['gets'] = [];
  for (const other of others) {
    for (const need of other.needs) {
      if (bestMatch(need, member.strengths).score >= STRONG) gives.push({ subject: need, to: other });
    }
  }
  for (const need of member.needs) {
    const helper = others.find((o) => bestMatch(need, o.strengths).score >= STRONG);
    if (helper) gets.push({ subject: need, from: helper });
  }
  return { gives, gets };
}

function reciprocity(members: Side[]): number {
  if (members.length < 2) return 0;
  let total = 0;
  for (const m of members) {
    const ex = exchanges(m, members);
    const gives = ex.gives.length > 0 ? 1 : 0;
    const gets = m.needs.length === 0 ? 0.5 : ex.gets.length / m.needs.length;
    total += 0.5 * gives + 0.5 * gets;
  }
  return total / members.length;
}

function groupAvailability(members: Side[]): number {
  if (members.length < 2) return 1;
  const common = members[0].availability.filter((slot) => members.every((m) => m.availability.includes(slot)));
  if (common.length > 0) return 1;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      total += availabilityScore(members[i].availability, members[j].availability);
      pairs++;
    }
  }
  return total / pairs;
}

/** How evenly the requested subjects are carried (1 = everyone covers the same number). */
function balance(members: Side[], subjects: string[]): number {
  if (members.length < 2 || subjects.length === 0) return 1;
  const counts = members.map((m) => subjects.filter((s) => bestMatch(s, m.strengths).score >= STRONG).length);
  const max = Math.max(...counts);
  return max === 0 ? 0 : Math.min(...counts) / max;
}

/**
 * Group complementarity (0..1):
 *   45% subject coverage · 30% reciprocity (everyone gives & gets)
 *   15% shared availability · 10% balance of contributions
 */
export function groupObjective(members: Side[], subjects: string[]): number {
  const cov = subjects.length
    ? subjects.reduce((sum, s) => sum + subjectCoverage(members, s).coverage, 0) / subjects.length
    : 0;
  return 0.45 * cov + 0.3 * reciprocity(members) + 0.15 * groupAvailability(members) + 0.1 * balance(members, subjects);
}

function describeMembers(members: Side[], me: Side): GroupMember[] {
  return members.map((m) => {
    const ex = exchanges(m, members);
    const name = (s: Side) => (s === me ? 'you' : s.firstName);
    return {
      profile: toPublicProfile(m.profile),
      isYou: m === me,
      strengths: m.strengths.slice(0, 4).map(toTag),
      needs: m.needs.slice(0, 3).map(toTag),
      gives: ex.gives.slice(0, 3).map((g) => `${conceptLabel(g.subject)} for ${name(g.to)}`),
      gets: ex.gets.slice(0, 3).map((g) => `${conceptLabel(g.subject)} from ${name(g.from)}`),
    };
  });
}

export function coverageReport(members: Side[], subjects: string[], me: Side): SubjectCoverage[] {
  return subjects.map((subject) => {
    const c = subjectCoverage(members, subject);
    return {
      subject: toTag(subject),
      coverage: Math.round(c.coverage * 100) / 100,
      coveredBy: c.by.map((m) => (m === me ? 'You' : m.firstName)),
    };
  });
}

export function buildStudyGroup(me: Side, pool: Side[], subjects: string[], size: number): StudyGroupSuggestion {
  const target = Math.max(2, Math.min(4, size));
  const members: Side[] = [me];
  const available = pool.filter((p) => p.profile.id !== me.profile.id);

  while (members.length < target) {
    let best: { side: Side; value: number } | null = null;
    for (const candidate of available) {
      if (members.includes(candidate)) continue;
      const value = groupObjective([...members, candidate], subjects);
      if (!best || value > best.value + 1e-9 || (Math.abs(value - best.value) < 1e-9 && candidate.profile.id < best.side.profile.id)) {
        best = { side: candidate, value };
      }
    }
    if (!best) break;
    members.push(best.side);
  }

  const coverage = coverageReport(members, subjects, me);
  const weakest = [...coverage].sort((a, b) => a.coverage - b.coverage)[0];
  const missing = weakest && weakest.coverage < STRONG ? weakest : null;
  const everyoneGives = members.every((m) => exchanges(m, members).gives.length > 0);
  const complementarity = Math.round(groupObjective(members, subjects) * 100);

  const covered = coverage.filter((c) => c.coverage >= STRONG).map((c) => c.subject.label);
  let explanation: string;
  if (everyoneGives && !missing) {
    explanation =
      balance(members, subjects) >= 0.5
        ? `Every member contributes a strength another member needs, creating a balanced ${members.length}-person learning group.`
        : `Every member contributes a strength another member needs. You carry the most subjects yourself — a 4th member would spread the load.`;
  } else if (missing) {
    explanation = `This group has strong coverage of ${listToSentence(covered) || 'some of your subjects'}. Adding someone strong in ${missing.subject.label} would make it more balanced.`;
  } else {
    explanation = `Together you cover ${listToSentence(covered)}. Not everyone has a gap someone else fills yet — but the knowledge coverage is strong.`;
  }

  return {
    subjects: subjects.map(toTag),
    members: describeMembers(members, me),
    coverage,
    complementarity,
    explanation,
    missing,
  };
}

export function findMissingPartner(
  me: Side,
  members: Side[],
  pool: Side[],
  subject: string,
  subjects: string[],
): MissingPartnerSuggestion {
  const memberIds = new Set(members.map((m) => m.profile.id));
  let best: { side: Side; skill: number; value: number } | null = null;
  for (const candidate of pool) {
    if (memberIds.has(candidate.profile.id)) continue;
    const skill = bestMatch(subject, candidate.strengths).score;
    if (skill < STRONG) continue;
    const value = groupObjective([...members, candidate], subjects);
    if (!best || skill > best.skill + 1e-9 || (Math.abs(skill - best.skill) < 1e-9 && value > best.value)) {
      best = { side: candidate, skill, value };
    }
  }
  if (!best) return { subject: toTag(subject), candidate: null, coverageAfter: subjectCoverage(members, subject).coverage };
  const group = [...members, best.side];
  const described = describeMembers(group, me).find((m) => m.profile.id === best.side.profile.id) ?? null;
  return { subject: toTag(subject), candidate: described, coverageAfter: subjectCoverage(group, subject).coverage };
}
