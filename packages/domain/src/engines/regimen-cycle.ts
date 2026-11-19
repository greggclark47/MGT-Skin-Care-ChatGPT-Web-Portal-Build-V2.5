export const REGIMEN_CYCLE_POLICY_VERSION = 'regimen-cycle-1';
export const REGIMEN_CYCLE_DAYS = 14;

export const REGIMEN_CYCLE_FOCUSES = ['steady_routine','introduce_one_change','review_progress'] as const;
export type RegimenCycleFocus = typeof REGIMEN_CYCLE_FOCUSES[number];
export const REGIMEN_CYCLE_CHECK_IN_STATUSES = ['comfortable','no_change','needs_review'] as const;
export type RegimenCycleCheckInStatus = typeof REGIMEN_CYCLE_CHECK_IN_STATUSES[number];

export interface RegimenCycle {
 id:string;
 actor:string;
 focus:RegimenCycleFocus;
 starts_at:string;
 ends_at:string;
 status:'active'|'complete';
 cycle_days:14;
 consent_version:string;
 created_at:string;
 policy_version:string;
 data_shared:[];
}

export interface RegimenCycleCheckIn {
 id:string;
 actor:string;
 cycle_id:string;
 status:RegimenCycleCheckInStatus;
 completed_at:string;
 created_at:string;
 policy_version:string;
 data_shared:[];
}

export interface RegimenCycleSummary {
 cycle:RegimenCycle;
 check_ins:number;
 comfortable:number;
 no_change:number;
 needs_review:number;
 days_remaining:number;
 rotation_state:'in_progress'|'ready_for_review';
 deterministic_guidance:{mode:'explain_only';next_step:'keep_current_routine'|'review_before_next_cycle';routine_changes:'never_automatic';note:string};
 ai_boundary:{enabled:'configuration_dependent'; input:'cycle_metadata_only'; can_change_routine:false; note:string};
 data_shared:[];
}

export function isRegimenCycleFocus(value:unknown):value is RegimenCycleFocus{return typeof value==='string'&&(REGIMEN_CYCLE_FOCUSES as readonly string[]).includes(value);}
export function isRegimenCycleCheckInStatus(value:unknown):value is RegimenCycleCheckInStatus{return typeof value==='string'&&(REGIMEN_CYCLE_CHECK_IN_STATUSES as readonly string[]).includes(value);}

function validId(value:unknown){return typeof value==='string'&&/^[a-z][a-z0-9_-]{2,119}$/i.test(value);}
function validActor(value:unknown){return typeof value==='string'&&value.length>0&&value.length<=160&&!/[\u0000-\u001f\u007f]/.test(value);}
function validConsent(value:unknown){return typeof value==='string'&&/^[a-z0-9._-]{1,80}$/i.test(value);}
function validIso(value:unknown){return typeof value==='string'&&Number.isFinite(Date.parse(value));}

export function createRegimenCycle(input:{focus:RegimenCycleFocus;consent_version:string},actor:string,id:string,now=new Date().toISOString()):RegimenCycle{
 if(!validActor(actor)||!validId(id)||!isRegimenCycleFocus(input?.focus)||!validConsent(input?.consent_version)||!validIso(now))throw new Error('regimen_cycle_invalid');
 const startsAt=new Date(Date.parse(now));
 return {id,actor,focus:input.focus,starts_at:startsAt.toISOString(),ends_at:new Date(startsAt.getTime()+REGIMEN_CYCLE_DAYS*86400000).toISOString(),status:'active',cycle_days:REGIMEN_CYCLE_DAYS,consent_version:input.consent_version,created_at:startsAt.toISOString(),policy_version:REGIMEN_CYCLE_POLICY_VERSION,data_shared:[]};
}

export function createRegimenCycleCheckIn(input:{cycle_id:string;status:RegimenCycleCheckInStatus;completed_at:string},cycle:RegimenCycle,actor:string,id:string,now=new Date().toISOString()):RegimenCycleCheckIn{
 if(!validId(id)||!validActor(actor)||!cycle||cycle.actor!==actor||input?.cycle_id!==cycle.id||!isRegimenCycleCheckInStatus(input.status)||!validIso(input.completed_at)||!validIso(now))throw new Error('regimen_cycle_check_in_invalid');
 const completed=Date.parse(input.completed_at),starts=Date.parse(cycle.starts_at),latest=Date.parse(cycle.ends_at)+86400000;
 if(completed<starts||completed>latest)throw new Error('regimen_cycle_check_in_out_of_range');
 return {id,actor,cycle_id:cycle.id,status:input.status,completed_at:new Date(completed).toISOString(),created_at:new Date(Date.parse(now)).toISOString(),policy_version:REGIMEN_CYCLE_POLICY_VERSION,data_shared:[]};
}

export function summarizeRegimenCycle(cycle:RegimenCycle,entries:RegimenCycleCheckIn[],now=Date.now()):RegimenCycleSummary{
 if(!cycle||!validIso(cycle.ends_at))throw new Error('regimen_cycle_invalid');
 const scoped=entries.filter(item=>item&&item.cycle_id===cycle.id&&item.actor===cycle.actor);
 const count=(status:RegimenCycleCheckInStatus)=>scoped.filter(item=>item.status===status).length;
 const daysRemaining=Math.max(0,Math.ceil((Date.parse(cycle.ends_at)-now)/86400000));
 const ready=daysRemaining===0;
 return {cycle:{...cycle,status:ready?'complete':cycle.status},check_ins:scoped.length,comfortable:count('comfortable'),no_change:count('no_change'),needs_review:count('needs_review'),days_remaining:daysRemaining,rotation_state:ready?'ready_for_review':'in_progress',deterministic_guidance:{mode:'explain_only',next_step:ready?'review_before_next_cycle':'keep_current_routine',routine_changes:'never_automatic',note:ready?'Your two-week review is ready. Review your notes before choosing any next change.':'Keep your selected routine steady. A check-in records your experience but does not change products or sensitivity settings.'},ai_boundary:{enabled:'configuration_dependent',input:'cycle_metadata_only',can_change_routine:false,note:'Any approved AI explanation may describe this cycle summary. It cannot diagnose, infer treatment response, select products, or apply a routine change.'},data_shared:[]};
}
