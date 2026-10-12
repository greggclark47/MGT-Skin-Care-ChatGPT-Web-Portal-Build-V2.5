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
  if(typeof origin!=='string'||!productionHostname(domain))throw new Error();
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
  const unsupportedParameter=[...parsed.searchParams.keys()].some(key=>key!=='sslmode');
  const databasePath=/^\/[^/]+$/.test(parsed.pathname);
  if(!validProtocol||!parsed.hostname||parsed.hostname.includes('%')||!databasePath||parsed.hash||!singleTlsMode||overriddenTarget||unsupportedParameter)throw new Error();
 }catch{throw new Error('Production database admission is invalid.');}
}

const productionPlaceholder=/(your-|change[-_]?me|example\.|localhost|127\.0\.0\.1)/i;
function productionEmail(value:unknown):boolean{
 return typeof value==='string'&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)&&!productionPlaceholder.test(value);
}
function productionHttpsUrl(value:unknown):boolean{
 if(typeof value!=='string'||value.length>2048||value!==value.trim())return false;
 try{const parsed=new URL(value);return parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash&&!productionPlaceholder.test(value);}catch{return false;}
}
function productionHttpsOrigin(value:unknown):boolean{
 try{const parsed=new URL(String(value));return parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!parsed.port&&parsed.pathname==='/'&&!parsed.search&&!parsed.hash&&parsed.origin===value&&!productionPlaceholder.test(String(value));}catch{return false;}
}
function productionServiceUrl(value:unknown):boolean{
 if(typeof value!=='string'||value.length>2048||value!==value.trim())return false;
 try{
  const parsed=new URL(value),privateHttp=parsed.protocol==='http:'&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(parsed.hostname),externalHttps=parsed.protocol==='https:'&&productionHostname(parsed.hostname);
  return (privateHttp||externalHttps)&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash&&!productionPlaceholder.test(value);
 }catch{return false;}
}
function configuredReference(value:unknown):value is string{return typeof value==='string'&&value.length>0&&value.length<=4096&&value===value.trim()&&!/[\u0000-\u001f\u007f]/.test(value)&&!productionPlaceholder.test(value);}
function optionalReference(value:unknown):boolean{return value===undefined||value===''||configuredReference(value);}
function productionInteger(value:unknown,minimum:number,maximum:number,optional=false):boolean{
 if(optional&&(value===undefined||value===''))return true;
 return typeof value==='string'&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)>=minimum&&Number(value)<=maximum;
}
function productionDigestImage(value:unknown):boolean{return typeof value==='string'&&/^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$/.test(value);}
function sameText(left:string,right:string):boolean{return left===right;}
function productionPastIso(value:unknown):boolean{
 if(typeof value!=='string')return false;
 const time=Date.parse(value);
 return Number.isFinite(time)&&new Date(time).toISOString()===value&&time<=Date.now();
}
function productionHostname(value:unknown):value is string{
 if(typeof value!=='string'||value.length>253||value!==value.toLowerCase()||!value.includes('.')||/^\d+(?:\.\d+){3}$/.test(value))return false;
 return value.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

export function validateProductionOperationsAdmission(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 const validCore=productionEmail(env.SUPPORT_OWNER_EMAIL)&&productionEmail(env.ALERT_OWNER_EMAIL)
  &&productionHttpsUrl(env.MONITORING_DASHBOARD_URL)&&productionHttpsUrl(env.INCIDENT_RUNBOOK_URL)
  &&productionInteger(env.SUPPORT_RESPONSE_TARGET_HOURS,1,168)
  &&env.OPERATIONS_ALERT_DELIVERY==='webhook'&&productionHttpsUrl(env.OPERATIONS_ALERT_WEBHOOK_URL)
  &&configuredReference(env.OPERATIONS_ALERT_WEBHOOK_TOKEN);
 const validOptional=productionInteger(env.OPERATIONS_ALERT_TIMEOUT_MS,1000,30000,true)
  &&productionInteger(env.OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS,10,3600,true)
  &&productionInteger(env.OPERATIONS_ALERT_EVENT_RETENTION_DAYS,1,3650,true)
  &&productionInteger(env.OPERATIONS_ALERT_LEASE_SECONDS,10,600,true)
  &&productionInteger(env.OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS,10,86400,true)
  &&productionInteger(env.OPERATIONS_ALERT_MAX_ATTEMPTS,1,20,true)
  &&/^[A-Za-z0-9_-]{1,64}$/.test(env.OPERATIONS_ALERT_KEY_ID||'');
 const retryBase=Number(env.OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS||300),retryMax=Number(env.OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS||3600);
 if(!validCore||!validOptional||retryMax<retryBase)throw new Error('Production operations admission is invalid.');
}

export function validateProductionNotificationAdmission(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 const delivery=env.NOTIFICATION_DELIVERY;
 if(delivery!=='in_app'&&delivery!=='webhook')throw new Error('Production notification admission is invalid.');
 if(delivery==='webhook'){
  if(!productionHttpsUrl(env.NOTIFICATION_WEBHOOK_URL))throw new Error('Production notification admission is invalid.');
  if(!configuredReference(env.NOTIFICATION_WEBHOOK_TOKEN))throw new Error('Production notification admission is invalid.');
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(env.NOTIFICATION_WEBHOOK_KEY_ID||''))throw new Error('Production notification admission is invalid.');
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
 if(!productionHttpsOrigin(env.SUPABASE_URL))throw new Error('Production identity admission is invalid.');
 if(!configuredReference(env.SUPABASE_ANON_KEY))throw new Error('Production identity admission is invalid.');
 if(!configuredReference(env.SUPABASE_SERVICE_ROLE_KEY))throw new Error('Production identity admission is invalid.');
 if(sameText(env.SUPABASE_ANON_KEY,env.SUPABASE_SERVICE_ROLE_KEY))throw new Error('Production identity admission is invalid.');
}

export function validateProductionBackupAdmission(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 if(!productionInteger(env.BACKUP_MAX_AGE_HOURS,1,72)||!productionInteger(env.BACKUP_RESTORE_MAX_AGE_DAYS,1,365))throw new Error('Production backup admission is invalid.');
}

export function validateProductionAccessibilityAdmission(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 if(!productionHttpsUrl(env.ACCESSIBILITY_VALIDATION_REPORT_URL)||!productionPastIso(env.ACCESSIBILITY_VALIDATED_AT))throw new Error('Production accessibility admission is invalid.');
}

export function validateProductionSubscriptionAdmission(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 if(env.SUBSCRIPTIONS_ENABLED!=='true'&&env.SUBSCRIPTIONS_ENABLED!=='false')throw new Error('Production subscription admission is invalid.');
 if(env.SUBSCRIPTIONS_ENABLED==='false')return;
 if(env.SUBSCRIPTION_TERMS_APPROVED!=='true'||(env.STRIPE_LIVE_MODE!=='true'&&env.STRIPE_LIVE_MODE!=='false'))throw new Error('Production subscription admission is invalid.');
 if(typeof env.STRIPE_SECRET_KEY!=='string'||!(env.STRIPE_LIVE_MODE==='true'?/^sk_live_[A-Za-z0-9_]+$/:/^sk_test_[A-Za-z0-9_]+$/).test(env.STRIPE_SECRET_KEY))throw new Error('Production subscription admission is invalid.');
 if(typeof env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET!=='string'||!/^whsec_[A-Za-z0-9_]+$/.test(env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET))throw new Error('Production subscription admission is invalid.');
 if(typeof env.STRIPE_PREMIUM_PRODUCT_ID!=='string'||!/^prod_[A-Za-z0-9_]+$/.test(env.STRIPE_PREMIUM_PRODUCT_ID))throw new Error('Production subscription admission is invalid.');
 if(typeof env.STRIPE_PREMIUM_MONTHLY_PRICE_ID!=='string'||!/^price_[A-Za-z0-9_]+$/.test(env.STRIPE_PREMIUM_MONTHLY_PRICE_ID))throw new Error('Production subscription admission is invalid.');
 if(typeof env.STRIPE_PREMIUM_ANNUAL_PRICE_ID!=='string'||!/^price_[A-Za-z0-9_]+$/.test(env.STRIPE_PREMIUM_ANNUAL_PRICE_ID)||sameText(env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,env.STRIPE_PREMIUM_ANNUAL_PRICE_ID))throw new Error('Production subscription admission is invalid.');
}

export function validateProductionAiAdmission(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 if(env.OLLAMA_ENABLED!=='true'&&env.OLLAMA_ENABLED!=='false')throw new Error('Production AI admission is invalid.');
 if(env.OLLAMA_ENABLED==='true'&&!productionServiceUrl(env.OLLAMA_BASE_URL))throw new Error('Production AI admission is invalid.');
 if(env.OPENCLAW_ENABLED!=='true'&&env.OPENCLAW_ENABLED!=='false')throw new Error('Production AI admission is invalid.');
 if(env.OPENCLAW_ENABLED==='true'){
  if(!productionServiceUrl(env.OPENCLAW_BASE_URL)||(env.OPENCLAW_API_MODE!=='ollama'&&env.OPENCLAW_API_MODE!=='openai-completions'))throw new Error('Production AI admission is invalid.');
  if(env.OPENCLAW_API_MODE==='openai-completions'&&!configuredReference(env.OPENCLAW_API_KEY))throw new Error('Production AI admission is invalid.');
 }
 if(!optionalReference(env.OPENAI_API_KEY))throw new Error('Production AI admission is invalid.');
}

export function validateProductionProcessSurfaceAdmission(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 if((env.HOST!=='0.0.0.0'&&env.HOST!=='::')||!productionInteger(env.PORT,1024,65535))throw new Error('Production process surface admission is invalid.');
 const file=env.WORKER_HEALTH_FILE;
 if(typeof file!=='string'||!file.startsWith('/')||file.includes('\\')||file.split('/').includes('..')||file.length>240||!/^[A-Za-z0-9._/-]+\.json$/.test(file))throw new Error('Production process surface admission is invalid.');
}

export function validateProductionImageAdmission(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 const keys=['NODE_IMAGE','API_IMAGE','WEB_IMAGE','OLLAMA_IMAGE','CADDY_IMAGE'];
 for(const key of keys){
  if(!productionDigestImage(env[key]))throw new Error('Production image admission is invalid.');
 }
 if(new Set(keys.map(key=>env[key])).size!==keys.length)throw new Error('Production image admission is invalid.');
}

export function validateProductionSecretIsolation(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 const keys=['SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','OPERATIONS_ALERT_WEBHOOK_TOKEN'];
 if(env.NOTIFICATION_DELIVERY==='webhook')keys.push('NOTIFICATION_WEBHOOK_TOKEN');
 if(env.OPENCLAW_ENABLED==='true'&&env.OPENCLAW_API_MODE==='openai-completions')keys.push('OPENCLAW_API_KEY');
 if(configuredReference(env.OPENAI_API_KEY))keys.push('OPENAI_API_KEY');
 if(env.SUBSCRIPTIONS_ENABLED==='true')keys.push('STRIPE_SECRET_KEY','STRIPE_SUBSCRIPTION_WEBHOOK_SECRET');
 const references=keys.map(key=>env[key]).filter(configuredReference);
 if(new Set(references).size!==references.length)throw new Error('Production secret isolation is invalid.');
}

export function validateProductionEndpointIsolation(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 const keys=['MONITORING_DASHBOARD_URL','INCIDENT_RUNBOOK_URL','ACCESSIBILITY_VALIDATION_REPORT_URL','OPERATIONS_ALERT_WEBHOOK_URL'];
 if(env.NOTIFICATION_DELIVERY==='webhook')keys.push('NOTIFICATION_WEBHOOK_URL');
 const endpoints=keys.map(key=>env[key]).filter((value):value is string=>typeof value==='string'&&value.length>0);
 if(new Set(endpoints).size!==endpoints.length)throw new Error('Production endpoint isolation is invalid.');
}

export function validateProductionDisabledFeatureResidue(env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 const populated=(keys:string[])=>keys.some(key=>env[key]!==undefined&&env[key]!=='');
 if(env.NOTIFICATION_DELIVERY==='in_app'&&populated(['NOTIFICATION_WEBHOOK_URL','NOTIFICATION_WEBHOOK_TOKEN','NOTIFICATION_WEBHOOK_KEY_ID','NOTIFICATION_WEBHOOK_TIMEOUT_MS']))throw new Error('Production disabled feature residue is invalid.');
 if(env.OLLAMA_ENABLED==='false'&&populated(['OLLAMA_BASE_URL']))throw new Error('Production disabled feature residue is invalid.');
 if(env.OPENCLAW_ENABLED==='false'&&populated(['OPENCLAW_BASE_URL','OPENCLAW_API_MODE','OPENCLAW_API_KEY']))throw new Error('Production disabled feature residue is invalid.');
 if(env.SUBSCRIPTIONS_ENABLED==='false'&&populated(['STRIPE_LIVE_MODE','STRIPE_SECRET_KEY','STRIPE_SUBSCRIPTION_WEBHOOK_SECRET','STRIPE_PREMIUM_PRODUCT_ID','STRIPE_PREMIUM_MONTHLY_PRICE_ID','STRIPE_PREMIUM_ANNUAL_PRICE_ID']))throw new Error('Production disabled feature residue is invalid.');
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
 validateProductionBackupAdmission(env);
 validateProductionAccessibilityAdmission(env);
 validateProductionSubscriptionAdmission(env);
 validateProductionAiAdmission(env);
 validateProductionProcessSurfaceAdmission(env);
 validateProductionImageAdmission(env);
 validateProductionSecretIsolation(env);
 validateProductionEndpointIsolation(env);
 validateProductionDisabledFeatureResidue(env);
}

export function validateWorkerRuntimeAdmission(env:NodeJS.ProcessEnv):number{
 validateRuntimeOwnership(env);
 validateProductionDatabaseAdmission(env);
 validateProductionOperationsAdmission(env);
 validateProductionNotificationAdmission(env);
 validateProductionIdentityAdmission(env);
 validateProductionBackupAdmission(env);
 validateProductionAccessibilityAdmission(env);
 validateProductionSubscriptionAdmission(env);
 validateProductionAiAdmission(env);
 validateProductionProcessSurfaceAdmission(env);
 validateProductionImageAdmission(env);
 validateProductionSecretIsolation(env);
 validateProductionEndpointIsolation(env);
 validateProductionDisabledFeatureResidue(env);
 return workerIntervalMs(env);
}
