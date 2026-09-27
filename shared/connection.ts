import type { ContactMethod, Mode, PublicProfile, MatchCard } from './types';
export interface MutualPerson { id: string; displayName: string; avatarHue: number; taken?:boolean }
export interface MutualRequest { id: string; target: MutualPerson; status: string; expiresAt: string }
export interface MutualState {
  searches: number; admirers: number; limit: number; ttl: number; remaining?:number;
  sent: MutualRequest[];
  matches: { id: string; partner: MutualPerson; contacts: ContactMethod[]; unlockAt?:string }[];
}
export interface GroupProposal {
  watchId?:string;
  id: string; mode: Mode; title: string; source: 'ai' | 'local'; intentSource: 'ai' | 'local';
  summary: string; members: MatchCard[]; shared: string[];
  exchanges: { from: string; to: string; subject: string }[];
  caveats: string[]; size: number;
}
export interface Circle {
  id: string; mode: Mode; title: string; ownerId: string;
  members: { profile: PublicProfile; accepted: boolean; contacts: ContactMethod[] }[];
  active: boolean;
}
