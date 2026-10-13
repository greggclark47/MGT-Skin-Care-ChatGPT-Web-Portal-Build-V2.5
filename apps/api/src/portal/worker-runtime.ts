type Timer = ReturnType<typeof setTimeout>;
type Clock = {
 schedule(task:()=>void,delayMs:number):Timer;
 cancel(timer:Timer):void;
};

const systemClock:Clock={schedule:(task,delayMs)=>setTimeout(task,delayMs),cancel:timer=>clearTimeout(timer)};

// Schedule after completion: a slow provider or database never overlaps the
// next sweep in the same process. Cross-process claims remain database-fenced.
export function startWorkerLoop(run:()=>Promise<void>,intervalMs:number,onFailure:(code:'worker_run_failed')=>void,clock:Clock=systemClock){
 if(!Number.isSafeInteger(intervalMs)||intervalMs<1||intervalMs>86_400_000)throw new Error('Worker interval must be a positive whole number within one day.');
 let stopped=false,timer:Timer|undefined,active:Promise<void>|undefined,stopping:Promise<void>|undefined;
 const cycle=()=>{
  if(stopped)return;
  active=(async()=>{
   try{await run();}
   catch{try{onFailure('worker_run_failed');}catch{/* Failure reporting cannot restart a sweep. */}}
   finally{if(!stopped){try{timer=clock.schedule(cycle,intervalMs);}catch{stopped=true;try{onFailure('worker_run_failed');}catch{/* Failure reporting cannot destabilize worker shutdown. */}}}}
  })();
 };
 cycle();
 return ()=>stopping??=(async()=>{
  stopped=true;
  if(timer!==undefined){try{clock.cancel(timer);}catch{/* A failed timer cancellation must not prevent shutdown. */}}
  await active;
 })();
}
