type HttpTimeoutServer={requestTimeout:number;headersTimeout:number;keepAliveTimeout:number};

export function applyProductionHttpTimeouts(server:HttpTimeoutServer,env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 server.requestTimeout=30_000;
 server.headersTimeout=15_000;
 server.keepAliveTimeout=5_000;
}
