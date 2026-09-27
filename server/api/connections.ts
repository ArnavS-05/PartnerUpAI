import { z } from 'zod';
import { authedRoute, parseBody } from '../http/router';
import { rateLimit } from '../http/rateLimit';
import { switchDemoPersona, isDemoUser } from '../auth';
import { mutualState, searchMutual, requestMutual, endMutual, circlesFor, inviteCircle, consentCircle, resetConnections } from '../services/connections';
import { buildCircle } from '../services/groupBuilder';
import { getMemoryDb } from '../data/memoryStore';
import { DEMO_PROFILE_ID } from '../data/seed';
const idSchema=z.object({id:z.string().uuid()});
export function registerConnections(){
  authedRoute('GET','/api/mutual',async({user})=>mutualState(user));
  authedRoute('POST','/api/mutual/search',async({user,body})=>{rateLimit(`search:${user.id}`,30);return searchMutual(user,parseBody(z.object({name:z.string().trim().min(3).max(80)}),body).name);});
  authedRoute('POST','/api/mutual/request',async({user,body})=>requestMutual(user,parseBody(idSchema,body).id));
  authedRoute('POST','/api/mutual/end',async({user,body})=>endMutual(user,parseBody(idSchema,body).id));
  authedRoute('POST','/api/circles/build',async({user,body})=>{rateLimit(`group:${user.id}`,30);const b=parseBody(z.object({mode:z.enum(['connect','learn','explore']),text:z.string().trim().min(3).max(2000)}),body);return buildCircle(user,b.mode,b.text);});
  authedRoute('GET','/api/circles',async({user})=>circlesFor(user));
  authedRoute('POST','/api/circles/invite',async({user,body})=>inviteCircle(user,parseBody(idSchema,body).id));
  authedRoute('POST','/api/circles/consent',async({user,body})=>{const b=parseBody(z.object({id:z.string().uuid(),accept:z.boolean()}),body);return consentCircle(user,b.id,b.accept);});
  authedRoute('GET','/api/demo/people',async({user})=>isDemoUser(user)?getMemoryDb().profiles.filter(p=>p.isDemoPersona||p.id===DEMO_PROFILE_ID).map(p=>({id:p.id,displayName:p.displayName,avatarHue:p.avatarHue})):[]);
  authedRoute('POST','/api/demo/switch',async({user,body})=>switchDemoPersona(user,parseBody(idSchema,body).id));
  authedRoute('POST','/api/demo/connections/reset',async({user})=>resetConnections(user));
}
