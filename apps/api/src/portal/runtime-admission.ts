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
