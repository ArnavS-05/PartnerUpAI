import { randomUUID } from 'node:crypto';
import { seedId } from '../data/seed';
export interface Identity { name:string;age:number;gender:'man'|'woman' }
export interface Watch { id:string;owner:string;kind:'mutual'|'scout';text:string;active:boolean;createdAt:string;foundIds:string[] }
export interface Notice { id:string;owner:string;title:string;body:string;page:string;read:boolean;createdAt:string }
interface NaviDb { identities:Record<string,Identity>;watches:Watch[];notices:Notice[] }
type State=typeof globalThis & {__navi?:NaviDb};
export function naviDb():NaviDb { const g=globalThis as State;return g.__navi??={identities:{},watches:[],notices:[]}; }
export function saveNavi(){ /* Prisma commits at the API transaction boundary. */ }
const fictionalWomen=[3,4,5,7,10,11,13,17,18,19].map(seedId);
const fictionalMen=[1,2,6,8,9,12,14,15,16,20].map(seedId);
export function identityFor(id:string):Identity|undefined {return naviDb().identities[id]??(fictionalWomen.includes(id)?{name:'',age:21,gender:'woman'}:fictionalMen.includes(id)?{name:'',age:21,gender:'man'}:undefined);}
export function notify(owner:string,title:string,body:string,page:string){naviDb().notices.unshift({id:randomUUID(),owner,title,body,page,read:false,createdAt:new Date().toISOString()});saveNavi();}
export const sameName=(a:string,b:string)=>a.trim().replace(/\s+/g,' ').toLowerCase()===b.trim().replace(/\s+/g,' ').toLowerCase();
