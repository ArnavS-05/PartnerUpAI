import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { beforeAll, afterAll, expect, it } from 'vitest';
import type { GroupProposal, MutualPerson, MutualState } from '../shared/connection';
import type { MeResponse } from '../shared/types';
process.env.PERSIST_DEMO_DATA='false';
let server:Server,base:string,demo:string;
async function call<T>(path:string,token:string,body?:unknown){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json() as T};}
beforeAll(async()=>{const {apiMiddleware}=await import('../server/app');server=createServer((q,s)=>{void apiMiddleware(q,s);});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;demo=(await call<{accessToken:string}>('/api/auth/demo','',{})).data.accessToken;});
afterAll(()=>new Promise<void>(r=>server.close(()=>r())));
it('keeps an unmatched Scout active, finds a later arrival, and avoids duplicate alerts',async()=>{
 const before=await call<GroupProposal>('/api/scout',demo,{text:'I need a programmer for my robotics hackathon team at KSU.'});expect(before.data.members).toHaveLength(0);expect(before.data.watchId).toBeTruthy();
 const join=await call<{found:number}>('/api/demo/new-person',demo,{});expect(join.data.found).toBe(1);
 const state=await call<{notices:{title:string}[];watches:{active:boolean}[]}>('/api/navi/state',demo);expect(state.data.notices.some(n=>n.title==='Muse found someone.')).toBe(true);expect(state.data.watches[0].active).toBe(true);
 expect((await call<{found:number}>('/api/demo/new-person',demo,{})).data.found).toBe(0);
 const after=await call<GroupProposal>('/api/scout',demo,{text:'I need a programmer for my robotics hackathon team at KSU.'});expect(after.data.members[0].profile.displayName).toBe('Jamie Park');expect(JSON.stringify(after.data)).not.toContain('@jamie.demo');
});
it('enforces opposite-gender search, Taken, and the 24-hour lock on the server',async()=>{
 expect((await call<MutualPerson[]>('/api/mutual/search',demo,{name:'Alex Rivera'})).data).toHaveLength(0);
 const sarah=(await call<MutualPerson[]>('/api/mutual/search',demo,{name:'Sarah Johnson'})).data[0];
 await call('/api/mutual/request',demo,{id:sarah.id});
 const sarahToken=(await call<{accessToken:string}>('/api/demo/switch',demo,{id:sarah.id})).data.accessToken;
 const me=(await call<MeResponse>('/api/me',demo)).data.profile!;
 const match=(await call<MutualState>('/api/mutual/request',sarahToken,{id:me.id})).data;
 expect(match.matches).toHaveLength(1);expect((await call('/api/mutual/end',sarahToken,{id:match.matches[0].id})).status).toBe(409);
 const alex=(await call<{accessToken:string}>('/api/demo/switch',demo,{id:'00000000-0000-4000-8000-000000000002'})).data.accessToken;
 expect((await call<MutualPerson[]>('/api/mutual/search',alex,{name:'Sarah Johnson'})).data[0].taken).toBe(true);
 expect((await call('/api/mutual/request',alex,{id:sarah.id})).status).toBe(409);
 await call('/api/demo/advance-day',sarahToken,{});expect((await call('/api/mutual/end',sarahToken,{id:match.matches[0].id})).status).toBe(200);
});
it('saves an unknown name and notifies both people without disclosing the watcher',async()=>{
 await call('/api/watches/name',demo,{name:'Taylor Example'});
 const token=(await call<{accessToken:string}>('/api/auth/signup','',{email:'taylor@test.example',password:'A-test-password-123'})).data.accessToken;
 const created=await fetch(base+'/api/profile',{method:'PUT',headers:{'content-type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({displayName:'Taylor Example',age:21})});expect(created.status).toBe(200);
 expect((await call('/api/identity',token,{gender:'woman',phone:'555-0102',instagram:''})).status).toBe(200);
 const n=(await call<{notices:{title:string;body:string}[]}>('/api/navi/state',token)).data;
 expect(n.notices[0].title).toBe('Your profile is live');expect(JSON.stringify(n)).not.toContain('Arnav');
 expect((await call<{notices:{title:string}[]}>('/api/navi/state',demo)).data.notices.some(n=>n.title==='Taylor Example joined Partner Up')).toBe(true);
 const change=await fetch(base+'/api/profile',{method:'PUT',headers:{'content-type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({displayName:'Different Name',age:21})});expect(change.status).toBe(409);
 expect((await call('/api/identity',token,{gender:'man',phone:'555',instagram:''})).status).toBe(409);
 expect((await call('/api/account/password',token,{current:'wrong',next:'new-password-123'})).status).toBe(400);
 expect((await call('/api/account/password',token,{current:'A-test-password-123',next:'new-password-123'})).status).toBe(200);
 expect((await call('/api/demo/new-person',token,{})).status).toBe(403);
});

