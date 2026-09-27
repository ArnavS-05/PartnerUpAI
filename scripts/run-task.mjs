import { build } from 'vite';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const task=process.argv[2];
if(!['seed','muse-smoke'].includes(task))throw new Error('Unknown server task');
await build({configFile:false,logLevel:'warn',build:{ssr:resolve(`scripts/${task}.ts`),outDir:`dist-tasks/${task}`,rollupOptions:{output:{entryFileNames:'task.js'}}}});
await import(pathToFileURL(resolve(`dist-tasks/${task}/task.js`)).href);
