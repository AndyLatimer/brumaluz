import { fetchParty, sendPartyInvite, respondPartyInvite, leaveParty } from './account';
import { sanitize, type CharData } from '../data/data';
import { parsePublicVitals, type PublicVitals } from './multiplayer';

export interface PartyMember {
  userId: string;
  characterId: string;
  username: string | null;
  data: CharData;
  vitals: PublicVitals;
  position: { x: number; z: number };
  location: string;
}
export interface PartyInvite { id: string; username: string }
export interface PartyResponse extends PartyInvite { accepted: boolean }
export interface PartyState { id: string | null; members: PartyMember[]; incoming: PartyInvite[]; outgoing: PartyInvite[]; responses: PartyResponse[] }
const empty = (): PartyState => ({ id: null, members: [], incoming: [], outgoing: [], responses: [] });
let current = empty();
let self: string | null = null;
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let pending: Promise<void> | null = null;
const observers = new Set<(state: PartyState) => void>();
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Respuesta de grupo no válida.');
  return value as Record<string, unknown>;
}
function text(value: unknown) {
  if (typeof value !== 'string') throw new Error('Respuesta de grupo no válida.');
  return value;
}
function invites(value: unknown): PartyInvite[] {
  if (!Array.isArray(value)) throw new Error('Respuesta de grupo no válida.');
  return value.map(item => { const row=record(item); return { id:text(row.id),username:text(row.username) }; });
}
function parse(value: unknown): PartyState {
  const row=record(value);
  if ((row.id!==null && typeof row.id!=='string') || !Array.isArray(row.members) || row.members.length>4) throw new Error('Respuesta de grupo no válida.');
  const members=row.members.map(item=>{
    const member=record(item), pos=record(member.position);
    if (typeof pos.x!=='number' || !Number.isFinite(pos.x) || typeof pos.z!=='number' || !Number.isFinite(pos.z)
      || (member.username!==null && typeof member.username!=='string')) throw new Error('Respuesta de grupo no válida.');
    return { userId:text(member.userId),characterId:text(member.characterId),username:member.username,
      data:sanitize(record(member.data)),vitals:parsePublicVitals(member.vitals),position:{x:pos.x,z:pos.z},location:text(member.location) };
  });
  if (!Array.isArray(row.responses)) throw new Error('Respuesta de grupo no válida.');
  const responses=row.responses.map(item=>{
    const response=record(item);
    if(typeof response.accepted!=='boolean') throw new Error('Respuesta de grupo no válida.');
    return {id:text(response.id),username:text(response.username),accepted:response.accepted};
  });
  return { id:row.id,members,incoming:invites(row.incoming),outgoing:invites(row.outgoing),responses };
}
function publish(state: PartyState) { current=state; for(const observer of observers) observer(state); }
export const getParty = () => current;
export const partySelf = () => self;
export const isPartyLeader = () => !!self && current.members[0]?.userId===self;
export function observeParty(observer: (state: PartyState) => void) {
  observers.add(observer); observer(current);
  return () => { observers.delete(observer); };
}
export async function refreshParty() {
  if (!self) return;
  if (pending) return pending;
  const version=generation;
  const request=fetchParty().then(value=>{ if(version===generation) publish(parse(value)); })
    .finally(()=>{if(pending===request) pending=null;});
  pending=request;
  return request;
}
export function startParty(userId: string, error: (error: unknown) => void) {
  stopParty();
  self=userId;
  const version=generation;
  let failed=false;
  async function poll() {
    try { await refreshParty(); failed=false; }
    catch (reason) { if(version===generation && !failed) { error(reason); failed=true; } }
    finally { if(version===generation) timer=setTimeout(()=>void poll(),2000); }
  }
  void poll();
}
export function stopParty() {
  generation++; clearTimeout(timer); pending=null; self=null; publish(empty());
}
async function change(action: () => Promise<unknown>) {
  const version=generation;
  await action();
  if(version!==generation) return;
  // A read started before the mutation may contain stale membership.
  await pending;
  if(version===generation) await refreshParty();
}
export const inviteToParty = (username: string) => change(()=>sendPartyInvite(username));
export const answerPartyInvite = (id: string, accept: boolean) => change(()=>respondPartyInvite(id,accept));
export const exitParty = () => change(leaveParty);
