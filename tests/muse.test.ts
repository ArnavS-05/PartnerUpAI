import {createServer,type Server} from 'node:http';
import type {AddressInfo} from 'node:net';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {z} from 'zod';
import {MuseProvider} from '../server/ai/muse';
import {draftProfileFromText,setAIProviderForTesting} from '../server/ai/service';
let server:Server,last:Record<string,unknown>,authorization:string|undefined,status=200,content='{"ok":true}',slow=false;
beforeAll(async()=>{
 server=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;last=JSON.parse(raw);authorization=req.headers.authorization;
  const respond=()=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({choices:[{message:{content}}]}));};
  if(slow)setTimeout(respond,250);else respond();
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 process.env.MUSE_API_KEY='local-mock-key';process.env.MUSE_BASE_URL=`http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;process.env.MUSE_MODEL='configured-muse-model';
});
afterAll(async()=>{delete process.env.MUSE_API_KEY;delete process.env.MUSE_BASE_URL;delete process.env.MUSE_MODEL;delete process.env.AI_TIMEOUT_MS;await new Promise<void>(r=>server.close(()=>r()));});
const input={task:'test',system:'Use only supplied facts.',user:'Return a boolean.',schema:z.object({ok:z.boolean()})};
it('uses the configured model, bearer authentication and validated structured response',async()=>{
 expect(await new MuseProvider().structured(input)).toEqual({ok:true});expect(authorization).toBe('Bearer local-mock-key');expect(last.model).toBe('configured-muse-model');expect(last.response_format).toMatchObject({type:'json_schema'});
});
it('rejects malformed output and falls back to grounded local profile parsing',async()=>{
 content='not JSON';await expect(new MuseProvider().structured(input)).rejects.toThrow();
 setAIProviderForTesting(new MuseProvider());const draft=await draftProfileFromText('I like robotics and F1. I am good at engineering and learning programming.','connect');
 expect(draft.source).toBe('local');expect(draft.profile.interests?.join(' ').toLowerCase()).toContain('robot');
});
it('falls back when Meta rate limits and stops slow calls at the configured timeout',async()=>{
 status=429;await expect(new MuseProvider().structured(input)).rejects.toThrow('429');
 status=200;slow=true;process.env.AI_TIMEOUT_MS='100';const start=Date.now();await expect(new MuseProvider().structured(input)).rejects.toThrow();expect(Date.now()-start).toBeLessThan(1000);
});
