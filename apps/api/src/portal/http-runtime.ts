type HttpTimeoutServer={requestTimeout:number;headersTimeout:number;keepAliveTimeout:number};
type HttpLimitServer={maxRequestsPerSocket:number|null;maxHeadersCount:number|null;maxConnections:number};

export function applyProductionHttpTimeouts(server:HttpTimeoutServer,env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 server.requestTimeout=30_000;
 server.headersTimeout=15_000;
 server.keepAliveTimeout=5_000;
}

export function applyProductionHttpLimits(server:HttpLimitServer,env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 server.maxRequestsPerSocket=1_000;
 server.maxHeadersCount=100;
 server.maxConnections=1_000;
}
