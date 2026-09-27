import { z } from 'zod';
try { process.loadEnvFile('.env'); } catch { /* Environment-only deployments are supported. */ }
const { MuseProvider }=await import('../server/ai/muse');
if(!process.env.MUSE_API_KEY){console.log('SKIPPED: MUSE_API_KEY is not set. Offline matching remains available.');process.exit(2);}
const result=await new MuseProvider().structured({task:'smoke',system:'Return the requested JSON value.',user:'Return {"ok":true}.',schema:z.object({ok:z.boolean()})});
if(!result.ok)throw new Error('Muse smoke test failed');
console.log('PASS: authenticated Muse request and structured response validated.');
