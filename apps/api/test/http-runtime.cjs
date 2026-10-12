const assert=require('node:assert/strict');
const {test}=require('node:test');
const {createServer}=require('node:http');
const {acceptsApiContentEncoding,acceptsApiJsonBody,acceptsApiJsonCharset,acceptsBodyForMethod,apiSecurityHeaders,applyProductionHttpTimeouts,applyProductionHttpLimits,applyProductionExpressBoundary,closeProductionHttpServer,hasNoMethodOverride,hasNoPartialBody,hasNoPathOverride,installClientErrorBoundary,isSupportedHttpMethod,requestTargetWithinLimit}=require('../dist/portal/http-runtime');

test('request targets are bounded by UTF-8 byte length',()=>{
 assert.equal(requestTargetWithinLimit('/api/hub/catalog?query=clean'),true);
 assert.equal(requestTargetWithinLimit('/'+ 'a'.repeat(4096)),false);
 assert.equal(requestTargetWithinLimit('/'+ 'é'.repeat(2048)),false);
 assert.equal(requestTargetWithinLimit(undefined),false);
});

test('malformed socket input receives a minimal close response and sanitized audit code',()=>{
 let listener,ended='',destroyed=false;
 const logs=[],server={on:(event,callback)=>{assert.equal(event,'clientError');listener=callback;}};
 installClientErrorBoundary(server,record=>logs.push(record));
 const error=Object.assign(new Error('raw request material must not be logged'),{code:'HPE_HEADER_OVERFLOW'});
 listener(error,{writable:true,end:data=>{ended=data;},destroy:()=>{destroyed=true;}});
 assert.deepEqual(logs,[{event:'http_client_error',code:'HPE_HEADER_OVERFLOW'}]);
 assert.equal(ended,'HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
 assert.equal(destroyed,false);
 listener(Object.assign(new Error('secret'),{code:'bad code'}),{writable:false,end:()=>{},destroy:()=>{destroyed=true;}});
 assert.deepEqual(logs[1],{event:'http_client_error',code:'client_error'});
 assert.equal(destroyed,true);
});

test('API security headers deny browser capabilities and enable HSTS only in production',()=>{
 const production=apiSecurityHeaders({NODE_ENV:'production'}),testHeaders=apiSecurityHeaders({NODE_ENV:'test'});
 assert.match(production['Content-Security-Policy'],/default-src 'none'/);
 assert.match(production['Content-Security-Policy'],/frame-ancestors 'none'/);
 assert.equal(production['Cross-Origin-Resource-Policy'],'same-origin');
 assert.equal(production['Cross-Origin-Opener-Policy'],'same-origin');
 assert.match(production['Permissions-Policy'],/camera=\(\)/);
 assert.equal(production['Strict-Transport-Security'],'max-age=31536000; includeSubDomains');
 assert.equal(testHeaders['Strict-Transport-Security'],undefined);
});

test('API mutation bodies require an explicit JSON media type',()=>{
 assert.equal(acceptsApiJsonBody('POST','application/json','2',undefined),true);
 assert.equal(acceptsApiJsonBody('PATCH','application/problem+json; charset=utf-8',undefined,'chunked'),true);
 assert.equal(acceptsApiJsonBody('POST','text/plain','2',undefined),false);
 assert.equal(acceptsApiJsonBody('POST',undefined,undefined,'chunked'),false);
 assert.equal(acceptsApiJsonBody('POST',undefined,'0',undefined),true);
 assert.equal(acceptsApiJsonBody('GET','text/plain','2',undefined),true);
});

test('API request bodies cannot bypass size limits through compression',()=>{
 assert.equal(acceptsApiContentEncoding(undefined),true);
 assert.equal(acceptsApiContentEncoding('identity'),true);
 for(const encoding of ['gzip','br','deflate','gzip, br'])assert.equal(acceptsApiContentEncoding(encoding),false);
});

test('API JSON character decoding is unambiguously UTF-8',()=>{
 assert.equal(acceptsApiJsonCharset(undefined),true);
 assert.equal(acceptsApiJsonCharset('application/json'),true);
 assert.equal(acceptsApiJsonCharset('application/json; charset=UTF-8'),true);
 assert.equal(acceptsApiJsonCharset('application/json; charset="utf-8"'),true);
 assert.equal(acceptsApiJsonCharset('application/json; charset=iso-8859-1'),false);
 assert.equal(acceptsApiJsonCharset('application/json; charset=utf-8; charset=utf-8'),false);
});

test('read-only API methods reject request bodies',()=>{
 assert.equal(acceptsBodyForMethod('GET',undefined,undefined),true);
 assert.equal(acceptsBodyForMethod('HEAD','0',undefined),true);
 assert.equal(acceptsBodyForMethod('GET','2',undefined),false);
 assert.equal(acceptsBodyForMethod('HEAD',undefined,'chunked'),false);
 assert.equal(acceptsBodyForMethod('POST','2',undefined),true);
});

test('method override metadata cannot change route semantics',()=>{
 assert.equal(hasNoMethodOverride(undefined,undefined,undefined),true);
 assert.equal(hasNoMethodOverride('DELETE',undefined,undefined),false);
 assert.equal(hasNoMethodOverride(undefined,['PATCH'],undefined),false);
 assert.equal(hasNoMethodOverride(undefined,undefined,''),false);
});

test('partial request-body semantics are rejected',()=>{
 assert.equal(hasNoPartialBody(undefined),true);
 assert.equal(hasNoPartialBody('bytes 0-99/200'),false);
 assert.equal(hasNoPartialBody(''),false);
});

test('alternate path metadata cannot replace the authenticated route',()=>{
 assert.equal(hasNoPathOverride(undefined,undefined,undefined),true);
 assert.equal(hasNoPathOverride('/admin',undefined,undefined),false);
 assert.equal(hasNoPathOverride(undefined,['/other'],undefined),false);
});

test('only the bounded REST method set reaches application routes',()=>{
 for(const method of ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'])assert.equal(isSupportedHttpMethod(method),true);
 for(const method of ['TRACE','CONNECT','PROPFIND',''])assert.equal(isSupportedHttpMethod(method),false);
 assert.equal(isSupportedHttpMethod(undefined),false);
});

test('production HTTP server uses bounded request, header, and keep-alive timeouts',()=>{
 const server=createServer();
 applyProductionHttpTimeouts(server,{NODE_ENV:'production'});
 assert.equal(server.requestTimeout,30000);
 assert.equal(server.headersTimeout,15000);
 assert.equal(server.keepAliveTimeout,5000);
 server.close();
});

test('non-production HTTP defaults are not rewritten',()=>{
 const server=createServer(),before=[server.requestTimeout,server.headersTimeout,server.keepAliveTimeout];
 applyProductionHttpTimeouts(server,{NODE_ENV:'test'});
 assert.deepEqual([server.requestTimeout,server.headersTimeout,server.keepAliveTimeout],before);
 server.close();
});

test('production HTTP server caps requests, headers, and concurrent connections',()=>{
 const server=createServer();
 applyProductionHttpLimits(server,{NODE_ENV:'production'});
 assert.equal(server.maxRequestsPerSocket,1000);
 assert.equal(server.maxHeadersCount,100);
 assert.equal(server.maxConnections,1000);
 server.close();
});

test('production Express boundary disables proxy trust and nested query parsing',()=>{
 const calls=[],app={disable:name=>calls.push(['disable',name]),set:(name,value)=>calls.push(['set',name,value])};
 applyProductionExpressBoundary(app,{NODE_ENV:'production'});
 assert.deepEqual(calls,[['disable','trust proxy'],['disable','etag'],['set','query parser','simple'],['set','json escape',true]]);
});

test('production shutdown closes idle connections and storage after graceful drain',async()=>{
 const calls=[],server={closeIdleConnections:()=>calls.push('idle'),close:callback=>{calls.push('close');callback();},closeAllConnections:()=>calls.push('force')};
 const outcome=await closeProductionHttpServer(server,async()=>{calls.push('store');},20);
 assert.equal(outcome,'graceful');
 assert.deepEqual(calls,['idle','close','store']);
});

test('production shutdown forces lingering connections at the deadline',async()=>{
 const calls=[],server={closeIdleConnections:()=>calls.push('idle'),close:()=>calls.push('close'),closeAllConnections:()=>calls.push('force')};
 const outcome=await closeProductionHttpServer(server,async()=>{calls.push('store');},5);
 assert.equal(outcome,'forced');
 assert.deepEqual(calls,['idle','close','force','store']);
});
