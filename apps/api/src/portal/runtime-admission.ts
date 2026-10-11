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
}

export function validateWorkerRuntimeAdmission(env:NodeJS.ProcessEnv):number{
 validateRuntimeOwnership(env);
 validateProductionDatabaseAdmission(env);
 return workerIntervalMs(env);
}
