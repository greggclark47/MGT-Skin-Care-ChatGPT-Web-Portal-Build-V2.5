import path from 'node:path';
import { LocalStore, PgStore, startupMigrations, type Store } from './store';
import { OperationalWorker, identityDeletionFromEnv, notificationDeliveryFromEnv, writeWorkerHeartbeat } from './operations';
import { startWorkerLoop } from './worker-runtime';
import { validateRuntimeOwnership, workerIntervalMs } from './runtime-admission';

const env=process.env;
const healthFile=env.WORKER_HEALTH_FILE||'/tmp/mgt-worker-health.json';
async function openStore():Promise<Store>{
 const migrate=startupMigrations(env);
 if(env.DATABASE_URL)return new PgStore(env.DATABASE_URL,env).init(migrate);
 if(env.NODE_ENV==='production')throw new Error('A reviewed production database connection is required.');
 return new LocalStore(env.PORTAL_DB_PATH||path.resolve(process.cwd(),'../../work/data/portal.sqlite'));
}
async function main(){
 validateRuntimeOwnership(env);
 const interval=workerIntervalMs(env);
 const store=await openStore();const worker=new OperationalWorker(store,{env,delivery:notificationDeliveryFromEnv(env),identityDeletion:identityDeletionFromEnv(env)});
 const stopLoop=startWorkerLoop(async()=>{const result=await worker.runOnce();await writeWorkerHeartbeat(healthFile,result);console.log(JSON.stringify({worker:'portal-operations',...result}));},interval,code=>console.error(JSON.stringify({worker:'portal-operations',event:code})));
 let stopping:Promise<void>|undefined;
 const stop=()=>{stopping??=stopLoop().then(()=>store.close()).then(()=>{process.exitCode=0;},()=>{console.error(JSON.stringify({worker:'portal-operations',event:'worker_shutdown_failed'}));process.exitCode=1;});};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
main().catch(()=>{console.error(JSON.stringify({worker:'portal-operations',event:'worker_startup_failed'}));process.exitCode=1;});
