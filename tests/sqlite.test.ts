import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,readFileSync,unlinkSync,rmdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {afterAll,beforeAll,expect,it} from 'vitest';
const dir=mkdtempSync(join(tmpdir(),'partnerup-sqlite-test-')),file=join(dir,'test.db');
process.env.DATABASE_URL=`file:${file.replaceAll('\\','/')}`;process.env.PERSIST_DEMO_DATA='true';process.env.SESSION_SECRET='test-secret-that-is-not-used-in-production';
let server:Server,base:string,cookie:string,userId:string;
beforeAll(async()=>{
 const db=new DatabaseSync(file);db.exec(readFileSync('prisma/migrations/202609260001_initial/migration.sql','utf8'));db.close();
 const {apiMiddleware}=await import('../server/app');server=createServer((q,s)=>{void apiMiddleware(q,s);});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{await new Promise<void>(r=>server.close(()=>r()));const {prisma}=await import('../server/data/database');await prisma().$disconnect();for(const suffix of ['','-wal','-shm'])if(existsSync(file+suffix))unlinkSync(file+suffix);rmdirSync(dir);});
it('stores password hashes and opaque sessions in SQLite, with HttpOnly cookies',async()=>{
 const response=await fetch(base+'/api/auth/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'sqlite@example.test',password:'Test-only-password-26'})});expect(response.status).toBe(200);
 const setCookie=response.headers.get('set-cookie')!;expect(setCookie).toContain('HttpOnly');expect(setCookie).toContain('SameSite=Lax');cookie=setCookie.split(';')[0];
 const {prisma}=await import('../server/data/database');const user=await prisma().user.findUnique({where:{email:'sqlite@example.test'}});expect(user?.passwordHash).toMatch(/^scrypt:/);expect(user?.passwordHash).not.toContain('Test-only-password');userId=user!.id;
 const session=await prisma().session.findFirst({where:{userId}});expect(session).toBeTruthy();expect(cookie).not.toContain(session!.id);
 expect((await fetch(base+'/api/me',{headers:{cookie}})).status).toBe(200);
});
it('restores a session and user from SQLite after clearing the in-process state',async()=>{
 const g=globalThis as typeof globalThis&{__dbReady?:Promise<void>;__partnerUpDb?:unknown;__connections?:unknown;__navi?:unknown};
 delete g.__dbReady;delete g.__partnerUpDb;delete g.__connections;delete g.__navi;
 const r=await fetch(base+'/api/me',{headers:{cookie}});expect(r.status).toBe(200);expect((await r.json()).email).toBe('sqlite@example.test');
});
it('rolls back a failed unit of work and rejects cross-origin writes',async()=>{
 const {inDatabase,prisma}=await import('../server/data/database');const {getMemoryDb}=await import('../server/data/memoryStore');
 await expect(inDatabase(async()=>{getMemoryDb().users.find(u=>u.id===userId)!.email='should-not-persist@test.example';throw new Error('rollback');})).rejects.toThrow('rollback');
 expect((await prisma().user.findUnique({where:{id:userId}}))!.email).toBe('sqlite@example.test');expect(getMemoryDb().users.find(u=>u.id===userId)!.email).toBe('sqlite@example.test');
 expect((await fetch(base+'/api/auth/logout',{method:'POST',headers:{cookie,origin:'https://another.example'}})).status).toBe(403);
});
