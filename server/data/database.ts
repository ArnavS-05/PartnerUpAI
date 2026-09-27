import { PrismaClient, type Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { getMemoryDb, type MemoryDb } from './memoryStore';
import { connections } from '../services/connections';
import { naviDb } from '../services/naviStore';

type State = { core: MemoryDb; mutual: ReturnType<typeof connections>; scout: ReturnType<typeof naviDb> };
type Shared = typeof globalThis & { __prisma?: PrismaClient; __dbReady?: Promise<void>; __dbQueue?: Promise<unknown> };
const shared = globalThis as Shared;
export function prisma() {
  process.env.DATABASE_URL ||= `file:${resolve('prisma/dev.db').replaceAll('\\','/')}`;
  return shared.__prisma ??= new PrismaClient();
}
function state(): State { return { core:getMemoryDb(),mutual:connections(),scout:naviDb() }; }
function restore(value:State) {
  Object.assign(getMemoryDb(),value.core);
  Object.assign(connections(),value.mutual);
  Object.assign(naviDb(),value.scout);
}
const json = (value:unknown)=>JSON.stringify(value);
const parse = <T>(value:string):T=>JSON.parse(value) as T;

async function save(tx:Prisma.TransactionClient,s:State) {
  // The demo is one Node process. Each API unit of work commits all related
  // state in one SQLite transaction, so consent and notifications cannot split.
  await tx.session.deleteMany();await tx.user.deleteMany();await tx.profile.deleteMany();
  await tx.partnerDNA.deleteMany();await tx.mutualRequest.deleteMany();await tx.mutualSearch.deleteMany();
  await tx.mutualMatch.deleteMany();await tx.pendingMutualIdentity.deleteMany();await tx.scoutRequest.deleteMany();
  await tx.scoutConnection.deleteMany();await tx.notification.deleteMany();await tx.appRecord.deleteMany();
  if(s.core.users.length)await tx.user.createMany({data:s.core.users});
  const sessions=Object.entries(s.core.sessions).map(([id,v])=>({id,...v}));
  if(sessions.length)await tx.session.createMany({data:sessions});
  if(s.core.profiles.length)await tx.profile.createMany({data:s.core.profiles.map(p=>({id:p.id,userId:p.userId,payload:json(p)}))});
  if(s.core.dna.length)await tx.partnerDNA.createMany({data:s.core.dna.map(d=>({id:d.profileId,profileId:d.profileId,payload:json(d)}))});
  if(s.mutual.requests.length)await tx.mutualRequest.createMany({data:s.mutual.requests.map(r=>({id:r.id,senderId:r.from,targetId:r.to,createdAt:r.created,expiresAt:r.expires,status:r.status,matchedAt:r.matchedAt??null}))});
  if(s.mutual.searches.length)await tx.mutualSearch.createMany({data:s.mutual.searches.map(r=>({id:randomUUID(),searcherId:r.from,targetId:r.to,month:r.month}))});
  const matches=s.mutual.requests.filter(r=>['mutual','ended'].includes(r.status)&&r.from<r.to).map(r=>({id:r.id,userAId:r.from,userBId:r.to,matchedAt:r.matchedAt??r.created,earliestEndAt:(r.matchedAt??r.created)+86400000,active:r.status==='mutual'}));
  if(matches.length)await tx.mutualMatch.createMany({data:matches});
  const names=s.scout.watches.filter(w=>w.kind==='mutual').map(w=>({id:w.id,ownerId:w.owner,name:w.text,active:w.active,createdAt:w.createdAt,payload:json(w)}));
  if(names.length)await tx.pendingMutualIdentity.createMany({data:names});
  const scouts=s.scout.watches.filter(w=>w.kind==='scout').map(w=>({id:w.id,ownerId:w.owner,rawText:w.text,active:w.active,createdAt:w.createdAt,payload:json(w)}));
  if(scouts.length)await tx.scoutRequest.createMany({data:scouts});
  if(s.mutual.circles.length)await tx.scoutConnection.createMany({data:s.mutual.circles.map(c=>({id:c.id,ownerId:c.owner,active:c.active,payload:json(c)}))});
  if(s.scout.notices.length)await tx.notification.createMany({data:s.scout.notices.map(({owner,...n})=>({...n,ownerId:owner}))});
  const records=[
    ...Object.entries(s.core).filter(([k])=>!['users','sessions','profiles','dna'].includes(k)).map(([collection,v])=>({id:`core:${collection}`,collection,payload:json(v)})),
    {id:'identities',collection:'identities',payload:json(s.scout.identities)},
    {id:'proposals',collection:'proposals',payload:json(s.mutual.proposals)},
  ];
  await tx.appRecord.createMany({data:records});
}

export async function initializeDatabase() {
  if(process.env.PERSIST_DEMO_DATA==='false')return;
  return shared.__dbReady ??= (async()=>{
    const db=prisma();await db.$queryRawUnsafe('PRAGMA journal_mode = WAL');
    const marker=await db.appRecord.findUnique({where:{id:'core:version'}});
    if(!marker){await db.$transaction(tx=>save(tx,state()),{timeout:20000});return;}
    const s=state();
    s.core.users=await db.user.findMany();
    s.core.sessions=Object.fromEntries((await db.session.findMany()).map(({id,...v})=>[id,v]));
    s.core.profiles=(await db.profile.findMany()).map(r=>parse(r.payload));
    s.core.dna=(await db.partnerDNA.findMany()).map(r=>parse(r.payload));
    for(const r of await db.appRecord.findMany()){
      if(r.id.startsWith('core:'))Object.assign(s.core,{[r.collection]:parse(r.payload)});
      if(r.id==='identities')s.scout.identities=parse(r.payload);
      if(r.id==='proposals')s.mutual.proposals=parse(r.payload);
    }
    s.mutual.requests=(await db.mutualRequest.findMany()).map(r=>({id:r.id,from:r.senderId,to:r.targetId,created:r.createdAt,expires:r.expiresAt,status:r.status as State['mutual']['requests'][number]['status'],matchedAt:r.matchedAt??undefined}));
    s.mutual.searches=(await db.mutualSearch.findMany()).map(r=>({from:r.searcherId,to:r.targetId,month:r.month}));
    s.mutual.circles=(await db.scoutConnection.findMany()).map(r=>parse(r.payload));
    s.scout.watches=[...(await db.pendingMutualIdentity.findMany()),...(await db.scoutRequest.findMany())].map(r=>parse(r.payload));
    s.scout.notices=(await db.notification.findMany()).map(({ownerId,...n})=>({...n,owner:ownerId}));
  })();
}

export async function inDatabase<T>(action:()=>Promise<T>):Promise<T> {
  // Serializing the entire read/modify/commit operation prevents duplicate
  // reciprocal matches and lost updates inside the single deployed instance.
  const run=async()=>{
    await initializeDatabase();const before=structuredClone(state());
    try {const result=await action();if(process.env.PERSIST_DEMO_DATA!=='false'&&json(before)!==json(state()))await prisma().$transaction(tx=>save(tx,state()),{timeout:20000});return result;}
    catch(error){restore(before);throw error;}
  };
  const result=(shared.__dbQueue??Promise.resolve()).then(run,run);
  shared.__dbQueue=result.catch(()=>undefined);return result;
}
