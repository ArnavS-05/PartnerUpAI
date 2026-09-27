import { beforeEach, describe, expect, it } from 'vitest';
import { demoSession, resolveUser, switchDemoPersona, type AuthUser } from '../server/auth';
import { connections, mutualState, requestMutual, searchMutual, endMutual, resetConnections, inviteCircle, consentCircle, circlesFor } from '../server/services/connections';
import { DEMO_PROFILE_ID, seedId } from '../server/data/seed';
import { buildCircle } from '../server/services/groupBuilder';
import { setAIProviderForTesting } from '../server/ai/service';
import { draftProfileLocally } from '../server/ai/heuristics';
import { getStore } from '../server/data';
process.env.PERSIST_DEMO_DATA='false';
let arnav:AuthUser;
async function as(id:string){return (await resolveUser(switchDemoPersona(arnav,id).accessToken))!;}
beforeEach(async()=>{arnav=(await resolveUser((await demoSession()).accessToken))!;resetConnections(arnav);setAIProviderForTesting(null);});
describe('Mutual privacy boundaries',()=>{
 it('requires exact full names and never returns incoming identities or contacts',async()=>{
  expect(await searchMutual(arnav,'Sarah John')).toEqual([]);
  const [sarah]=await searchMutual(arnav,'Sarah Johnson');
  expect(Object.keys(sarah).sort()).toEqual(['avatarHue','displayName','id','taken']);
  await requestMutual(arnav,sarah.id);
  const theirs=await mutualState(await as(sarah.id));
  expect(theirs.admirers).toBe(1);expect(theirs.matches).toEqual([]);
  expect(JSON.stringify(theirs)).not.toContain('Arnav');
 });
 it('never calls an AI provider during either independent Mutual choice',async()=>{
  let calls=0;setAIProviderForTesting({name:'spy',async structured(){calls++;throw new Error('Mutual must not call me');}});
  const [sarah]=await searchMutual(arnav,'Sarah Johnson');await requestMutual(arnav,sarah.id);
  const sarahUser=await as(sarah.id);await searchMutual(sarahUser,'Arnav Sawant');await requestMutual(sarahUser,DEMO_PROFILE_ID);
  const mine=await mutualState(arnav);expect(mine.matches).toHaveLength(1);expect(calls).toBe(0);
  expect(mine.matches[0].contacts.every(c=>c.shareOnMatch)).toBe(true);
  await expect(endMutual(arnav,mine.matches[0].id)).rejects.toThrow('24 hours');
  connections().requests.filter(r=>r.status==='mutual').forEach(r=>r.matchedAt=Date.now()-86400001);
  await endMutual(arnav,mine.matches[0].id);expect((await mutualState(sarahUser)).matches).toEqual([]);
 });
 it('does not reveal expired choices and enforces the monthly request cap',async()=>{
  const [sarah]=await searchMutual(arnav,'Sarah Johnson');await requestMutual(arnav,sarah.id);
  connections().requests.find(r=>r.from===DEMO_PROFILE_ID&&r.to===sarah.id)!.expires=Date.now()-1;
  await requestMutual(await as(sarah.id),DEMO_PROFILE_ID);
  expect((await mutualState(arnav)).matches).toHaveLength(0);
  for(const id of [4,5,7,10])await requestMutual(arnav,seedId(id));
  await expect(requestMutual(arnav,seedId(11))).rejects.toThrow('5 requests');
 });
});
describe('Group formation and consent',()=>{
 it('builds all three modes with grounded explanations and no premature contacts',async()=>{
  for(const [mode,text] of [['connect','A small group for robotics and startups with programming skills'],['learn','A study group. I am good at calculus but need help with chemistry.'],['explore','New to Atlanta. A small group of locals who like food and soccer.']] as const){
   const p=await buildCircle(arnav,mode,text);expect(p.mode).toBe(mode);expect(p.members.length).toBeGreaterThan(0);expect(p.source).toBe('local');expect(p.summary.length).toBeGreaterThan(30);expect(JSON.stringify(p)).not.toContain('shareOnMatch');
   if(mode==='learn')expect(p.exchanges.length).toBeGreaterThan(1);
  }
 });
 it('locks every contact until ALL invited accounts independently accept',async()=>{
  const p=await buildCircle(arnav,'connect','A small group for robotics and startups');
  let list=await inviteCircle(arnav,p.id);expect(list[0].members.flatMap(m=>m.contacts)).toEqual([]);
  for(const [i,m] of p.members.entries()){
   const u=await as(m.profile.id);await consentCircle(u,p.id,true);
   list=await circlesFor(arnav);
   if(i<p.members.length-1)expect(list[0].members.flatMap(m=>m.contacts)).toEqual([]);
  }
  expect(list[0].members.every(m=>m.accepted)).toBe(true);expect(list[0].members.flatMap(m=>m.contacts).length).toBeGreaterThan(0);
  expect(list[0].members.flatMap(m=>m.contacts).every(c=>c.shareOnMatch)).toBe(true);
  await expect(consentCircle(await as(seedId(20)),p.id,true)).rejects.toThrow('Group not found');
  await consentCircle(arnav,p.id,false);expect(await circlesFor(arnav)).toEqual([]);
 });
 it('extracts only explicit strengths and preserves learning as a separate field',()=>{
  const d=draftProfileLocally('I am into robotics, F1 and startups. I am good at engineering but still learning programming.','connect');
  expect(d.source).toBe('local');expect(d.profile.skills).not.toContain('Programming');expect(d.learning?.length).toBeGreaterThan(0);
 });
 it('has at least 15 adult fictional candidates',async()=>{
  const candidates=await getStore().getProfiles(Array.from({length:20},(_,i)=>seedId(i+1)));
  expect(candidates.length).toBeGreaterThanOrEqual(15);expect(candidates.every(p=>(p.age??0)>=18)).toBe(true);
 });
});
