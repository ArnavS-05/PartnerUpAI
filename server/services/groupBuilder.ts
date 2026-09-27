import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../auth';
import type { Mode, MatchCard, ModeProfile } from '../../shared/types';
import type { GroupProposal } from '../../shared/connection';
import { discover } from './matching';
import { requireProfile } from './profiles';
import { getStore } from '../data';
import { canonicalize } from '../semantic/similarity';
import { generateGroupSummary } from '../ai/service';
import { connections, persistConnections } from './connections';

function exchanges(members: {id:string;name:string;mp:ModeProfile|undefined}[]) {
  const edges:GroupProposal['exchanges']=[];
  for(const a of members)for(const b of members){
    if(a.id===b.id)continue;
    const ad=a.mp?.details, bd=b.mp?.details;
    const strengths=ad?.kind==='learn'?ad.strengths:a.mp?.offers??[];
    const needs=bd?.kind==='learn'?bd.needs:b.mp?.seeks??[];
    for(const need of needs)if(strengths.some(s=>canonicalize(s)===canonicalize(need)))edges.push({from:a.name,to:b.name,subject:need});
  }return edges;
}
export async function buildCircle(user:AuthUser,mode:Mode,text:string,scope?:(card:MatchCard)=>boolean,count?:number):Promise<GroupProposal>{
  const me=await requireProfile(user); const store=getStore();
  const found=await discover(user,{mode,text});
  const actual=found.mode;
  const n=count??Math.min(5,Math.max(1,(found.intent?.groupSizeMax??4)-1));
  const pool=found.results.filter(r=>r.match.score>=25&&(!scope||scope(r))).slice(0,12);
  const profiles=await Promise.all([me.id,...pool.map(m=>m.profile.id)].map(async id=>({id,mps:await store.listModeProfiles(id)})));
  const mp=(id:string)=>profiles.find(p=>p.id===id)?.mps.find(m=>m.mode===actual);
  const memberData=(c:MatchCard[])=>[{id:me.id,name:me.displayName,mp:mp(me.id)},...c.map(m=>({id:m.profile.id,name:m.profile.displayName,mp:mp(m.profile.id)}))];
  let best:MatchCard[]=[]; let bestValue=-1;
  // Exhaustive small-pool group optimization rewards mutual coverage, not just top individual scores.
  const visit=(i:number,chosen:MatchCard[])=>{
    if(chosen.length===Math.min(n,pool.length)){
      const edges=exchanges(memberData(chosen));
      const contributors=new Set(edges.map(e=>e.from)).size;
      const learners=new Set(edges.map(e=>e.to)).size;
      const skills=new Set(chosen.flatMap(c=>c.profile.skills.map(canonicalize))).size;
      const pair=chosen.reduce((sum,c)=>sum+c.match.score,0)/Math.max(1,chosen.length);
      const value=actual==='learn'?pair*.35+(contributors+learners)/(chosen.length+1)*32.5:pair+Math.min(12,skills);
      if(value>bestValue){bestValue=value;best=[...chosen];}return;
    }
    for(let j=i;j<pool.length;j++)visit(j+1,[...chosen,pool[j]]);
  };visit(0,[]);
  const edges=exchanges(memberData(best));
  const counts=new Map<string,number>();
  for(const p of [me,...best.map(m=>m.profile)])for(const interest of new Set(p.interests))counts.set(interest,(counts.get(interest)??0)+1);
  const shared=[...counts].filter(([,v])=>v>=2).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k);
  const caveats:string[]=[];
  if(best.length<n)caveats.push(`Only ${best.length} suitable people are available in this demo. Try a broader request for more options.`);
  if(actual==='learn')for(const m of memberData(best)){
    if(!edges.some(e=>e.from===m.name))caveats.push(`${m.name}'s contribution is not covered by the group's current learning needs.`);
    if(!edges.some(e=>e.to===m.name))caveats.push(`${m.name}'s learning needs aren't fully covered yet.`);
  }
  const fallback=actual==='learn'?`This group has ${edges.length} strength-to-need connections. ${edges.slice(0,3).map(e=>`${e.from.split(' ')[0]} brings ${e.subject} for ${e.to.split(' ')[0]}`).join('; ')}.`:actual==='explore'?`A small circle around ${found.intent?.location??me.city??'your destination'}, with shared interests in ${shared.slice(0,3).join(', ')||'local experiences'}. Check each person's availability before choosing your first outing.`:`You share ${shared.slice(0,3).join(', ')||'an interest in meeting new people'}, while bringing different skills: ${[...new Set(best.flatMap(c=>c.profile.skills))].slice(0,4).join(', ')}.`;
  const summary=await generateGroupSummary({mode:actual,shared,exchanges:edges,members:best.map(m=>({name:m.profile.displayName,skills:m.profile.skills,reasons:m.match.reasons})),caveats},fallback);
  const result:GroupProposal={id:randomUUID(),mode:actual,title:actual==='learn'?'The study exchange':actual==='explore'?'A little more local':'The builders’ circle',...summary,intentSource:found.intent?.source??'local',members:best,shared,exchanges:edges,caveats,size:best.length+1};
  connections().proposals[result.id]={owner:me.id,proposal:result};persistConnections();return result;
}
