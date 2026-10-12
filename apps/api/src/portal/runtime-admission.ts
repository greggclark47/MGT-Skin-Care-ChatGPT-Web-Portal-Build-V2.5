// Runtime admission is deliberately independent of the deployment CLI: direct
// service execution must reject invalid declarations before opening a database.
export function validateRuntimeOwnership(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 for(const key of ['RELEASE_OWNER_NAME','SUPPORT_OWNER_NAME']){
  if(env[key]!=='Gregg Clark of MGT')throw new Error('Production ownership declaration is invalid.');
 }
}

export function workerIntervalMs(env:NodeJS.ProcessEnv):number{
 const value=env.WORKER_INTERVAL_SECONDS;
 if(env.NODE_ENV==='production'){
  const seconds=Number(value);
  if(typeof value!=='string'||!/^\d+$/.test(value)||!Number.isSafeInteger(seconds)||seconds<15||seconds>3600){
   throw new Error('Production worker interval is invalid.');
  }
  return seconds*1000;
 }
 return Math.max(15,Math.min(3600,Number(value)||60))*1000;
}

export function workerReadinessMaxAgeMs(env:NodeJS.ProcessEnv):number{
 const intervalMs=workerIntervalMs(env),value=env.WORKER_READINESS_MAX_AGE_SECONDS;
 if(env.NODE_ENV==='production'){
  const seconds=Number(value);
  if(typeof value!=='string'||!/^\d+$/.test(value)||!Number.isSafeInteger(seconds)||seconds<60||seconds>86400||seconds*1000<intervalMs*2){
   throw new Error('Production worker readiness age is invalid.');
  }
  return seconds*1000;
 }
 return Math.max(60,Math.min(10800,Number(value)||Math.max(300,intervalMs/1000*3)))*1000;
}

export function validateProductionPortalBoundary(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 if(env.DEMO_MODE!=='false')throw new Error('Production portal boundary is invalid.');
 const origin=env.PUBLIC_ORIGIN,domain=env.PORTAL_DOMAIN;
 try{
  if(typeof origin!=='string'||typeof domain!=='string'||!domain||domain.includes('://')||domain.includes('/'))throw new Error();
  const parsed=new URL(origin);
  if(parsed.protocol!=='https:'||!parsed.hostname||parsed.username||parsed.password||parsed.port||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.origin!==origin||parsed.hostname!==domain)throw new Error();
 }catch{throw new Error('Production portal boundary is invalid.');}
}

export function validateProductionDatabaseAdmission(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 if(env.PORTAL_AUTO_MIGRATE!=='false')throw new Error('Production database admission is invalid.');
 try{
  if(typeof env.DATABASE_URL!=='string')throw new Error();
  const parsed=new URL(env.DATABASE_URL);
  const validProtocol=parsed.protocol==='postgres:'||parsed.protocol==='postgresql:';
  const singleTlsMode=parsed.searchParams.getAll('sslmode').length===1&&parsed.searchParams.get('sslmode')==='verify-full';
  const overriddenTarget=['host','hostaddr','port','user','password','database'].some(key=>parsed.searchParams.has(key));
  if(!validProtocol||!parsed.hostname||parsed.hostname.includes('%')||!singleTlsMode||overriddenTarget)throw new Error();
 }catch{throw new Error('Production database admission is invalid.');}
}

const productionPlaceholder=/(your-|change[-_]?me|example\.|localhost|127\.0\.0\.1)/i;
function productionEmail(value:unknown):boolean{
 return typeof value==='string'&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)&&!productionPlaceholder.test(value);
}
function productionHttpsUrl(value:unknown):boolean{
 try{const parsed=new URL(String(value));return parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!productionPlaceholder.test(String(value));}catch{return false;}
}
function productionInteger(value:unknown,minimum:number,maximum:number,optional=false):boolean{
 if(optional&&(value===undefined||value===''))return true;
 return typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)>=minimum&&Number(value)<=maximum;
}
function sameText(left:string,right:string):boolean{return left===right;}

export function validateProductionOperationsAdmission(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 const validCore=productionEmail(env.SUPPORT_OWNER_EMAIL)&&productionEmail(env.ALERT_OWNER_EMAIL)
  &&productionHttpsUrl(env.MONITORING_DASHBOARD_URL)&&productionHttpsUrl(env.INCIDENT_RUNBOOK_URL)
  &&productionInteger(env.SUPPORT_RESPONSE_TARGET_HOURS,1,168)
  &&env.OPERATIONS_ALERT_DELIVERY==='webhook'&&productionHttpsUrl(env.OPERATIONS_ALERT_WEBHOOK_URL)
  &&typeof env.OPERATIONS_ALERT_WEBHOOK_TOKEN==='string'&&!!env.OPERATIONS_ALERT_WEBHOOK_TOKEN.trim()&&!productionPlaceholder.test(env.OPERATIONS_ALERT_WEBHOOK_TOKEN);
 const validOptional=productionInteger(env.OPERATIONS_ALERT_TIMEOUT_MS,1000,30000,true)
  &&productionInteger(env.OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS,10,3600,true)
  &&productionInteger(env.OPERATIONS_ALERT_EVENT_RETENTION_DAYS,1,3650,true)
  &&productionInteger(env.OPERATIONS_ALERT_LEASE_SECONDS,10,600,true)
  &&productionInteger(env.OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS,10,86400,true)
  &&productionInteger(env.OPERATIONS_ALERT_MAX_ATTEMPTS,1,20,true)
  &&(env.OPERATIONS_ALERT_KEY_ID===undefined||/^[A-Za-z0-9_-]{1,64}$/.test(env.OPERATIONS_ALERT_KEY_ID));
 const retryBase=Number(env.OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS||300),retryMax=Number(env.OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS||3600);
 if(!validCore||!validOptional||retryMax<retryBase)throw new Error('Production operations admission is invalid.');
}

export function validateProductionNotificationAdmission(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 const delivery=env.NOTIFICATION_DELIVERY;
 if(delivery!=='in_app'&&delivery!=='webhook')throw new Error('Production notification admission is invalid.');
 if(delivery==='webhook'){
  if(!productionHttpsUrl(env.NOTIFICATION_WEBHOOK_URL))throw new Error('Production notification admission is invalid.');
  if(typeof env.NOTIFICATION_WEBHOOK_TOKEN!=='string'||!env.NOTIFICATION_WEBHOOK_TOKEN.trim()||productionPlaceholder.test(env.NOTIFICATION_WEBHOOK_TOKEN))throw new Error('Production notification admission is invalid.');
  if(env.NOTIFICATION_WEBHOOK_KEY_ID!==undefined&&!/^[A-Za-z0-9_-]{1,64}$/.test(env.NOTIFICATION_WEBHOOK_KEY_ID))throw new Error('Production notification admission is invalid.');
  if(env.NOTIFICATION_WEBHOOK_TIMEOUT_MS!==undefined&&!productionInteger(env.NOTIFICATION_WEBHOOK_TIMEOUT_MS,1000,30000))throw new Error('Production notification admission is invalid.');
 }
 const retryBase=env.NOTIFICATION_RETRY_COOLDOWN_SECONDS??'300',retryMax=env.NOTIFICATION_MAX_RETRY_DELAY_SECONDS??'3600';
 const validPolicy=productionInteger(retryBase,10,3600)&&productionInteger(retryMax,10,86400)
  &&productionInteger(env.NOTIFICATION_MAX_ATTEMPTS??'3',1,20)
  &&productionInteger(env.OPERATIONS_NOTIFICATION_RETENTION_DAYS??'90',1,3650)
  &&Number(retryMax)>=Number(retryBase);
 if(!validPolicy)throw new Error('Production notification admission is invalid.');
}

export function validateProductionIdentityAdmission(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 if(!productionHttpsUrl(env.SUPABASE_URL))throw new Error('Production identity admission is invalid.');
 if(typeof env.SUPABASE_ANON_KEY!=='string'||!env.SUPABASE_ANON_KEY.trim()||productionPlaceholder.test(env.SUPABASE_ANON_KEY))throw new Error('Production identity admission is invalid.');
 if(typeof env.SUPABASE_SERVICE_ROLE_KEY!=='string'||!env.SUPABASE_SERVICE_ROLE_KEY.trim()||productionPlaceholder.test(env.SUPABASE_SERVICE_ROLE_KEY))throw new Error('Production identity admission is invalid.');
 if(sameText(env.SUPABASE_ANON_KEY,env.SUPABASE_SERVICE_ROLE_KEY))throw new Error('Production identity admission is invalid.');
}

export function validateApiRuntimeAdmission(env:NodeJS.ProcessEnv):void{
 validateRuntimeOwnership(env);
 if(env.NODE_ENV==='production'){
  workerReadinessMaxAgeMs(env);
  validateProductionPortalBoundary(env);
 }
}

export function validateApiProcessAdmission(env:NodeJS.ProcessEnv):void{
 validateApiRuntimeAdmission(env);
 validateProductionDatabaseAdmission(env);
 validateProductionOperationsAdmission(env);
 validateProductionNotificationAdmission(env);
 validateProductionIdentityAdmission(env);
}

export function validateWorkerRuntimeAdmission(env:NodeJS.ProcessEnv):number{
 validateRuntimeOwnership(env);
 validateProductionDatabaseAdmission(env);
 validateProductionOperationsAdmission(env);
 validateProductionNotificationAdmission(env);
 validateProductionIdentityAdmission(env);
 return workerIntervalMs(env);
}
