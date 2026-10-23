import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {writeFile,rename} from 'node:fs/promises';
import type { Records, Store } from './store';
import { advanceProgressReminder, type ProgressReminder } from '@mgt/domain';

type NotificationFailureCode='delivery_rejected'|'delivery_unavailable'|'delivery_payload_rejected';
type DeletionFailureCode='identity_rejected'|'identity_unavailable';
type Notification={id:string;actor:string;kind:'replenishment_reminder'|'anti_aging_progress_reminder';status:'queued'|'processing'|'delivered'|'failed'|'read';scheduled_at:string;created_at:string;updated_at:string;attempts:number;payload:{product_id?:string;entry_id?:string;due_at:string;cadence?:string};lease_until?:string;claim_id?:string;retry_not_before?:string;retry_delay_seconds?:number;delivered_at?:string;read_at?:string;last_error_code?:NotificationFailureCode};
type Reminder={product_id:string;due_at:string;paused?:boolean;notification_id?:string;last_notified_at?:string};
export type FollowUpTaskStatus='scheduled'|'processing'|'completed'|'blocked';
export type FollowUpTask={id:string;kind:string;generation:number;due_at:string;status:FollowUpTaskStatus;attempts:number;created_at:string;updated_at:string;payload?:unknown;lease_until?:string;claim_id?:string;retry_not_before?:string;retry_delay_seconds?:number;completed_at?:string;blocked_at?:string;last_error_code?:string;superseded_generation?:number};
export type FollowUpExecutor={kind:string;execute(task:FollowUpTask):Promise<void>};
export type FollowUpStats={completed:number;blocked:number;failed:number;future:number;stale:number};
type WorkerOptions={env?:NodeJS.ProcessEnv;delivery?:NotificationDelivery;identityDeletion?:IdentityDeletion;alertDelivery?:OperationsAlertDelivery;followUp?:FollowUpExecutor};
export type WorkerResult={run_id:string;created:number;delivered:number;failed:number;removed:number;deletions_completed:number;deletions_blocked:number;backup_status:'healthy'|'stale'|'unverified';follow_ups:FollowUpStats};

export interface NotificationDelivery{kind:string;deliver(notification:Notification):Promise<void>}
export class InAppNotificationDelivery implements NotificationDelivery{
 kind='in_app';
 async deliver(_notification:Notification){}
}
export class WebhookNotificationDelivery implements NotificationDelivery{
 kind='webhook';
 constructor(private url:string,private secret:string,private keyId='primary',private timeoutMs=10000){if(!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>60000)throw new Error('Notification webhook timeout is invalid.');}
 async deliver(notification:Notification){
  const body=JSON.stringify({event:'mgt.notification',notification:{id:notification.id,actor:notification.actor,kind:notification.kind,status:notification.status,scheduled_at:notification.scheduled_at,created_at:notification.created_at,updated_at:notification.updated_at,attempts:notification.attempts,payload:notification.payload}});
  if(Buffer.byteLength(body,'utf8')>65536)throw new Error('Notification payload exceeds the safe delivery limit.');
  const timestamp=new Date().toISOString(),contentDigest='sha256='+createHash('sha256').update(body).digest('hex'),signature='sha256='+createHmac('sha256',this.secret).update(`${timestamp}.${body}`).digest('hex');
  const response=await fetch(this.url,{method:'POST',headers:{'content-type':'application/json','x-mgt-event':'mgt.notification','x-mgt-signature-version':'v1','x-mgt-key-id':this.keyId,'x-mgt-notification-id':notification.id,'x-mgt-attempt':String(notification.attempts),'x-mgt-timestamp':timestamp,'x-mgt-content-sha256':contentDigest,'x-mgt-signature':signature},body,signal:AbortSignal.timeout(this.timeoutMs)});
  if(!response.ok)throw new NotificationDeliveryError(response.status,operationsAlertRetryAfterSeconds(response.headers.get('retry-after')));
 }
}
class NotificationDeliveryError extends Error{
 constructor(readonly status:number,readonly retryAfterSeconds?:number){super(`Notification delivery returned ${status}.`);}
}
export type OperationsAlert={version:'1';delivery_id:string;attempt:number;status:'active'|'resolved';alerts:string[];summary:ReturnType<typeof operationalSnapshot>;generated_at:string};
export interface OperationsAlertDelivery{kind:string;deliver(alert:OperationsAlert):Promise<void>}
class OperationsAlertDeliveryError extends Error{
 constructor(readonly status:number,readonly retryAfterSeconds?:number){super(`Operations alert delivery returned ${status}.`);}
}
export class DisabledOperationsAlertDelivery implements OperationsAlertDelivery{kind='disabled';async deliver(_alert:OperationsAlert){}}
export class WebhookOperationsAlertDelivery implements OperationsAlertDelivery{
 kind='webhook';
 constructor(private url:string,private secret:string,private timeoutMs=10000,private keyId='primary'){if(!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>60000)throw new Error('Operations alert webhook timeout is invalid.');}
 async deliver(alert:OperationsAlert){
  const timestamp=new Date().toISOString();
  const body=JSON.stringify({event:'mgt.operations.alert',alert});
  if(Buffer.byteLength(body,'utf8')>65536)throw new Error('Operations alert payload exceeds the safe delivery limit.');
  const contentDigest='sha256='+createHash('sha256').update(body).digest('hex');
  const signature=createHmac('sha256',this.secret).update(`${timestamp}.${body}`).digest('hex');
  const response=await fetch(this.url,{method:'POST',headers:{'content-type':'application/json','x-mgt-event':'operations.alert','x-mgt-signature-version':'v1','x-mgt-key-id':this.keyId,'x-mgt-delivery-id':alert.delivery_id,'x-mgt-attempt':String(alert.attempt),'x-mgt-timestamp':timestamp,'x-mgt-content-sha256':contentDigest,'x-mgt-signature':`sha256=${signature}`},body,signal:AbortSignal.timeout(this.timeoutMs)});
  if(!response.ok)throw new OperationsAlertDeliveryError(response.status,operationsAlertRetryAfterSeconds(response.headers.get('retry-after')));
 }
}
export interface IdentityDeletion{kind:string;remove(userId:string):Promise<void>}
class LocalIdentityDeletion implements IdentityDeletion{kind='local_only';async remove(_userId:string){}}
class MissingIdentityDeletion implements IdentityDeletion{
 kind='unconfigured';
 async remove(_userId:string){throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to delete the external sign-in identity.');}
}
export class SupabaseIdentityDeletion implements IdentityDeletion{
 kind='supabase';
 constructor(private url:string,private serviceRoleKey:string){}
 async remove(userId:string){
  const response=await fetch(`${this.url.replace(/\/$/,'')}/auth/v1/admin/users/${encodeURIComponent(userId)}`,{method:'DELETE',headers:{apikey:this.serviceRoleKey,authorization:`Bearer ${this.serviceRoleKey}`},signal:AbortSignal.timeout(10000)});
  if(!response.ok&&response.status!==404)throw new Error(`Supabase identity deletion returned ${response.status}.`);
 }
}
const iso=(ms=Date.now())=>new Date(ms).toISOString();
const timestamp=(value:any)=>typeof value==='string'&&!Number.isNaN(Date.parse(value))?Date.parse(value):undefined;
const int=(value:string|undefined,fallback:number,min:number,max:number)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>=min&&parsed<=max?parsed:fallback;};
function backupEvidenceHealthy(backup:any,at:number){
 const current=Number.isFinite(at)?at:Date.now();
 const completed=timestamp(backup?.last_success_at),restoreVerified=timestamp(backup?.restore_verified_at);
 const maxAgeHours=Number(backup?.max_age_hours),restoreMaxAgeDays=Number(backup?.restore_max_age_days);
 const validWindows=Number.isFinite(maxAgeHours)&&maxAgeHours>=1&&maxAgeHours<=720&&Number.isFinite(restoreMaxAgeDays)&&restoreMaxAgeDays>=1&&restoreMaxAgeDays<=365;
 const validTimes=completed!==undefined&&restoreVerified!==undefined&&completed<=current&&restoreVerified<=current;
 return backup?.status==='healthy'&&validWindows&&validTimes&&current-completed<=maxAgeHours*3600000&&current-restoreVerified<=restoreMaxAgeDays*86400000;
}
export function backupEvidenceAdmission(existing:any,incoming:{completed_at:string;restore_verified_at:string;location_identifier:string;restore_reference:string;checksum:string}){
 const previousCompleted=timestamp(existing?.completed_at),previousRestore=timestamp(existing?.restore_verified_at),nextCompleted=timestamp(incoming?.completed_at),nextRestore=timestamp(incoming?.restore_verified_at);
 if(previousCompleted===undefined||previousRestore===undefined||nextCompleted===undefined||nextRestore===undefined)return 'accepted' as const;
 if(nextCompleted<previousCompleted||nextRestore<previousRestore)return 'stale' as const;
 if(nextCompleted===previousCompleted&&nextRestore===previousRestore){
  const same=incoming.location_identifier===existing.location_identifier&&incoming.restore_reference===existing.restore_reference&&incoming.checksum===existing.checksum;
  return same?'duplicate' as const:'conflict' as const;
 }
 return 'accepted' as const;
}
const followUpIdPattern=/^[A-Za-z0-9_-]{1,128}$/;
const followUpKindPattern=/^[a-z0-9][a-z0-9_.-]{0,63}$/;
function followUpPayloadKey(value:unknown){
 try{const encoded=JSON.stringify(value===undefined?null:value);if(encoded===undefined||Buffer.byteLength(encoded,'utf8')>32768)throw new Error();return encoded;}catch{throw new Error('Follow-up payload is invalid.');}
}
function validateFollowUpIdentity(id:string,generation:number){
 if(typeof id!=='string'||!followUpIdPattern.test(id)||!Number.isSafeInteger(generation)||generation<1||generation>1000000000)throw new Error('Follow-up identity is invalid.');
}
function followUpGraceSeconds(value:number){return Number.isSafeInteger(value)&&value>=60&&value<=86400?value:300;}
function followUpRetrySeconds(value:number){return Number.isSafeInteger(value)&&value>=10&&value<=86400?value:300;}
function followUpMaxAttempts(value:number){return Number.isSafeInteger(value)&&value>=1&&value<=20?value:5;}
export async function scheduleFollowUp(records:Records,input:{id:string;kind:string;generation:number;due_at:string;payload?:unknown},at=Date.now()){
 validateFollowUpIdentity(input.id,input.generation);
 if(typeof input.kind!=='string'||!followUpKindPattern.test(input.kind)||typeof input.due_at!=='string'||timestamp(input.due_at)===undefined||timestamp(input.due_at)!==Date.parse(input.due_at))throw new Error('Follow-up schedule is invalid.');
 const payloadKey=followUpPayloadKey(input.payload);
 await records.lock('follow-up:'+input.id);
 const current=await records.get<FollowUpTask>('follow_up_tasks',input.id);
 if(current){
  const currentPayloadKey=followUpPayloadKey(current.payload);
  if(current.generation>input.generation)return {status:'stale' as const,task:current};
  if(current.generation===input.generation){
   if(current.kind===input.kind&&current.due_at===input.due_at&&currentPayloadKey===payloadKey)return {status:'duplicate' as const,task:current};
   return {status:'conflict' as const,task:current};
  }
  const replaced:FollowUpTask={id:input.id,kind:input.kind,generation:input.generation,due_at:input.due_at,status:'scheduled',attempts:0,created_at:iso(at),updated_at:iso(at),payload:input.payload,superseded_generation:current.generation};
  await records.put('follow_up_tasks',input.id,replaced);return {status:'superseded' as const,task:replaced};
 }
 const task:FollowUpTask={id:input.id,kind:input.kind,generation:input.generation,due_at:input.due_at,status:'scheduled',attempts:0,created_at:iso(at),updated_at:iso(at),payload:input.payload};
 await records.put('follow_up_tasks',input.id,task);return {status:'scheduled' as const,task};
}
export async function claimFollowUp(records:Records,id:string,generation:number,at=Date.now(),overdueGrace=300){
 validateFollowUpIdentity(id,generation);const grace=followUpGraceSeconds(overdueGrace);await records.lock('follow-up:'+id);const current=await records.get<FollowUpTask>('follow_up_tasks',id);
 if(!current)return {status:'missing' as const};
 if(current.generation!==generation)return {status:'stale' as const,task:current};
 if(current.status==='completed')return {status:'completed' as const,task:current};
 if(current.status==='blocked')return {status:'blocked' as const,task:current};
 const due=timestamp(current.due_at),retryAt=timestamp(current.retry_not_before);
 if(due===undefined){const blocked={...current,status:'blocked' as const,blocked_at:iso(at),updated_at:iso(at),last_error_code:'invalid_schedule',lease_until:undefined,claim_id:undefined};await records.put('follow_up_tasks',id,blocked);return {status:'blocked' as const,task:blocked};}
 if(retryAt!==undefined&&retryAt>at)return {status:'future' as const,task:current};
 if(due>at)return {status:'future' as const,task:current};
 if(at-due>grace*1000){const blocked={...current,status:'blocked' as const,blocked_at:iso(at),updated_at:iso(at),last_error_code:'overdue',lease_until:undefined,claim_id:undefined};await records.put('follow_up_tasks',id,blocked);return {status:'blocked' as const,task:blocked};}
 const lease=timestamp(current.lease_until);if(current.status==='processing'&&lease!==undefined&&lease>at)return {status:'leased' as const,task:current};
 const claimed:FollowUpTask={...current,status:'processing',attempts:(Number(current.attempts)||0)+1,lease_until:iso(at+5*60000),claim_id:randomUUID(),retry_not_before:undefined,retry_delay_seconds:undefined,updated_at:iso(at)};
 await records.put('follow_up_tasks',id,claimed);return {status:'claimed' as const,task:claimed};
}
export async function completeFollowUp(records:Records,input:{id:string;generation:number;claimId:string},at=Date.now()){
 validateFollowUpIdentity(input.id,input.generation);if(typeof input.claimId!=='string'||!input.claimId)throw new Error('Follow-up claim is invalid.');await records.lock('follow-up:'+input.id);const current=await records.get<FollowUpTask>('follow_up_tasks',input.id);
 if(!current)return {status:'missing' as const};if(current.generation!==input.generation||current.claim_id!==input.claimId)return {status:'stale' as const,task:current};if(current.status!=='processing')return {status:'not_claimed' as const,task:current};
 const completed:FollowUpTask={...current,status:'completed',completed_at:iso(at),updated_at:iso(at),lease_until:undefined,claim_id:undefined,retry_not_before:undefined,retry_delay_seconds:undefined,last_error_code:undefined};await records.put('follow_up_tasks',input.id,completed);return {status:'completed' as const,task:completed};
}
export async function failFollowUp(records:Records,input:{id:string;generation:number;claimId:string;errorCode:string},at=Date.now(),retryDelay=300,maxAttempts=5){
 validateFollowUpIdentity(input.id,input.generation);if(typeof input.claimId!=='string'||!input.claimId||typeof input.errorCode!=='string'||!/^[a-z0-9_]{1,64}$/.test(input.errorCode))throw new Error('Follow-up failure is invalid.');await records.lock('follow-up:'+input.id);const current=await records.get<FollowUpTask>('follow_up_tasks',input.id);
 if(!current)return {status:'missing' as const};if(current.generation!==input.generation||current.claim_id!==input.claimId)return {status:'stale' as const,task:current};if(current.status!=='processing')return {status:'not_claimed' as const,task:current};
 const terminal=(Number(current.attempts)||0)>=followUpMaxAttempts(maxAttempts),delay=followUpRetrySeconds(retryDelay),failed:FollowUpTask={...current,status:terminal?'blocked':'scheduled',updated_at:iso(at),blocked_at:terminal?iso(at):undefined,last_error_code:input.errorCode,lease_until:undefined,claim_id:undefined,...(terminal?{retry_not_before:undefined,retry_delay_seconds:undefined}:{retry_not_before:iso(at+delay*1000),retry_delay_seconds:delay})};await records.put('follow_up_tasks',input.id,failed);return {status:terminal?'blocked' as const:'scheduled' as const,task:failed};
}
export type BackupAttestationEvidence={completed_at:string;restore_verified_at:string;location_identifier:string;restore_reference:string;checksum:string};
export type BackupAttestationRequest={body:string;headers:Record<string,string>};
export function createBackupAttestationRequest(input:{evidence:BackupAttestationEvidence;deliveryId:string;attempt:number;keyId:string;secret:string;timestamp?:string}):BackupAttestationRequest{
 if(!input||typeof input!=='object'||!input.evidence||typeof input.keyId!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(input.keyId)||typeof input.deliveryId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(input.deliveryId)||!Number.isSafeInteger(input.attempt)||input.attempt<1||input.attempt>999999||typeof input.secret!=='string'||input.secret.length===0||input.secret.length>4096)throw new Error('Backup attestation signing inputs are invalid.');
 const evidence=input.evidence;
 if(typeof evidence.completed_at!=='string'||typeof evidence.restore_verified_at!=='string'||typeof evidence.location_identifier!=='string'||typeof evidence.restore_reference!=='string'||typeof evidence.checksum!=='string'||evidence.location_identifier.length>200||evidence.restore_reference.length>1000||evidence.checksum.length>80||Number.isNaN(Date.parse(evidence.completed_at))||Number.isNaN(Date.parse(evidence.restore_verified_at))||!/^https:\/\//.test(evidence.restore_reference)||!/^sha256:[a-f0-9]{64}$/.test(evidence.checksum))throw new Error('Backup attestation evidence is invalid.');
 const timestamp=input.timestamp??new Date().toISOString();
 if(typeof timestamp!=='string'||timestamp.length>128||Number.isNaN(Date.parse(timestamp)))throw new Error('Backup attestation timestamp is invalid.');
 const body=JSON.stringify({event:'mgt.backup.verified',backup:{...evidence,delivery_id:input.deliveryId,attempt:input.attempt}});
 if(Buffer.byteLength(body,'utf8')>65536)throw new Error('Backup attestation payload exceeds the safe delivery limit.');
 const contentDigest='sha256='+createHash('sha256').update(body).digest('hex');
 const signature='sha256='+createHmac('sha256',input.secret).update(`${timestamp}.${body}`).digest('hex');
 return {body,headers:{'content-type':'application/json','x-mgt-event':'mgt.backup.verified','x-mgt-signature-version':'v1','x-mgt-key-id':input.keyId,'x-mgt-delivery-id':input.deliveryId,'x-mgt-attempt':String(input.attempt),'x-mgt-timestamp':timestamp,'x-mgt-content-sha256':contentDigest,'x-mgt-signature':signature}};
}
export function verifyBackupAttestationRequest(input:{event:string;signatureVersion:string;keyId:string;deliveryId:string;attempt:string;timestamp:string;contentDigest:string;signature:string;body:string;secret:string;at?:number;maxAgeSeconds?:number}){
 if(!input||typeof input!=='object'||input.event!=='mgt.backup.verified'||input.signatureVersion!=='v1'||typeof input.keyId!=='string'||typeof input.deliveryId!=='string'||typeof input.attempt!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(input.keyId)||!/^[A-Za-z0-9_-]{8,128}$/.test(input.deliveryId)||!/^[1-9]\d{0,5}$/.test(input.attempt))return false;
 if(!/^sha256=[a-f0-9]{64}$/.test(input.contentDigest)||!timingSafeEqual(Buffer.from(input.contentDigest),Buffer.from('sha256='+createHash('sha256').update(input.body).digest('hex'))))return false;
 if(!verifyOperationsAlertSignature({timestamp:input.timestamp,signature:input.signature,body:input.body,secret:input.secret,at:input.at,maxAgeSeconds:input.maxAgeSeconds}))return false;
 try{const parsed=JSON.parse(input.body);return parsed?.event==='mgt.backup.verified'&&parsed?.backup?.delivery_id===input.deliveryId&&String(parsed?.backup?.attempt)===input.attempt;}catch{return false;}
}
const notificationId=(actor:string,reminder:Reminder)=>'reminder_'+createHash('sha256').update(`${actor}:${reminder.product_id}:${reminder.due_at}`).digest('hex').slice(0,40);
const notificationFailure=(error:unknown)=>{
 if(error instanceof Error&&error.message==='Notification payload exceeds the safe delivery limit.')return {code:'delivery_payload_rejected' as const,retryable:false};
 if(error instanceof NotificationDeliveryError){
  if(error.status>=400&&error.status<500&&error.status!==408&&error.status!==429)return {code:'delivery_rejected' as const,retryable:false};
  return {code:'delivery_unavailable' as const,retryable:true,retryAfterSeconds:error.retryAfterSeconds};
 }
 const status=error instanceof Error?Number(error.message.match(/^Notification delivery returned (\d{3})\.$/)?.[1]):0;
 if(status>=400&&status<500&&status!==408&&status!==429)return {code:'delivery_rejected' as const,retryable:false};
 return {code:'delivery_unavailable' as const,retryable:true};
};
const deletionFailureCode=(error:unknown):DeletionFailureCode=>{
 const status=error instanceof Error?Number(error.message.match(/^Supabase identity deletion returned (\d{3})\.$/)?.[1]):0;
 return status>=400&&status<500&&status!==408&&status!==429?'identity_rejected':'identity_unavailable';
};
const alertFailure=(error:unknown)=>{
 if(error instanceof Error&&error.message==='Operations alert payload exceeds the safe delivery limit.')return {code:'delivery_payload_rejected',retryable:false};
 if(error instanceof OperationsAlertDeliveryError){
  if(error.status>=400&&error.status<500&&error.status!==408&&error.status!==429)return {code:'delivery_rejected',retryable:false};
  return {code:'delivery_unavailable',retryable:true,retryAfterSeconds:error.retryAfterSeconds};
 }
 const status=error instanceof Error?Number(error.message.match(/^Operations alert delivery returned (\d{3})\.$/)?.[1]):0;
 if(status>=400&&status<500&&status!==408&&status!==429)return {code:'delivery_rejected',retryable:false};
 return {code:'delivery_unavailable',retryable:true};
};

export function verifyOperationsAlertSignature(input:{timestamp:string;signature:string;body:string;secret:string;at?:number;maxAgeSeconds?:number}){
 if(!input||typeof input!=='object'||typeof input.timestamp!=='string'||input.timestamp.length>128||typeof input.signature!=='string'||typeof input.body!=='string'||typeof input.secret!=='string'||input.secret.length===0||input.secret.length>4096||Buffer.byteLength(input.body,'utf8')>65536||!Number.isFinite(input.at??Date.now())||!Number.isFinite(input.maxAgeSeconds??300)||Number(input.maxAgeSeconds??300)<1||Number(input.maxAgeSeconds??300)>604800)return false;
 const at=input.at??Date.now(),received=timestamp(input.timestamp),maxAge=(input.maxAgeSeconds??300)*1000;
 if(!received||received>at+30000||at-received>maxAge||!input.secret||!/^sha256=[a-f0-9]{64}$/.test(input.signature))return false;
 const expected='sha256='+createHmac('sha256',input.secret).update(`${input.timestamp}.${input.body}`).digest('hex');
 return timingSafeEqual(Buffer.from(input.signature),Buffer.from(expected));
}

export function verifyOperationsAlertRequest(input:{event:string;signatureVersion:string;deliveryId:string;attempt:string;timestamp:string;contentDigest:string;signature:string;body:string;secret:string;at?:number;maxAgeSeconds?:number}){
 if(!input||typeof input!=='object'||typeof input.event!=='string'||typeof input.signatureVersion!=='string'||typeof input.deliveryId!=='string'||typeof input.attempt!=='string'||typeof input.contentDigest!=='string'||typeof input.timestamp!=='string'||typeof input.signature!=='string'||typeof input.body!=='string'||typeof input.secret!=='string'||input.event!=='operations.alert'||input.signatureVersion!=='v1'||!/^[-A-Za-z0-9_]{8,128}$/.test(input.deliveryId)||!/^[1-9]\d{0,5}$/.test(input.attempt))return false;
 if(!/^sha256=[a-f0-9]{64}$/.test(input.contentDigest)||!timingSafeEqual(Buffer.from(input.contentDigest),Buffer.from('sha256='+createHash('sha256').update(input.body).digest('hex'))))return false;
 if(Buffer.byteLength(input.body,'utf8')>65536||!verifyOperationsAlertSignature(input))return false;
 try{
  const parsed=JSON.parse(input.body);
  return parsed?.event==='mgt.operations.alert'&&parsed?.alert?.version==='1'&&parsed.alert.delivery_id===input.deliveryId&&Number(parsed.alert.attempt)===Number(input.attempt);
 }catch{return false;}
}

export function verifyNotificationRequest(input:{event:string;signatureVersion:string;keyId:string;notificationId:string;attempt:string;timestamp:string;contentDigest:string;signature:string;body:string;secret:string;at?:number;maxAgeSeconds?:number}){
 if(!input||typeof input!=='object'||typeof input.event!=='string'||typeof input.signatureVersion!=='string'||typeof input.keyId!=='string'||typeof input.notificationId!=='string'||typeof input.attempt!=='string'||typeof input.contentDigest!=='string'||typeof input.timestamp!=='string'||typeof input.signature!=='string'||typeof input.body!=='string'||typeof input.secret!=='string'||input.event!=='mgt.notification'||input.signatureVersion!=='v1'||!/^[A-Za-z0-9_-]{1,64}$/.test(input.keyId)||!/^[A-Za-z0-9_-]{1,128}$/.test(input.notificationId)||!/^[1-9]\d{0,5}$/.test(input.attempt))return false;
 if(!/^sha256=[a-f0-9]{64}$/.test(input.contentDigest)||!timingSafeEqual(Buffer.from(input.contentDigest),Buffer.from('sha256='+createHash('sha256').update(input.body).digest('hex'))))return false;
 if(Buffer.byteLength(input.body,'utf8')>65536||!verifyOperationsAlertSignature(input))return false;
 try{
  const parsed=JSON.parse(input.body);
  return parsed?.event==='mgt.notification'&&parsed?.notification?.id===input.notificationId&&Number(parsed.notification.attempts)===Number(input.attempt);
 }catch{return false;}
}

export function operationsAlertRetryAfterSeconds(value:string|null|undefined,at=Date.now()){
 if(typeof value!=='string'||value.length>128||!Number.isFinite(at))return undefined;
 if(!value)return undefined;
 if(/^\d{1,6}$/.test(value)){const seconds=Number(value);return seconds<=604800?seconds:undefined;}
 const then=Date.parse(value);return Number.isFinite(then)&&then>at&&then-at<=604800000?Math.ceil((then-at)/1000):undefined;
}
export function operationsAlertRetryDelaySeconds(baseSeconds:number,attempt:number,maxSeconds:number,receiverDelaySeconds=0){
 const base=Number.isFinite(baseSeconds)&&baseSeconds>=0?baseSeconds:0,tryNumber=Number.isSafeInteger(attempt)&&attempt>=1?attempt:1,max=Number.isFinite(maxSeconds)&&maxSeconds>=0?maxSeconds:0,receiver=Number.isFinite(receiverDelaySeconds)&&receiverDelaySeconds>=0?receiverDelaySeconds:0;
 return Math.min(604800,max,Math.max(base*Math.pow(2,tryNumber-1),receiver));
}

export function operationalReadiness(backup:any,runs:{value:any}[],at=Date.now(),workerMaxAgeMs=5*60000){
 workerMaxAgeMs=Number.isSafeInteger(workerMaxAgeMs)&&workerMaxAgeMs>=1000&&workerMaxAgeMs<=604800000?workerMaxAgeMs:0;
 const lastRun=runs.map(entry=>entry.value).filter(run=>run&&typeof run.completed_at==='string')
  .sort((a,b)=>Date.parse(b.completed_at)-Date.parse(a.completed_at))[0]||null;
 const lastCompleted=timestamp(lastRun?.completed_at);
 const workerHealthy=lastCompleted!==undefined&&lastCompleted<=at&&at-lastCompleted<=workerMaxAgeMs;
 const backupHealthy=backupEvidenceHealthy(backup,at);
 const issues=[!workerHealthy?'operations_worker_stale':null,!backupHealthy?'backup_unhealthy':null].filter(Boolean);
 return {healthy:issues.length===0,issues,last_run:lastRun,backup};
}

export function publicOperationalReadiness(result:any,at=Date.now()){
 const issues=Array.isArray(result?.issues)?result.issues.filter((item:unknown):item is string=>typeof item==='string').slice(0,10):[];
 const current=Number.isFinite(at)?at:Date.now(),backupLastSuccess=timestamp(result?.backup?.last_success_at),lastSuccessRecorded=backupLastSuccess!==undefined&&backupLastSuccess<=current;
 const backupHealthy=backupEvidenceHealthy(result?.backup,current)&&!issues.includes('backup_unhealthy')&&lastSuccessRecorded;
 const backupStatus=backupHealthy?'healthy':result?.backup?.status==='stale'?'stale':'unverified';
 return {
  healthy:result?.healthy===true&&issues.length===0&&backupHealthy,
  issues,
  worker:{healthy:!issues.includes('operations_worker_stale')},
  backup:{healthy:backupHealthy,status:backupStatus,last_success_recorded:lastSuccessRecorded}
 };
}

export function operationalSnapshot(input:{notifications:any[];deletions:any[];tickets:any[];runs:any[];webhooks:any[];follow_ups?:any[]},at=Date.now(),supportTargetHours=24){
 supportTargetHours=Number.isFinite(supportTargetHours)&&supportTargetHours>=1&&supportTargetHours<=168?supportTargetHours:24;
 const pendingNotifications=input.notifications.filter(item=>['queued','processing'].includes(item?.status));
 const pendingSince=pendingNotifications.map(item=>timestamp(item?.created_at||item?.scheduled_at)).filter((value):value is number=>value!==undefined&&value<=at);
 const dueDeletions=input.deletions.filter(item=>{const due=timestamp(item?.not_before);return due!==undefined&&due<=at&&['pending','processing'].includes(item?.status);});
 const openTickets=input.tickets.filter(item=>item?.status!=='closed');
 const overdueTickets=openTickets.filter(item=>{const changed=timestamp(item?.updated_at||item?.created_at);return changed!==undefined&&changed<=at&&at-changed>supportTargetHours*3600000;});
 const recentRuns=input.runs.filter(item=>{const completed=timestamp(item?.completed_at);return completed!==undefined&&completed<=at&&at-completed<=86400000;});
 const stalledWebhooks=input.webhooks.filter(item=>item?.status==='processing'&&(()=>{const received=timestamp(item?.last_received_at);return received!==undefined&&received<=at&&at-received>10*60000;})());
 const failedWebhooks=input.webhooks.filter(item=>item?.status==='failed');
 const followUps=input.follow_ups||[],blockedFollowUps=followUps.filter(item=>item?.status==='blocked'),dueFollowUps=followUps.filter(item=>{const due=timestamp(item?.due_at);return due!==undefined&&due<=at&&['scheduled','processing'].includes(item?.status);});
 const alerts=[
  input.notifications.some(item=>item?.status==='failed')?'notification_delivery_failures':null,
  pendingSince.length&&at-Math.min(...pendingSince)>15*60000?'notification_queue_aging':null,
  dueDeletions.some(item=>Array.isArray(item?.blocked_reasons)&&item.blocked_reasons.length||item?.last_error_code||item?.last_error)?'deletion_requests_blocked':null,
  overdueTickets.length?'support_response_target_missed':null,
  recentRuns.some(item=>(Number(item?.failed)||0)>0)?'worker_delivery_failures':null,
  failedWebhooks.length?'subscription_webhook_failures':null,
  stalledWebhooks.length?'subscription_webhook_stalled':null,
  blockedFollowUps.length?'follow_up_tasks_blocked':null
 ].filter((value):value is string=>!!value);
 return {
  healthy:alerts.length===0,
  alerts,
  notifications:{queued:input.notifications.filter(item=>item?.status==='queued').length,processing:input.notifications.filter(item=>item?.status==='processing').length,failed:input.notifications.filter(item=>item?.status==='failed').length,oldest_pending_minutes:pendingSince.length?Math.floor((at-Math.min(...pendingSince))/60000):0},
  deletions:{due:dueDeletions.length,blocked:dueDeletions.filter(item=>Array.isArray(item?.blocked_reasons)&&item.blocked_reasons.length||item?.last_error_code||item?.last_error).length,processing:dueDeletions.filter(item=>item?.status==='processing').length},
  support:{open:openTickets.length,overdue:overdueTickets.length,response_target_hours:supportTargetHours},
  worker:{runs_24h:recentRuns.length,delivery_failures_24h:recentRuns.reduce((total,item)=>total+(Number(item?.failed)||0),0)},
  subscriptions:{failed:failedWebhooks.length,stalled:stalledWebhooks.length},
  follow_ups:{scheduled:followUps.filter(item=>item?.status==='scheduled').length,processing:followUps.filter(item=>item?.status==='processing').length,completed:followUps.filter(item=>item?.status==='completed').length,blocked:blockedFollowUps.length,due:dueFollowUps.length}
 };
}

export async function aiRuntimeReadiness(env:NodeJS.ProcessEnv,fetchImpl:typeof fetch=fetch){
 if(String(env.OLLAMA_ENABLED).toLowerCase()!=='true')return {enabled:false,healthy:true};
 const base=String(env.OLLAMA_BASE_URL||'').replace(/\/$/,'');
 if(!base)return {enabled:true,healthy:false};
 const required=[env.OLLAMA_MODEL_PRIMARY||'llama3.2:3b',env.OLLAMA_MODEL_REASONING||'deepseek-r1:8b',env.OLLAMA_MODEL_EMBEDDING||'nomic-embed-text'];
 try{
  const response=await fetchImpl(base+'/api/tags',{signal:AbortSignal.timeout(3000)});
  if(!response.ok)return {enabled:true,healthy:false};
  const body=await response.json() as any;
  const installed=new Set(Array.isArray(body?.models)?body.models.flatMap((model:any)=>[model?.name,model?.model].filter((value:unknown):value is string=>typeof value==='string')):[]);
  return {enabled:true,healthy:required.every(model=>installed.has(model))};
 }catch{return {enabled:true,healthy:false};}
}

export async function writeWorkerHeartbeat(file:string,result:unknown){
 const temp=file+'.tmp';
 await writeFile(temp,JSON.stringify({updated_at:new Date().toISOString(),result}));
 await rename(temp,file);
}

export function notificationDeliveryFromEnv(env:NodeJS.ProcessEnv):NotificationDelivery{
 if(env.NOTIFICATION_DELIVERY==='webhook'){
  const url=env.NOTIFICATION_WEBHOOK_URL,token=env.NOTIFICATION_WEBHOOK_TOKEN;
  if(!url||!token)throw new Error('NOTIFICATION_WEBHOOK_URL and NOTIFICATION_WEBHOOK_TOKEN are required when webhook delivery is enabled.');
  const parsed=new URL(url);
  if(env.NODE_ENV==='production'&&parsed.protocol!=='https:')throw new Error('Production notification webhooks must use HTTPS.');
  const keyId=env.NOTIFICATION_WEBHOOK_KEY_ID||'primary';
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(keyId))throw new Error('NOTIFICATION_WEBHOOK_KEY_ID must contain only letters, numbers, underscores or hyphens.');
  const timeout=env.NOTIFICATION_WEBHOOK_TIMEOUT_MS,timeoutMs=Number(timeout);
  if(timeout!==undefined&&(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>30000))throw new Error('NOTIFICATION_WEBHOOK_TIMEOUT_MS must be a whole number between 1000 and 30000.');
  return new WebhookNotificationDelivery(parsed.toString(),token,keyId,int(timeout,10000,1000,30000));
 }
 if(env.NOTIFICATION_DELIVERY&&env.NOTIFICATION_DELIVERY!=='in_app')throw new Error('NOTIFICATION_DELIVERY must be in_app or webhook.');
 return new InAppNotificationDelivery();
}
export function operationsAlertDeliveryFromEnv(env:NodeJS.ProcessEnv):OperationsAlertDelivery{
 if(env.OPERATIONS_ALERT_DELIVERY==='webhook'){
  if(!env.OPERATIONS_ALERT_WEBHOOK_URL||!env.OPERATIONS_ALERT_WEBHOOK_TOKEN)throw new Error('OPERATIONS_ALERT_WEBHOOK_URL and OPERATIONS_ALERT_WEBHOOK_TOKEN are required when operational alerts are enabled.');
  const parsed=new URL(env.OPERATIONS_ALERT_WEBHOOK_URL);
  if(env.NODE_ENV==='production'&&parsed.protocol!=='https:')throw new Error('Production operations alert webhooks must use HTTPS.');
  const keyId=env.OPERATIONS_ALERT_KEY_ID||'primary';
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(keyId))throw new Error('OPERATIONS_ALERT_KEY_ID must contain only letters, numbers, underscores or hyphens.');
  return new WebhookOperationsAlertDelivery(parsed.toString(),env.OPERATIONS_ALERT_WEBHOOK_TOKEN,int(env.OPERATIONS_ALERT_TIMEOUT_MS,10000,1000,30000),keyId);
 }
 if(env.OPERATIONS_ALERT_DELIVERY&&env.OPERATIONS_ALERT_DELIVERY!=='disabled')throw new Error('OPERATIONS_ALERT_DELIVERY must be disabled or webhook.');
 return new DisabledOperationsAlertDelivery();
}
export function identityDeletionFromEnv(env:NodeJS.ProcessEnv):IdentityDeletion{
 if(!env.SUPABASE_URL)return new LocalIdentityDeletion();
 if(!env.SUPABASE_SERVICE_ROLE_KEY)return new MissingIdentityDeletion();
 return new SupabaseIdentityDeletion(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Small, restart-safe maintenance loop. It uses durable records and leases so a
 * second worker cannot send the same notification while the first is active.
 */
export class OperationalWorker{
 private running=false;
 private env:NodeJS.ProcessEnv;
 private delivery:NotificationDelivery;
 private identityDeletion:IdentityDeletion;
 private alertDelivery:OperationsAlertDelivery;
 private followUp?:FollowUpExecutor;
 constructor(private store:Store,options:WorkerOptions={}){this.env=options.env||process.env;this.delivery=options.delivery||notificationDeliveryFromEnv(this.env);this.identityDeletion=options.identityDeletion||identityDeletionFromEnv(this.env);this.alertDelivery=options.alertDelivery||operationsAlertDeliveryFromEnv(this.env);this.followUp=options.followUp;}
 async runOnce(at=Date.now()):Promise<WorkerResult>{
  if(this.running)throw new Error('Operational worker is already running.');
  this.running=true;
  const runId=randomUUID();
  try{
   const staged=await this.store.tx(async records=>{
    await records.lock('operations:maintenance');
    const removed=await this.prune(records,at);
    const created=await this.enqueueDueReminders(records,at);
    const backup_status=await this.verifyBackup(records,at);
    await records.put('operation_runs',runId,{id:runId,started_at:iso(at),created,removed,backup_status,delivery:this.delivery.kind});
    return {created,removed,backup_status};
   });
   const follow_ups=await this.processFollowUps(at);
   const deletions=await this.processDeletionRequests(at);
   let delivered=0,failed=0;
   for(const entry of await this.store.tx(records=>records.entries<Notification>('notifications'))){
    const outcome=await this.deliver(entry.id,at);
    if(outcome==='delivered')delivered++;if(outcome==='failed')failed++;
   }
   await this.store.tx(async records=>{const run=await records.get<any>('operation_runs',runId);if(run)await records.put('operation_runs',runId,{...run,completed_at:iso(),delivered,failed,follow_ups,...deletions});});
   await this.publishOperationalAlert(at,runId);
   return {run_id:runId,...staged,...deletions,delivered,failed,follow_ups};
  }finally{this.running=false;}
 }
 private async processFollowUps(at:number):Promise<FollowUpStats>{
  const stats:FollowUpStats={completed:0,blocked:0,failed:0,future:0,stale:0};
  const entries=await this.store.tx(records=>records.entries<FollowUpTask>('follow_up_tasks'));
  const grace=followUpGraceSeconds(Number(this.env.OPERATIONS_FOLLOW_UP_OVERDUE_GRACE_SECONDS)||300),retry=followUpRetrySeconds(Number(this.env.OPERATIONS_FOLLOW_UP_RETRY_DELAY_SECONDS)||300),maxAttempts=followUpMaxAttempts(Number(this.env.OPERATIONS_FOLLOW_UP_MAX_ATTEMPTS)||5);
  for(const entry of entries){
   const task=entry.value;if(!task||!['scheduled','processing'].includes(task.status))continue;
   const claimed=await this.store.tx(records=>claimFollowUp(records,entry.id,task.generation,at,grace));
   if(['future','leased'].includes(claimed.status)){stats.future++;continue;}
   if(claimed.status==='blocked'){stats.blocked++;continue;}
   if(claimed.status!=='claimed'){if(claimed.status==='stale')stats.stale++;continue;}
   if(!this.followUp){const failed=await this.store.tx(records=>failFollowUp(records,{id:entry.id,generation:task.generation,claimId:claimed.task.claim_id!,errorCode:'executor_unconfigured'},at,0,1));if(failed.status==='blocked')stats.blocked++;else if(failed.status==='stale')stats.stale++;else stats.failed++;continue;}
   try{await this.followUp.execute(claimed.task);const completed=await this.store.tx(records=>completeFollowUp(records,{id:entry.id,generation:task.generation,claimId:claimed.task.claim_id!},at));if(completed.status==='completed')stats.completed++;else stats.stale++;}
   catch{const failed=await this.store.tx(records=>failFollowUp(records,{id:entry.id,generation:task.generation,claimId:claimed.task.claim_id!,errorCode:'executor_failed'},at,retry,maxAttempts));if(failed.status==='blocked')stats.blocked++;else if(failed.status==='stale')stats.stale++;else stats.failed++;}
  }
  return stats;
 }
 private async publishOperationalAlert(at:number,runId:string){
  if(this.alertDelivery.kind==='disabled')return;
  const claimed=await this.store.tx(async records=>{
   await records.lock('operations:alert-publish');
   const snapshot=operationalSnapshot({notifications:(await records.entries<any>('notifications')).map(item=>item.value),deletions:(await records.entries<any>('deletion_requests')).map(item=>item.value),tickets:await records.list<any>('tickets'),runs:(await records.entries<any>('operation_runs')).map(item=>item.value),webhooks:await records.list<any>('subscription_webhook_receipts'),follow_ups:(await records.entries<any>('follow_up_tasks')).map(item=>item.value)},at,int(this.env.SUPPORT_RESPONSE_TARGET_HOURS,24,1,168));
   const previous=await records.get<any>('operations','alert_state'),status=snapshot.alerts.length?'active':'resolved';
   if(status==='resolved'&&previous?.status!=='active')return null;
   const fingerprint=createHash('sha256').update(JSON.stringify({status,alerts:[...snapshot.alerts].sort()})).digest('hex');
   if(previous?.fingerprint===fingerprint&&['delivered','abandoned'].includes(previous?.delivery_status))return null;
   if(previous?.fingerprint===fingerprint&&previous?.delivery_status==='sending'&&(timestamp(previous?.lease_until)||0)>at)return null;
   if(previous?.fingerprint===fingerprint&&previous?.delivery_status==='failed'&&(timestamp(previous?.retry_not_before)||0)>at)return null;
   const attempt=(previous?.fingerprint===fingerprint?Number(previous?.attempts)||0:0)+1,deliveryId=previous?.fingerprint===fingerprint&&typeof previous?.delivery_id==='string'?previous.delivery_id:randomUUID(),leaseSeconds=int(this.env.OPERATIONS_ALERT_LEASE_SECONDS,60,10,600),leaseUntil=iso(at+leaseSeconds*1000),claimId=randomUUID(),alert:OperationsAlert={version:'1',delivery_id:deliveryId,attempt,status,alerts:snapshot.alerts,summary:snapshot,generated_at:iso(at)},eventId=randomUUID();
   await records.put('operations','alert_state',{status,fingerprint,delivery_id:deliveryId,delivery_status:'sending',attempts:attempt,last_attempt_at:iso(at),lease_until:leaseUntil,claim_id:claimId});
   return {alert,status,fingerprint,attempt,deliveryId,eventId,claimId};
  });
  if(!claimed)return;
  const {alert,status,fingerprint,attempt,deliveryId,eventId,claimId}=claimed;
  try{
   await this.alertDelivery.deliver(alert);
   await this.store.tx(async records=>{await records.lock('operations:alert-publish');const current=await records.get<any>('operations','alert_state');const stale=current?.delivery_status!=='sending'||current?.claim_id!==claimId;if(stale){await records.put('operations_alert_events',eventId,{event_id:eventId,delivery_id:deliveryId,status,alerts:alert.alerts,delivery_status:'superseded',attempt:attempt,attempted_at:iso(at)});const run=await records.get<any>('operation_runs',runId);if(run)await records.put('operation_runs',runId,{...run,alert_delivery:'superseded'});return;}await records.put('operations','alert_state',{status,fingerprint,delivery_id:deliveryId,delivery_status:'delivered',attempts:attempt,last_attempt_at:iso(at),delivered_at:iso(at)});await records.put('operations_alert_events',eventId,{event_id:eventId,delivery_id:deliveryId,status,alerts:alert.alerts,delivery_status:'delivered',attempt:attempt,attempted_at:iso(at)});const run=await records.get<any>('operation_runs',runId);if(run)await records.put('operation_runs',runId,{...run,alert_delivery:'delivered'});});
  }catch(error){
   const retryBase=int(this.env.OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS,300,10,3600),retryMax=int(this.env.OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS,3600,10,86400);
   const failure=alertFailure(error),maxAttempts=int(this.env.OPERATIONS_ALERT_MAX_ATTEMPTS,5,1,20),terminal=!failure.retryable||attempt>=maxAttempts;
   const retryDelaySeconds=terminal?undefined:operationsAlertRetryDelaySeconds(retryBase,attempt,retryMax,failure.retryAfterSeconds||0),deliveryStatus=terminal?'abandoned':'failed',retryNotBefore=retryDelaySeconds===undefined?undefined:iso(at+retryDelaySeconds*1000);
   await this.store.tx(async records=>{await records.lock('operations:alert-publish');const current=await records.get<any>('operations','alert_state');const stale=current?.delivery_status!=='sending'||current?.claim_id!==claimId;if(stale){await records.put('operations_alert_events',eventId,{event_id:eventId,delivery_id:deliveryId,status,alerts:alert.alerts,delivery_status:'superseded',attempt:attempt,error_code:failure.code,attempted_at:iso(at)});const run=await records.get<any>('operation_runs',runId);if(run)await records.put('operation_runs',runId,{...run,alert_delivery:'superseded'});return;}await records.put('operations','alert_state',{status,fingerprint,delivery_id:deliveryId,delivery_status:deliveryStatus,attempts:attempt,last_attempt_at:iso(at),...(retryNotBefore?{retry_not_before:retryNotBefore,retry_delay_seconds:retryDelaySeconds}:{}),last_error_code:failure.code});await records.put('operations_alert_events',eventId,{event_id:eventId,delivery_id:deliveryId,status,alerts:alert.alerts,delivery_status:deliveryStatus,attempt:attempt,error_code:failure.code,attempted_at:iso(at),...(retryNotBefore?{retry_not_before:retryNotBefore,retry_delay_seconds:retryDelaySeconds}:{}),terminal});const run=await records.get<any>('operation_runs',runId);if(run)await records.put('operation_runs',runId,{...run,alert_delivery:deliveryStatus});});
  }
 }
 private async prune(records:Records,at:number){
  const policies=[
   ['sessions',0,(v:any)=>Number(v?.expires)],
   ['rate',0,(v:any)=>Number(v?.reset)],
   ['profile_merge_pending',0,(v:any)=>timestamp(v?.expires_at)],
   ['ai_routing_log',int(this.env.OPERATIONS_AI_LOG_RETENTION_DAYS,30,1,3650),(v:any)=>timestamp(v?.at||v?.created_at||v?.timestamp)],
   ['anti_aging_ai_events',int(this.env.OPERATIONS_AI_LOG_RETENTION_DAYS,30,1,3650),(v:any)=>timestamp(v?.created_at)],
   ['anti_aging_ai_feedback',int(this.env.OPERATIONS_AI_LOG_RETENTION_DAYS,30,1,3650),(v:any)=>timestamp(v?.created_at)],
   ['anti_aging_referral_clicks',int(this.env.OPERATIONS_ANTI_AGING_RETENTION_DAYS,365,30,3650),(v:any)=>timestamp(v?.day)],
   ['anti_aging_search_metrics',int(this.env.OPERATIONS_ANTI_AGING_RETENTION_DAYS,365,30,3650),(v:any)=>timestamp(v?.day)],
   ['anti_aging_progress',int(this.env.OPERATIONS_ANTI_AGING_RETENTION_DAYS,365,30,3650),(v:any)=>timestamp(v?.created_at)],
   ['anti_aging_reminders',int(this.env.OPERATIONS_ANTI_AGING_RETENTION_DAYS,365,30,3650),(v:any)=>timestamp(v?.updated_at||v?.created_at)],
   ['anti_aging_appointment_requests',int(this.env.OPERATIONS_ANTI_AGING_RETENTION_DAYS,365,30,3650),(v:any)=>timestamp(v?.updated_at||v?.created_at)],
   ['notifications',int(this.env.OPERATIONS_NOTIFICATION_RETENTION_DAYS,90,1,3650),(v:any)=>timestamp(v?.delivered_at||v?.read_at||v?.updated_at)],
   ['billing_activity',int(this.env.OPERATIONS_BILLING_RETENTION_DAYS,730,30,3650),(v:any)=>timestamp(v?.at)],
   ['subscription_webhook_receipts',int(this.env.OPERATIONS_WEBHOOK_RECEIPT_RETENTION_DAYS,90,7,3650),(v:any)=>timestamp(v?.last_received_at||v?.first_received_at)],
   ['support_metrics',int(this.env.OPERATIONS_AGGREGATE_METRIC_RETENTION_DAYS,180,30,3650),(v:any)=>timestamp(v?.updated_at||v?.date)],
   ['referral_metrics',int(this.env.OPERATIONS_AGGREGATE_METRIC_RETENTION_DAYS,180,30,3650),(v:any)=>timestamp(v?.updated_at||v?.date)],
   ['deletion_completions',int(this.env.OPERATIONS_DELETION_PROOF_RETENTION_DAYS,730,30,3650),(v:any)=>timestamp(v?.completed_at)],
   ['operation_runs',int(this.env.OPERATIONS_RUN_RETENTION_DAYS,90,1,3650),(v:any)=>timestamp(v?.completed_at||v?.started_at)],
   ['follow_up_tasks',int(this.env.OPERATIONS_FOLLOW_UP_RETENTION_DAYS,365,30,3650),(v:any)=>['completed','blocked'].includes(v?.status)?timestamp(v?.completed_at||v?.blocked_at||v?.updated_at):undefined],
   ['operations_alert_events',int(this.env.OPERATIONS_ALERT_EVENT_RETENTION_DAYS,90,1,3650),(v:any)=>timestamp(v?.attempted_at)],
   ['backup_attestations',int(this.env.OPERATIONS_BACKUP_ATTESTATION_RETENTION_DAYS,90,1,3650),(v:any)=>timestamp(v?.received_at)]
  ] as const;
  let removed=0;
  for(const [scope,days,date] of policies){for(const entry of await records.entries(scope)){const then=date(entry.value);if(then!==undefined&&then<at-days*86400000){await records.remove(scope,entry.id);removed++;}}}
  return removed;
 }
 private async enqueueDueReminders(records:Records,at:number){
  let created=0;
  for(const entry of await records.entries<Reminder[]>('reminders')){
   if(!Array.isArray(entry.value))continue;
   let changed=false;
   const reminders:Reminder[]=[];
   for(const reminder of entry.value){
    const due=timestamp(reminder?.due_at);
    if(!reminder||reminder.paused||due===undefined||due>at||reminder.notification_id){reminders.push(reminder);continue;}
    const id=notificationId(entry.id,reminder),created_at=iso(at);
    await records.put('notifications',id,{id,actor:entry.id,kind:'replenishment_reminder',status:'queued',scheduled_at:reminder.due_at,created_at,updated_at:created_at,attempts:0,payload:{product_id:reminder.product_id,due_at:reminder.due_at}} satisfies Notification);
    changed=true;created++;
    reminders.push({...reminder,notification_id:id,last_notified_at:created_at});
   }
   if(changed)await records.put('reminders',entry.id,reminders);
  }
  for(const entry of await records.entries<ProgressReminder>('anti_aging_reminders')){
   const reminder=entry.value,due=timestamp(reminder?.next_at);
   if(!reminder||reminder.paused||due===undefined||due>at)continue;
   const id='aa_notification_'+createHash('sha256').update(`${entry.id}:${reminder.next_at}`).digest('hex').slice(0,40),created_at=iso(at);
   await records.put('notifications',id,{id,actor:reminder.actor,kind:'anti_aging_progress_reminder',status:'queued',scheduled_at:reminder.next_at,created_at,updated_at:created_at,attempts:0,payload:{entry_id:reminder.entry_id,due_at:reminder.next_at,cadence:reminder.cadence}} satisfies Notification);
   await records.put('anti_aging_reminders',entry.id,advanceProgressReminder(reminder,at));
   created++;
  }
  return created;
 }
 private async verifyBackup(records:Records,at:number):Promise<'healthy'|'stale'|'unverified'>{
  const maxAge=int(this.env.BACKUP_MAX_AGE_HOURS,26,1,24*30)*3600000;
  const restoreMaxAge=int(this.env.BACKUP_RESTORE_MAX_AGE_DAYS,90,1,365)*86400000;
  const latest=await records.get<any>('backup_status','latest');
  const completed=timestamp(latest?.completed_at);
  const restoreVerified=timestamp(latest?.restore_verified_at);
  const validTimes=completed!==undefined&&completed<=at&&restoreVerified!==undefined&&restoreVerified<=at;
  const status=!validTimes?'unverified':at-completed<=maxAge&&at-restoreVerified<=restoreMaxAge?'healthy':'stale';
  await records.put('operations','backup_health',{status,checked_at:iso(at),max_age_hours:maxAge/3600000,restore_max_age_days:restoreMaxAge/86400000,last_success_at:completed===undefined?null:iso(completed),restore_verified_at:restoreVerified===undefined?null:iso(restoreVerified),location_identifier:typeof latest?.location_identifier==='string'?latest.location_identifier:null,restore_reference:typeof latest?.restore_reference==='string'?latest.restore_reference:null});
  return status;
 }
 private async processDeletionRequests(at:number){
  let deletions_completed=0,deletions_blocked=0;
  const requests=await this.store.tx(records=>records.entries<any>('deletion_requests'));
  for(const entry of requests){
   const claimed=await this.store.tx(async records=>{
    await records.lock('account-deletion:'+createHash('sha256').update(entry.id).digest('hex'));
    const stored=await records.get<any>('deletion_requests',entry.id);
    if(!stored)return null;
    const request={...stored,request_id:stored.request_id||randomUUID(),user_id:stored.user_id||(typeof stored.actor==='string'&&stored.actor.startsWith('user_')?stored.actor.slice(5):undefined)};
    const due=timestamp(request.not_before),lease=timestamp(request.lease_until);
    if(due===undefined||due>at||!['pending','processing'].includes(request.status)||request.status==='processing'&&lease!==undefined&&lease>at)return null;
    const blockers=await this.deletionBlockers(records,request);
    if(blockers.length){
     await records.put('deletion_requests',entry.id,{...request,status:'pending',blocked_reasons:blockers,last_checked_at:iso(at),lease_until:undefined,claim_id:undefined,last_error:undefined,last_error_code:undefined});
     return {blocked:true} as const;
    }
    const processing={...request,status:'processing',attempts:(request.attempts||0)+1,blocked_reasons:[],last_checked_at:iso(at),lease_until:iso(at+10*60000),claim_id:randomUUID(),last_error:undefined,last_error_code:undefined};
    await records.put('deletion_requests',entry.id,processing);
    return {blocked:false,request:processing} as const;
   });
   if(!claimed)continue;
   if(claimed.blocked){deletions_blocked++;continue;}
   try{
    await this.identityDeletion.remove(claimed.request.user_id);
    await this.store.tx(async records=>{
     await records.lock('account-deletion:'+createHash('sha256').update(entry.id).digest('hex'));
     const current=await records.get<any>('deletion_requests',entry.id);
     if(!current||current.status!=='processing'||current.claim_id!==claimed.request.claim_id)return;
     await this.eraseAccount(records,current,at);
    });
    deletions_completed++;
   }catch(error){
    await this.store.tx(async records=>{
     await records.lock('account-deletion:'+createHash('sha256').update(entry.id).digest('hex'));
     const current=await records.get<any>('deletion_requests',entry.id);
     if(current?.claim_id===claimed.request.claim_id)await records.put('deletion_requests',entry.id,{...current,status:'pending',lease_until:undefined,claim_id:undefined,last_error:undefined,last_error_code:deletionFailureCode(error),last_checked_at:iso(at)});
    });
    deletions_blocked++;
   }
  }
  return {deletions_completed,deletions_blocked};
 }
 private async deletionBlockers(records:Records,request:any){
  const actor=request.actor,userId=request.user_id;
  if(typeof actor!=='string'||typeof userId!=='string'||actor!==`user_${userId}`)return ['invalid_identity'];
  const blockers:string[]=[];
  const account=await records.get<any>('accounts',userId);
  if(Array.isArray(account?.roles)&&account.roles.length)blockers.push('operator_access_assigned');
  const terminalSubscriptions=new Set(['canceled','incomplete_expired']);
  const subscription=await records.get<any>('subscriptions',`${actor}:consumer`);
  if(subscription&&(subscription.customer_id||subscription.subscription_id)&&!terminalSubscriptions.has(subscription.status))blockers.push('active_consumer_subscription');
  const membership=await records.get<any>('memberships',actor);
  if(membership?.premium===true||['active','trialing','past_due','unpaid','incomplete','paused'].includes(membership?.status))blockers.push('active_legacy_membership');
  if((await records.list<any>('subscription_pending')).some(item=>item.actor===actor))blockers.push('pending_subscription_change');
  if((await records.list<any>('orders')).some(order=>order.actor===actor&&!['canceled','refunded','fulfilled'].includes(order.status)))blockers.push('open_order');
  if((await records.entries<any>('ai_budget_reservations')).some(item=>this.belongsToUser(item.value?.budget_key,actor,userId)&&item.value?.status==='reserved'))blockers.push('pending_ai_charge');
  const imageActor=createHash('sha256').update(actor).digest('hex');
  if((await records.list<any>('client_image_drive')).some(item=>item.actor===imageActor))blockers.push('test_drive_images_present');
  return [...new Set(blockers)];
 }
 private belongsToUser(value:unknown,actor:string,userId:string){
  return typeof value==='string'&&(value===actor||value===userId||value.includes(`:${actor}:`)||value.includes(`:${userId}:`)||value.startsWith(actor+':')||value.startsWith(userId+':')||value.endsWith(':'+actor)||value.endsWith(':'+userId));
 }
 private async eraseAccount(records:Records,request:any,at:number){
  const actor=request.actor,userId=request.user_id,tombstone=`deleted_${request.request_id}`;
  const account=await records.get<any>('accounts',userId);
  for(const item of await records.entries<any>('profile_merge_pending'))if(item.value?.account_id===userId||item.value?.guest_actor===actor)await records.remove('profile_merge_pending',item.id);
  for(const item of await records.entries<any>('guest_invitations'))if(item.value.owner_actor===actor||item.value.guest_actor===actor||item.value.email===account?.email)await records.remove('guest_invitations',item.id);
  await records.remove('guest_memberships',actor);
  for(const scope of ['account_profiles','profiles','profile_revisions','style_profiles','wardrobes','reminders','anti_aging_reminders','saved_retailers','carts','memberships'])await records.remove(scope,actor);
  await records.remove('checkout_requests','premium_'+actor);
  for(const scope of ['subscriptions','billing_attempts'])await records.remove(scope,`${actor}:consumer`);
  for(const scope of ['sessions','notifications','tickets','ai_routing_log','anti_aging_ai_events','anti_aging_ai_feedback','anti_aging_progress','anti_aging_reminders','anti_aging_appointment_requests','regimen_cycles','regimen_cycle_check_ins','ai_budget','ai_budget_reservations','ai_budget_reconciliations','rate','subscription_commands','subscription_pending']){
   for(const item of await records.entries<any>(scope)){
    const value=item.value;
    const owned=value?.actor===actor||value?.actor===userId||value?.userId===userId||value?.user_id===actor||value?.user_id===userId||this.belongsToUser(item.id,actor,userId)||this.belongsToUser(value?.budget_key,actor,userId);
    if(owned)await records.remove(scope,item.id);
   }
  }
  for(const item of await records.entries<any>('orders'))if(item.value?.actor===actor)await records.put('orders',item.id,{...item.value,actor:tombstone,email:null,checkout_url:undefined,customer_id:undefined});
  for(const item of await records.entries<any>('billing_activity'))if(typeof item.value?.actor==='string'&&item.value.actor.startsWith(actor+':'))await records.put('billing_activity',item.id,{...item.value,actor:tombstone+item.value.actor.slice(actor.length)});
  for(const item of await records.entries<any>('audit'))if(item.value?.actor===actor||item.value?.actor===userId||item.value?.target===actor||item.value?.target===userId)await records.put('audit',item.id,{...item.value,actor:item.value.actor===actor||item.value.actor===userId?tombstone:item.value.actor,target:item.value.target===actor||item.value.target===userId?tombstone:item.value.target});
  for(const item of await records.entries<any>('operator_role_changes'))if(item.value?.operator_id===userId||item.value?.target_id===userId)await records.put('operator_role_changes',item.id,{...item.value,operator_id:item.value.operator_id===userId?tombstone:item.value.operator_id,target_id:item.value.target_id===userId?tombstone:item.value.target_id});
  await records.remove('accounts',userId);
  await records.remove('deletion_requests',actor);
  await records.put('deletion_completions',request.request_id,{request_id:request.request_id,requested_at:request.requested_at,completed_at:iso(at),identity_provider:this.identityDeletion.kind});
 }
 private async deliver(id:string,at:number):Promise<'delivered'|'failed'|'skipped'>{
  const claimed=await this.store.tx(async records=>{
   await records.lock('notification:'+id);
   const notification=await records.get<Notification>('notifications',id);
   if(!notification||notification.status==='delivered'||notification.status==='read'||notification.status==='failed')return undefined;
   const lease=timestamp(notification.lease_until),retryNotBefore=timestamp(notification.retry_not_before);
   if(notification.status==='processing'&&lease!==undefined&&lease>at||notification.status==='queued'&&retryNotBefore!==undefined&&retryNotBefore>at)return undefined;
    const processing={...notification,status:'processing' as const,attempts:notification.attempts+1,lease_until:iso(at+5*60000),claim_id:randomUUID(),retry_not_before:undefined,retry_delay_seconds:undefined,updated_at:iso(at)};
   await records.put('notifications',id,processing);return processing;
  });
  if(!claimed)return 'skipped';
  try{
    await this.delivery.deliver(claimed);
    const completed=await this.store.tx(async records=>{await records.lock('notification:'+id);const current=await records.get<Notification>('notifications',id);if(!current||current.status!=='processing'||current.claim_id!==claimed.claim_id)return false;await records.put('notifications',id,{...current,status:'delivered',delivered_at:iso(),lease_until:undefined,claim_id:undefined,retry_not_before:undefined,retry_delay_seconds:undefined,last_error_code:undefined,updated_at:iso()});return true;});
   return completed?'delivered':'skipped';
  }catch(error){
    const retryBase=int(this.env.NOTIFICATION_RETRY_COOLDOWN_SECONDS,300,10,3600),retryMax=int(this.env.NOTIFICATION_MAX_RETRY_DELAY_SECONDS,3600,10,86400),failure=notificationFailure(error),maxAttempts=int(this.env.NOTIFICATION_MAX_ATTEMPTS,3,1,20),terminal=!failure.retryable||claimed.attempts>=maxAttempts,retryDelaySeconds=terminal?undefined:operationsAlertRetryDelaySeconds(retryBase,claimed.attempts,retryMax,failure.retryAfterSeconds||0),retryNotBefore=retryDelaySeconds===undefined?undefined:iso(at+retryDelaySeconds*1000);
    const completed=await this.store.tx(async records=>{await records.lock('notification:'+id);const current=await records.get<Notification>('notifications',id);if(!current||current.status!=='processing'||current.claim_id!==claimed.claim_id)return false;await records.put('notifications',id,{...current,status:terminal?'failed':'queued',lease_until:undefined,claim_id:undefined,...(retryNotBefore?{retry_not_before:retryNotBefore,retry_delay_seconds:retryDelaySeconds}:{}),last_error_code:failure.code,updated_at:iso()});return true;});
   return completed?'failed':'skipped';
  }
 }
}
