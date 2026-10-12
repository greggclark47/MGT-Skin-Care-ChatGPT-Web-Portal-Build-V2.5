type HttpTimeoutServer={requestTimeout:number;headersTimeout:number;keepAliveTimeout:number};
type HttpLimitServer={maxRequestsPerSocket:number|null;maxHeadersCount:number|null;maxConnections:number};
type ExpressBoundary={disable:(name:string)=>unknown;set:(name:string,value:unknown)=>unknown};

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

export function applyProductionExpressBoundary(app:ExpressBoundary,env:NodeJS.ProcessEnv):void{
 if(env.NODE_ENV!=='production')return;
 app.disable('trust proxy');
 app.disable('etag');
 app.set('query parser','simple');
 app.set('json escape',true);
}
