// Mutual deliberately has NO dependency on AI or recommendation modules.
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../auth';
import { isDemoUser } from '../auth';
import { getStore } from '../data';
import { getMemoryDb } from '../data/memoryStore';
import { DEMO_PROFILE_ID, seedId } from '../data/seed';
import { toPublicProfile } from '../data/mappers';
import { ApiError } from '../http/errors';
import { requireProfile } from './profiles';
import type { MutualState, Circle, GroupProposal } from '../../shared/connection';
import type { Profile } from '../../shared/types';
import { identityFor, notify } from './naviStore';

interface PrivateRequest { id: string; from: string; to: string; created: number; expires: number; matchedAt?:number; status: 'pending' | 'mutual' | 'expired' | 'withdrawn' | 'ended' }
interface SavedCircle { id: string; owner: string; members: string[]; accepted: string[]; title: string; mode: Circle['mode']; active: boolean }
interface ConnectionDb { requests: PrivateRequest[]; searches: { from: string; to: string; month: string }[]; circles: SavedCircle[]; proposals: Record<string, { owner: string; proposal: GroupProposal }> }
const initial = (): ConnectionDb => ({ requests: [seedId(11), seedId(13)].map(from => ({ id: randomUUID(), from, to: DEMO_PROFILE_ID, created: Date.now(), expires: Date.now() + 30*86400000, status: 'pending' })), searches: Array.from({length:8}, (_,i) => ({ from: seedId(i+2), to: DEMO_PROFILE_ID, month: new Date().toISOString().slice(0,7) })), circles: [], proposals: {} });
type GlobalDb = typeof globalThis & { __connections?: ConnectionDb };
export function connections(): ConnectionDb {
  const g = globalThis as GlobalDb;
  if (!g.__connections) {
    g.__connections = initial();
  }
  return g.__connections!;
}
export function persistConnections(): void { /* Prisma commits at the API transaction boundary. */ }
function expire() { for (const r of connections().requests) if (r.status === 'pending' && r.expires <= Date.now()) r.status = 'expired'; }
const person = (p: Profile) => ({ id:p.id, displayName:p.displayName, avatarHue:p.avatarHue });
const limit = () => Math.max(1, Number(process.env.MUTUAL_MONTHLY_LIMIT) || 5);
const ttl = () => Math.max(1, Number(process.env.MUTUAL_REQUEST_DAYS) || 30);
export async function mutualState(user: AuthUser): Promise<MutualState> {
  const me = await requireProfile(user); expire();
  const db = connections(); const store = getStore();
  const sent: MutualState['sent'] = []; const matches: MutualState['matches'] = [];
  for (const r of db.requests.filter(r => r.from === me.id)) {
    const p = await store.getProfile(r.to); if (!p) continue;
    sent.push({ id:r.id, target:person(p), status:r.status, expiresAt:new Date(r.expires).toISOString() });
    if (r.status === 'mutual') matches.push({ id:r.id, partner:person(p), contacts:(await store.listContacts(p.id)).filter(c=>c.shareOnMatch), unlockAt:new Date((r.matchedAt??r.created)+86400000).toISOString() });
  }
  return { searches:db.searches.filter(s=>s.to===me.id && s.month===new Date().toISOString().slice(0,7)).length, admirers:db.requests.filter(r=>r.to===me.id && r.status==='pending').length, sent, matches, limit:limit(), ttl:ttl(),remaining:Math.max(0,limit()-db.requests.filter(r=>r.from===me.id && r.created>Date.now()-30*86400000).length) };
}
export async function searchMutual(user: AuthUser, name: string) {
  const me=await requireProfile(user);
  if (name.trim().split(/\s+/).length<2) throw new ApiError(400,'full_name','Enter their first and last name.');
  // Local account directory; a production store should implement an indexed exact-name query.
  const normalize=(n:string)=>n.trim().replace(/\s+/g,' ').toLocaleLowerCase();
  const identity=identityFor(me.id);
  if(!identity)throw new ApiError(409,'identity_required','Set up your name, age and gender before using Mutual.');
  const people=getMemoryDb().profiles.filter(p=>p.id!==me.id && p.age!==null && p.age>=18 && identityFor(p.id)?.gender && identityFor(p.id)?.gender!==identity.gender && normalize(p.displayName)===normalize(name));
  const month=new Date().toISOString().slice(0,7);
  for (const p of people) if (!connections().searches.some(s=>s.from===me.id && s.to===p.id && s.month===month)) {connections().searches.push({from:me.id,to:p.id,month});notify(p.id,'A little mystery','You appeared in a private search. No names, no clues.','mutual');}
  persistConnections(); return people.map(p=>({...person(p),taken:connections().requests.some(r=>r.from===p.id&&r.status==='mutual')}));
}
export async function requestMutual(user: AuthUser, target: string) {
  const me=await requireProfile(user); const other=await getStore().getProfile(target); expire();
  if (!other || target===me.id || !me.age || me.age<18 || !other.age || other.age<18) throw new ApiError(400,'invalid_person','Mutual is for adult accounts, and you must choose another person.');
  if(!identityFor(me.id)||!identityFor(target)||identityFor(me.id)?.gender===identityFor(target)?.gender)throw new ApiError(400,'gender_filter','Mutual only shows people of the opposite gender.');
  const db=connections();
  if (db.requests.some(r=>r.from===me.id && r.to===target && ['pending','mutual'].includes(r.status))) return mutualState(user);
  if(db.requests.some(r=>(r.from===me.id||r.from===target)&&r.status==='mutual'))throw new ApiError(409,'taken','One of you is Taken. Requests are unavailable until that match ends.');
  const start=Date.now()-30*86400000;
  if(db.requests.filter(r=>r.from===me.id && r.created>=start).length>=limit()) throw new ApiError(429,'request_limit',`You have used your ${limit()} requests in the last 30 days.`);
  const reciprocal=db.requests.find(r=>r.from===target && r.to===me.id && r.status==='pending');
  db.requests.push({id:randomUUID(),from:me.id,to:target,created:Date.now(),expires:Date.now()+ttl()*86400000,status:reciprocal?'mutual':'pending',matchedAt:reciprocal?Date.now():undefined});
  if(reciprocal){reciprocal.status='mutual';reciprocal.matchedAt=Date.now();notify(me.id,'It’s Mutual.',`${other.displayName} chose you too. Your approved contacts are now shared.`,'mutual');notify(target,'It’s Mutual.',`${me.displayName} chose you too. Your approved contacts are now shared.`,'mutual');} persistConnections(); return mutualState(user);
}
export async function endMutual(user: AuthUser, id: string) {
  const me=await requireProfile(user); const r=connections().requests.find(r=>r.id===id && r.from===me.id);
  if(!r) throw new ApiError(404,'not_found','Request not found.');
  if(r.status==='mutual'&&Date.now()<(r.matchedAt??r.created)+86400000)throw new ApiError(409,'match_locked','A Mutual match can be ended after 24 hours.');
  if(r.status==='mutual') for(const other of connections().requests) if(other.from===r.to && other.to===r.from && other.status==='mutual') other.status='ended';
  r.status=r.status==='mutual'?'ended':'withdrawn'; persistConnections(); return mutualState(user);
}
export async function circlesFor(user:AuthUser):Promise<Circle[]> {
  const me=await requireProfile(user); const store=getStore(); const list:Circle[]=[];
  for(const c of connections().circles.filter(c=>c.members.includes(me.id) && c.active)) {
    const all=c.members.every(id=>c.accepted.includes(id));
    const profiles=await store.getProfiles(c.members);
    list.push({id:c.id,ownerId:c.owner,title:c.title,mode:c.mode,active:c.active,members:await Promise.all(profiles.map(async p=>({profile:toPublicProfile(p),accepted:c.accepted.includes(p.id),contacts:all?(await store.listContacts(p.id)).filter(x=>x.shareOnMatch):[]})))});
  } return list;
}
export async function inviteCircle(user:AuthUser,id:string) {
  const me=await requireProfile(user); const stored=connections().proposals[id];
  if(!stored || stored.owner!==me.id) throw new ApiError(404,'not_found','Build a fresh group first.');
  const p=stored.proposal;
  if(!connections().circles.some(c=>c.id===id)) connections().circles.push({id,owner:me.id,members:[me.id,...p.members.map(m=>m.profile.id)],accepted:[me.id],mode:p.mode,title:p.title,active:true});
  persistConnections(); return circlesFor(user);
}
export async function consentCircle(user:AuthUser,id:string,accept:boolean) {
  const me=await requireProfile(user); const c=connections().circles.find(c=>c.id===id && c.members.includes(me.id) && c.active);
  if(!c) throw new ApiError(404,'not_found','Group not found.');
  if(!accept)c.active=false; else if(!c.accepted.includes(me.id))c.accepted.push(me.id);
  persistConnections(); return circlesFor(user);
}
export function resetConnections(user:AuthUser) { if(!isDemoUser(user))throw new ApiError(403,'demo_only','Only demo accounts can reset the demo.'); (globalThis as GlobalDb).__connections=initial(); persistConnections(); return {ok:true}; }
