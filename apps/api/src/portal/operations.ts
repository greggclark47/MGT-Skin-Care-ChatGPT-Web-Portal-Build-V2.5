import { createHash, randomUUID } from 'node:crypto';
import type { Records, Store } from './store';

type Notification={id:string;actor:string;kind:'replenishment_reminder';status:'queued'|'processing'|'delivered'|'failed'|'read';scheduled_at:string;created_at:string;updated_at:string;attempts:number;payload:{product_id:string;due_at:string};lease_until?:string;delivered_at?:string;read_at?:string;last_error?:string};
type Reminder={product_id:string;due_at:string;paused?:boolean;notification_id?:string;last_notified_at?:string};
type WorkerOptions={env?:NodeJS.ProcessEnv;delivery?:NotificationDelivery};
export type WorkerResult={run_id:string;created:number;delivered:number;failed:number;removed:number;backup_status:'healthy'|'stale'|'unverified'};

export interface NotificationDelivery{kind:string;deliver(notification:Notification):Promise<void>}
export class InAppNotificationDelivery implements NotificationDelivery{
 kind='in_app';
 async deliver(_notification:Notification){}
}
export class WebhookNotificationDelivery implements NotificationDelivery{
 kind='webhook';
 constructor(private url:string,private secret?:string){}
 async deliver(notification:Notification){
  const response=await fetch(this.url,{method:'POST',headers:{'content-type':'application/json',...(this.secret?{authorization:`Bearer ${this.secret}`}:{})},body:JSON.stringify({event:'mgt.notification',notification}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error(`Notification delivery returned ${response.status}.`);
 }
}
const iso=(ms=Date.now())=>new Date(ms).toISOString();
const timestamp=(value:any)=>typeof value==='string'&&!Number.isNaN(Date.parse(value))?Date.parse(value):undefined;
const int=(value:string|undefined,fallback:number,min:number,max:number)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>=min&&parsed<=max?parsed:fallback;};
const notificationId=(actor:string,reminder:Reminder)=>'reminder_'+createHash('sha256').update(`${actor}:${reminder.product_id}:${reminder.due_at}`).digest('hex').slice(0,40);

export function notificationDeliveryFromEnv(env:NodeJS.ProcessEnv):NotificationDelivery{
 if(env.NOTIFICATION_DELIVERY==='webhook'){
  const url=env.NOTIFICATION_WEBHOOK_URL;
  if(!url)throw new Error('NOTIFICATION_WEBHOOK_URL is required when webhook delivery is enabled.');
  const parsed=new URL(url);
  if(env.NODE_ENV==='production'&&parsed.protocol!=='https:')throw new Error('Production notification webhooks must use HTTPS.');
  return new WebhookNotificationDelivery(parsed.toString(),env.NOTIFICATION_WEBHOOK_TOKEN);
 }
 if(env.NOTIFICATION_DELIVERY&&env.NOTIFICATION_DELIVERY!=='in_app')throw new Error('NOTIFICATION_DELIVERY must be in_app or webhook.');
 return new InAppNotificationDelivery();
}

/**
 * Small, restart-safe maintenance loop. It uses durable records and leases so a
 * second worker cannot send the same notification while the first is active.
 */
export class OperationalWorker{
 private running=false;
 private env:NodeJS.ProcessEnv;
 private delivery:NotificationDelivery;
 constructor(private store:Store,options:WorkerOptions={}){this.env=options.env||process.env;this.delivery=options.delivery||notificationDeliveryFromEnv(this.env);}
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
   let delivered=0,failed=0;
   for(const entry of await this.store.tx(records=>records.entries<Notification>('notifications'))){
    const outcome=await this.deliver(entry.id,at);
    if(outcome==='delivered')delivered++;if(outcome==='failed')failed++;
   }
   await this.store.tx(async records=>{const run=await records.get<any>('operation_runs',runId);if(run)await records.put('operation_runs',runId,{...run,completed_at:iso(),delivered,failed});});
   return {run_id:runId,...staged,delivered,failed};
  }finally{this.running=false;}
 }
 private async prune(records:Records,at:number){
  const policies=[
   ['sessions',0,(v:any)=>Number(v?.expires)],
   ['rate',0,(v:any)=>Number(v?.reset)],
   ['ai_routing_log',int(this.env.OPERATIONS_AI_LOG_RETENTION_DAYS,30,1,3650),(v:any)=>timestamp(v?.at||v?.created_at||v?.timestamp)],
   ['notifications',int(this.env.OPERATIONS_NOTIFICATION_RETENTION_DAYS,90,1,3650),(v:any)=>timestamp(v?.delivered_at||v?.read_at||v?.updated_at)],
   ['billing_activity',int(this.env.OPERATIONS_BILLING_RETENTION_DAYS,730,30,3650),(v:any)=>timestamp(v?.at)],
   ['operation_runs',int(this.env.OPERATIONS_RUN_RETENTION_DAYS,90,1,3650),(v:any)=>timestamp(v?.completed_at||v?.started_at)]
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
  return created;
 }
 private async verifyBackup(records:Records,at:number):Promise<'healthy'|'stale'|'unverified'>{
  const maxAge=int(this.env.BACKUP_MAX_AGE_HOURS,26,1,24*30)*3600000;
  const latest=await records.get<any>('backup_status','latest');
  const completed=timestamp(latest?.completed_at);
  const status=completed===undefined?'unverified':at-completed<=maxAge?'healthy':'stale';
  await records.put('operations','backup_health',{status,checked_at:iso(at),max_age_hours:maxAge/3600000,last_success_at:completed===undefined?null:iso(completed),location_identifier:typeof latest?.location_identifier==='string'?latest.location_identifier:null});
  return status;
 }
 private async deliver(id:string,at:number):Promise<'delivered'|'failed'|'skipped'>{
  const claimed=await this.store.tx(async records=>{
   await records.lock('notification:'+id);
   const notification=await records.get<Notification>('notifications',id);
   if(!notification||notification.status==='delivered'||notification.status==='read'||notification.status==='failed')return undefined;
   const lease=timestamp(notification.lease_until);
   if(notification.status==='processing'&&lease!==undefined&&lease>at)return undefined;
   const processing={...notification,status:'processing' as const,attempts:notification.attempts+1,lease_until:iso(at+5*60000),updated_at:iso(at)};
   await records.put('notifications',id,processing);return processing;
  });
  if(!claimed)return 'skipped';
  try{
   await this.delivery.deliver(claimed);
   await this.store.tx(async records=>{await records.lock('notification:'+id);const current=await records.get<Notification>('notifications',id);if(current)await records.put('notifications',id,{...current,status:'delivered',delivered_at:iso(),lease_until:undefined,updated_at:iso()});});
   return 'delivered';
  }catch(error){
   await this.store.tx(async records=>{await records.lock('notification:'+id);const current=await records.get<Notification>('notifications',id);if(current){const retry=current.attempts<3;await records.put('notifications',id,{...current,status:retry?'queued':'failed',lease_until:undefined,last_error:error instanceof Error?error.message:'Notification delivery failed.',updated_at:iso()});}});
   return 'failed';
  }
 }
}
