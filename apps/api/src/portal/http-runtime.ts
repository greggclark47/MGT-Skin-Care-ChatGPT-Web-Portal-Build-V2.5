type HttpTimeoutServer={requestTimeout:number;headersTimeout:number;keepAliveTimeout:number};
type HttpLimitServer={maxRequestsPerSocket:number|null;maxHeadersCount:number|null;maxConnections:number};
type ExpressBoundary={disable:(name:string)=>unknown;set:(name:string,value:unknown)=>unknown};
type ClosableServer={close:(callback:(error?:Error)=>void)=>unknown;closeIdleConnections?:()=>void;closeAllConnections?:()=>void};
type ClientErrorSocket={writable:boolean;end:(data:string)=>unknown;destroy:()=>unknown};
type ClientErrorServer={on:(event:'clientError',listener:(error:Error&{code?:string},socket:ClientErrorSocket)=>void)=>unknown};

export function requestTargetWithinLimit(target:string|undefined,maxBytes=4_096):boolean{
 if(typeof target!=='string'||target.length===0)return false;
 return Buffer.byteLength(target,'utf8')<=maxBytes;
}

const SUPPORTED_HTTP_METHODS=new Set(['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS']);
export function isSupportedHttpMethod(method:string|undefined):boolean{
 return typeof method==='string'&&SUPPORTED_HTTP_METHODS.has(method.toUpperCase());
}

export function acceptsApiJsonBody(method:string|undefined,contentType:string|undefined,contentLength:string|undefined,transferEncoding:string|undefined):boolean{
 const mutation=typeof method==='string'&&['POST','PUT','PATCH'].includes(method.toUpperCase());
 const hasBody=transferEncoding!==undefined||(contentLength!==undefined&&contentLength!=='0');
 if(!mutation||!hasBody)return true;
 return typeof contentType==='string'&&/^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:\s*;|$)/i.test(contentType.trim());
}

export function acceptsApiContentEncoding(contentEncoding:string|undefined):boolean{
 return contentEncoding===undefined||contentEncoding.trim().toLowerCase()==='identity';
}

export function acceptsApiJsonCharset(contentType:string|undefined):boolean{
 if(contentType===undefined)return true;
 const charsets=contentType.split(';').slice(1).map(value=>value.trim()).filter(value=>/^charset\s*=/i.test(value));
 return charsets.length===0||(charsets.length===1&&/^charset\s*=\s*"?utf-8"?$/i.test(charsets[0]));
}

export function acceptsBodyForMethod(method:string|undefined,contentLength:string|undefined,transferEncoding:string|undefined):boolean{
 const readOnly=typeof method==='string'&&['GET','HEAD'].includes(method.toUpperCase());
 const hasBody=transferEncoding!==undefined||(contentLength!==undefined&&contentLength!=='0');
 return !readOnly||!hasBody;
}

export function hasNoMethodOverride(...headers:(string|string[]|undefined)[]):boolean{
 return headers.every(value=>value===undefined);
}

export function hasNoPartialBody(contentRange:string|undefined):boolean{
 return contentRange===undefined;
}

export function hasNoPathOverride(...headers:(string|string[]|undefined)[]):boolean{
 return headers.every(value=>value===undefined);
}
export const hasNoRangeRequest=(range:string|undefined):boolean=>range===undefined;
export const hasNoUnverifiedIntegrity=(...headers:(string|string[]|undefined)[]):boolean=>headers.every(value=>value===undefined);
export const hasNoRequestTrailers=(trailer:string|undefined):boolean=>trailer===undefined;
export function headerWithinLimit(value:string|string[]|undefined,maxBytes:number):boolean{
 return value===undefined||(typeof value==='string'&&Buffer.byteLength(value,'utf8')<=maxBytes);
}
const rawQuery=(target:string):string=>{const at=target.indexOf('?');return at<0?'':target.slice(at+1);};
export function queryStringWithinLimit(target:string|undefined,maxBytes=2048):boolean{
 return typeof target==='string'&&Buffer.byteLength(rawQuery(target),'utf8')<=maxBytes;
}
export function queryPairCountWithinLimit(target:string|undefined,maxPairs=50):boolean{
 if(typeof target!=='string')return false;const query=rawQuery(target);return query===''||query.split('&').length<=maxPairs;
}
export function queryComponentsWithinLimit(target:string|undefined,maxKeyBytes=128,maxValueBytes=1024):boolean{
 if(typeof target!=='string')return false;const query=rawQuery(target);if(query==='')return true;
 return query.split('&').every(pair=>{const at=pair.indexOf('=');const key=at<0?pair:pair.slice(0,at),value=at<0?'':pair.slice(at+1);return Buffer.byteLength(key,'utf8')<=maxKeyBytes&&Buffer.byteLength(value,'utf8')<=maxValueBytes;});
}
export function hasUniqueQueryKeys(target:string|undefined):boolean{
 if(typeof target!=='string')return false;const query=rawQuery(target);if(query==='')return true;const seen=new Set<string>();
 for(const pair of query.split('&')){const rawKey=pair.split('=',1)[0];let key:string;try{key=decodeURIComponent(rawKey.replace(/\+/g,' '));}catch{return true;}if(seen.has(key))return false;seen.add(key);}return true;
}
export function hasValidQueryEncoding(target:string|undefined):boolean{
 if(typeof target!=='string')return false;const query=rawQuery(target);if(/%(?![0-9a-f]{2})/i.test(query))return false;
 try{return !/[\u0000-\u001f\u007f]/.test(decodeURIComponent(query.replace(/\+/g,'%20')));}catch{return false;}
}

export function apiSecurityHeaders(env:NodeJS.ProcessEnv):Record<string,string>{
 const headers:Record<string,string>={
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'same-origin',
  'Cache-Control':'no-store',
  'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'Permissions-Policy':'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()',
  'Cross-Origin-Resource-Policy':'same-origin',
  'Cross-Origin-Opener-Policy':'same-origin'
 };
 if(env.NODE_ENV==='production')headers['Strict-Transport-Security']='max-age=31536000; includeSubDomains';
 return headers;
}

export function installClientErrorBoundary(server:ClientErrorServer,log:(record:{event:string;code:string})=>void=(record)=>console.error(JSON.stringify(record))):void{
 server.on('clientError',(error,socket)=>{
  const code=typeof error.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(error.code)?error.code:'client_error';
  log({event:'http_client_error',code});
  if(socket.writable)socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  else socket.destroy();
 });
}

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

export async function closeProductionHttpServer(server:ClosableServer,closeStore:()=>Promise<unknown>,deadlineMs=10_000):Promise<'graceful'|'forced'>{
 server.closeIdleConnections?.();
 let timer:NodeJS.Timeout|undefined;
 const outcome=await Promise.race([
  new Promise<'graceful'>((resolve,reject)=>server.close(error=>error?reject(error):resolve('graceful'))),
  new Promise<'forced'>(resolve=>{timer=setTimeout(()=>{server.closeAllConnections?.();resolve('forced');},deadlineMs);})
 ]);
 if(timer)clearTimeout(timer);
 await closeStore();
 return outcome;
}
