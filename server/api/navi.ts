import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authedRoute, parseBody } from '../http/router';
import { ApiError } from '../http/errors';
import { changeLocalPassword, isDemoUser, type AuthUser } from '../auth';
import { getStore } from '../data';
import { getMemoryDb, persistMemoryDb } from '../data/memoryStore';
import { requireProfile } from '../services/profiles';
import { buildCircle } from '../services/groupBuilder';
import { identityFor, naviDb, notify, sameName, saveNavi } from '../services/naviStore';
import { connections, persistConnections } from '../services/connections';
import { rateLimit } from '../http/rateLimit';
import type { MatchCard, Mode } from '../../shared/types';

export function scoutScope(text:string){
 const lower=text.toLowerCase();
 return (card:MatchCard)=>{
  const hay=[card.profile.bio,...card.profile.interests,...card.profile.skills].join(' ').toLowerCase();
  if(/\bksu\b|kennesaw/i.test(text)&&!/ksu|kennesaw/i.test(card.profile.community??''))return false;
  if(/roommate|room mate|flatmate/.test(lower)&&!/roommate|flatmate|housing/.test(hay))return false;
  if(/programmer|someone.*cod|coding teammate/.test(lower)&&!card.profile.skills.some(s=>/python|program|javascript|software|full stack|code/i.test(s)))return false;
  if(/robotics/.test(lower)&&!/robot|engineering|electronics|programming|python/.test(hay))return false;
  return true;
 };
}
export async function scout(user:AuthUser,text:string,watch=true){
 const me=await requireProfile(user);
 const mode:Mode=/study|calculus|chemistry|language exchange|exam/i.test(text)?'learn':/explor|travel|new to|new in|international student/i.test(text)?'explore':'connect';
 const requested=text.match(/\b([2-6])(?:[ -](?:person|people|member))|\b(?:group|team) of ([2-6])/i);
 const size=requested?Math.max(1,Number(requested[1]??requested[2])-1):/group|crew|people|team of|circle/i.test(text)?3:1;
 const result=await buildCircle(user,mode,text,scoutScope(text),size);
 result.title=result.members.length===1?'Someone you should meet':mode==='learn'?'Your study circle':mode==='explore'?'Your next adventure starts here':'Your next great team';
 if(!result.members.length)result.summary='I’ll keep looking. Your request stays active, and I’ll let you know when someone compatible joins.';
 if(watch){let w=naviDb().watches.find(w=>w.owner===me.id&&w.kind==='scout'&&w.text===text&&w.active);if(!w){w={id:randomUUID(),owner:me.id,kind:'scout',text,active:true,createdAt:new Date().toISOString(),foundIds:result.members.map(m=>m.profile.id)};naviDb().watches.push(w);}result.watchId=w.id;saveNavi();}
 connections().proposals[result.id]={owner:me.id,proposal:result};persistConnections();return result;
}
export async function rescanWatches(skipOwner?:string){
 const db=getMemoryDb();let found=0;
 for(const w of naviDb().watches.filter(w=>w.active&&w.owner!==skipOwner)){
  const owner=db.profiles.find(p=>p.id===w.owner);if(!owner?.userId)continue;
  if(w.kind==='mutual'){
   const p=db.profiles.find(p=>p.id!==w.owner&&sameName(p.displayName,w.text)&&identityFor(p.id)?.gender&&identityFor(p.id)?.gender!==identityFor(w.owner)?.gender);
   if(p&&!w.foundIds.includes(p.id)){w.foundIds.push(p.id);notify(w.owner,`${p.displayName} joined Partner Up`,'You can now search privately. No request has been sent for you.','mutual');notify(p.id,'Your profile is live','Private connections may be waiting. Explore Mutual whenever you’re ready.','mutual');found++;}
  }else{
   const p=await scout({id:owner.userId,email:null},w.text,false);const fresh=p.members.filter(m=>!w.foundIds.includes(m.profile.id));
   if(fresh.length){w.foundIds.push(...fresh.map(m=>m.profile.id));notify(w.owner,'Muse found someone.',`A new fit for “${w.text}”. Review the suggestion before choosing to connect.`,'groups');found++;}
  }
 }saveNavi();return found;
}
export function registerNavi(){
 authedRoute('POST','/api/account/password',async({user,body})=>{rateLimit(`password:${user.id}`,5);const b=parseBody(z.object({current:z.string().min(1).max(200),next:z.string().min(8).max(200)}),body);changeLocalPassword(user,b.current,b.next);return{ok:true};});
 authedRoute('GET','/api/navi/state',async({user})=>{const me=await requireProfile(user);return{identity:identityFor(me.id)??null,watches:naviDb().watches.filter(w=>w.owner===me.id),notices:naviDb().notices.filter(n=>n.owner===me.id)};});
 authedRoute('POST','/api/identity',async({user,body})=>{
  const me=await requireProfile(user);if(identityFor(me.id))throw new ApiError(409,'immutable_identity','Identity is already set and cannot be changed.');
  const b=parseBody(z.object({gender:z.enum(['man','woman']),phone:z.string().trim().max(80),instagram:z.string().trim().max(80)}),body);
  if(!me.age||me.age<18||me.displayName.trim().split(/\s+/).length<2)throw new ApiError(400,'identity','Enter your full name and an adult age.');
  if(!b.phone&&!b.instagram)throw new ApiError(400,'contact','Add a phone number or Instagram for contact exchange.');
  naviDb().identities[me.id]={name:me.displayName,age:me.age,gender:b.gender};saveNavi();
  await getStore().replaceContacts(me.id,[...(b.phone?[{kind:'phone' as const,value:b.phone,shareOnMatch:true}]:[]),...(b.instagram?[{kind:'instagram' as const,value:b.instagram,shareOnMatch:true}]:[])]);
  await rescanWatches();return{ok:true};
 });
 authedRoute('POST','/api/scout',async({user,body})=>{rateLimit(`scout:${user.id}`,30);const result=await scout(user,parseBody(z.object({text:z.string().trim().min(3).max(2000)}),body).text);await rescanWatches((await requireProfile(user)).id);return result;});
 authedRoute('POST','/api/watches/name',async({user,body})=>{const me=await requireProfile(user);const {name}=parseBody(z.object({name:z.string().trim().min(3).max(80)}),body);if(name.split(/\s+/).length<2)throw new ApiError(400,'full_name','Enter a first and last name.');if(!naviDb().watches.some(w=>w.owner===me.id&&w.kind==='mutual'&&sameName(w.text,name)&&w.active))naviDb().watches.push({id:randomUUID(),owner:me.id,kind:'mutual',text:name,active:true,createdAt:new Date().toISOString(),foundIds:[]});saveNavi();return{ok:true};});
 authedRoute('POST','/api/watches/pause',async({user,body})=>{const me=await requireProfile(user);const {id}=parseBody(z.object({id:z.string().uuid()}),body);const w=naviDb().watches.find(w=>w.id===id&&w.owner===me.id);if(!w)throw new ApiError(404,'not_found','Request not found.');w.active=!w.active;saveNavi();return{ok:true};});
 authedRoute('POST','/api/notices/read',async({user})=>{const me=await requireProfile(user);naviDb().notices.filter(n=>n.owner===me.id).forEach(n=>n.read=true);saveNavi();return{ok:true};});
 authedRoute('POST','/api/demo/advance-day',async({user})=>{if(!isDemoUser(user))throw new ApiError(403,'demo_only','Demo only.');const me=await requireProfile(user);for(const r of connections().requests)if(r.status==='mutual'&&(r.from===me.id||r.to===me.id))r.matchedAt=Date.now()-86400001;persistConnections();return{ok:true};});
 authedRoute('POST','/api/demo/new-person',async({user})=>{
  if(!isDemoUser(user))throw new ApiError(403,'demo_only','Demo only.');
  const db=getMemoryDb();let p=db.profiles.find(p=>p.displayName==='Jamie Park');
  if(!p){const now=new Date().toISOString();p={id:randomUUID(),userId:null,displayName:'Jamie Park',age:21,pronouns:null,community:'Kennesaw State University',city:'Atlanta',bio:'Programmer looking for a robotics hackathon team at KSU. Also looking for a roommate.',interests:['Robotics','Startups','F1','Roommates','Hackathons'],skills:['Programming','Python','Electronics'],languages:[{language:'English',level:'fluent'}],availability:['evenings','weekends'],groupSizes:['small_group','one_on_one'],setting:'either',visibility:{age:true,pronouns:true,community:true},avatarHue:200,isDemoPersona:true,createdAt:now,updatedAt:now};db.profiles.push(p);db.modeProfiles.push({profileId:p.id,mode:'connect',lookingFor:'A robotics hackathon team and a roommate at KSU',seeks:['Robotics','Engineering','Roommates'],offers:['Programming','Python'],details:{kind:'connect',activities:['Robotics','Startups','F1','Roommates']},active:true,updatedAt:now});db.contacts.push({profileId:p.id,kind:'instagram',value:'@jamie.demo',shareOnMatch:true});naviDb().identities[p.id]={name:p.displayName,age:21,gender:'woman'};persistMemoryDb();saveNavi();}
  return{found:await rescanWatches(),name:p.displayName};
 });
}
