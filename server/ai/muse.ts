import { z } from 'zod';
import { config } from '../config';
import type { AIProvider, StructuredRequest } from './provider';

/** Server-only Meta Model API adapter; receives Scout input and approved facts. */
export class MuseProvider implements AIProvider {
  readonly name = 'Meta Muse';
  async structured<T>(request: StructuredRequest<T>): Promise<T> {
    if (!config.museKey) throw new Error('Muse is not configured');
    const response = await fetch(`${config.museBaseUrl.replace(/\/$/,'')}/chat/completions`, {
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.museKey}`},
      signal:AbortSignal.timeout(config.aiTimeoutMs),
      body:JSON.stringify({model:config.museModel,messages:[{role:'developer',content:request.system},{role:'user',content:request.user}],
        response_format:{type:'json_schema',json_schema:{name:'partner_up',strict:true,schema:z.toJSONSchema(request.schema)}},
      }),
    });
    if(!response.ok)throw new Error(`Muse request failed (${response.status})`);
    const data=await response.json() as {choices?:{message?:{content?:string}}[]};
    const content=data.choices?.[0]?.message?.content;
    if(!content)throw new Error('Muse returned no content');
    return request.schema.parse(JSON.parse(content));
  }
}
