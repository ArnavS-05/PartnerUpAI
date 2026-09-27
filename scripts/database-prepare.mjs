import {existsSync,mkdirSync,closeSync,openSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
try{process.loadEnvFile('.env');}catch{/* Optional local configuration. */}
const url=process.env.DATABASE_URL||'file:./dev.db';
if(!url.startsWith('file:'))throw new Error('Partner Up requires a SQLite file DATABASE_URL.');
const value=url.slice(5);
const file=value.startsWith('/')||/^[A-Za-z]:/.test(value)?value:resolve('prisma',value);
mkdirSync(dirname(file),{recursive:true});
if(!existsSync(file))closeSync(openSync(file,'wx'));
