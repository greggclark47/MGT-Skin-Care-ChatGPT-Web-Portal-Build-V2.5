import path from 'node:path';
import { LocalStore, PgStore, type Store } from './store';
import { OperationalWorker, notificationDeliveryFromEnv } from './operations';

const env=process.env;
const interval=Math.max(15,Math.min(3600,Number(env.WORKER_INTERVAL_SECONDS)||60))*1000;
async function openStore():Promise<Store>{
 if(env.DATABASE_URL)return new PgStore(env.DATABASE_URL).init();
 return new LocalStore(env.PORTAL_DB_PATH||path.resolve(process.cwd(),'../../work/data/portal.sqlite'));
}
async function main(){
 const store=await openStore();const worker=new OperationalWorker(store,{env,delivery:notificationDeliveryFromEnv(env)});
 const run=async()=>{try{console.log(JSON.stringify({worker:'portal-operations',...(await worker.runOnce())}));}catch(error){console.error(error);}};
 await run();const timer=setInterval(run,interval);
 const stop=async()=>{clearInterval(timer);await store.close();process.exitCode=0;};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
