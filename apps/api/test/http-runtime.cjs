const assert=require('node:assert/strict');
const {test}=require('node:test');
const {createServer}=require('node:http');
const {acceptsApiContentEncoding,acceptsApiJsonBody,acceptsApiJsonCharset,acceptsBodyForMethod,apiSecurityHeaders,applyProductionHttpTimeouts,applyProductionHttpLimits,applyProductionExpressBoundary,closeProductionHttpServer,hasNoMethodOverride,hasNoPartialBody,hasNoPathOverride,hasNoRangeRequest,hasNoRequestTrailers,hasNoUnverifiedIntegrity,hasNoUrlFragment,hasUniqueQueryKeys,hasValidQueryEncoding,headerWithinLimit,installClientErrorBoundary,isSupportedHttpMethod,queryComponentsWithinLimit,queryPairCountWithinLimit,queryStringWithinLimit,requestTargetWithinLimit}=require('../dist/portal/http-runtime');

test('request targets are bounded by UTF-8 byte length',()=>{
 assert.equal(requestTargetWithinLimit('/api/hub/catalog?query=clean'),true);
 assert.equal(requestTargetWithinLimit('/'+ 'a'.repeat(4096)),false);
 assert.equal(requestTargetWithinLimit('/'+ 'é'.repeat(2048)),false);
 assert.equal(requestTargetWithinLimit('/api\r\nHost:evil'),false);
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

test('malformed socket cleanup and logging failures stay contained',()=>{
 let listener,destroyed=false;const server={on:(event,callback)=>{listener=callback;}};
 installClientErrorBoundary(server,()=>{throw new Error('logger failure');});
 listener(new Error('bad input'),{writable:true,end:()=>{throw new Error('socket failure');},destroy:()=>{destroyed=true;}});
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
test('API range requests fail closed',()=>{assert.equal(hasNoRangeRequest(undefined),true);assert.equal(hasNoRangeRequest('bytes=0-99'),false);assert.equal(hasNoRangeRequest(''),false);});
test('unverified request-integrity metadata fails closed',()=>{assert.equal(hasNoUnverifiedIntegrity(undefined,undefined,undefined),true);assert.equal(hasNoUnverifiedIntegrity('digest',undefined,undefined),false);assert.equal(hasNoUnverifiedIntegrity(undefined,['sha-256=x'],undefined),false);});
test('request trailers cannot mutate metadata after parsing',()=>{assert.equal(hasNoRequestTrailers(undefined),true);assert.equal(hasNoRequestTrailers('Digest'),false);assert.equal(hasNoRequestTrailers(''),false);});
test('security-relevant headers use byte limits and reject repeated forms',()=>{assert.equal(headerWithinLimit(undefined,4096),true);assert.equal(headerWithinLimit('a'.repeat(4096),4096),true);assert.equal(headerWithinLimit('é'.repeat(2049),4096),false);assert.equal(headerWithinLimit(['a','b'],4096),false);});
test('user-agent metadata fits its 512-byte operational bound',()=>{assert.equal(headerWithinLimit('browser'.repeat(70),512),true);assert.equal(headerWithinLimit('x'.repeat(513),512),false);});
test('referer metadata fits its 2048-byte operational bound',()=>{assert.equal(headerWithinLimit('https://portal.example/path',2048),true);assert.equal(headerWithinLimit('x'.repeat(2049),2048),false);});
test('query strings fit a separate 2048-byte bound',()=>{assert.equal(queryStringWithinLimit('/api/hub/catalog?q=clean'),true);assert.equal(queryStringWithinLimit('/api?'+ 'a'.repeat(2048)),true);assert.equal(queryStringWithinLimit('/api?'+ 'é'.repeat(1025)),false);});
test('query strings contain at most fifty pairs',()=>{assert.equal(queryPairCountWithinLimit('/api'),true);assert.equal(queryPairCountWithinLimit('/api?'+Array.from({length:50},(_,i)=>`k${i}=v`).join('&')),true);assert.equal(queryPairCountWithinLimit('/api?'+Array.from({length:51},(_,i)=>`k${i}=v`).join('&')),false);assert.equal(queryPairCountWithinLimit('/api?'+'&'.repeat(50)),false);});
test('query keys and values have independent byte bounds',()=>{assert.equal(queryComponentsWithinLimit('/api?key=value'),true);assert.equal(queryComponentsWithinLimit('/api?'+ 'k'.repeat(129)+'=v'),false);assert.equal(queryComponentsWithinLimit('/api?k='+ 'v'.repeat(1025)),false);assert.equal(queryComponentsWithinLimit('/api?k='+ 'é'.repeat(513)),false);});
test('query keys are unique after canonical decoding',()=>{assert.equal(hasUniqueQueryKeys('/api?a=1&b=2'),true);assert.equal(hasUniqueQueryKeys('/api?a=1&a=2'),false);assert.equal(hasUniqueQueryKeys('/api?a+b=1&a%20b=2'),false);assert.equal(hasUniqueQueryKeys('/api?%61=1&a=2'),false);assert.equal(hasUniqueQueryKeys('/api?%ZZ=1'),false);});
test('URL fragments are rejected at the API boundary',()=>{assert.equal(hasNoUrlFragment('/api?q=skin'),true);assert.equal(hasNoUrlFragment('/api?q=skin#private'),false);assert.equal(hasNoUrlFragment(undefined),false);});
test('query encoding is valid UTF-8 without decoded controls',()=>{assert.equal(hasValidQueryEncoding('/api?q=skin%20care'),true);assert.equal(hasValidQueryEncoding('/api?q=%E2%9C%93'),true);assert.equal(hasValidQueryEncoding('/api?q=%ZZ'),false);assert.equal(hasValidQueryEncoding('/api?q=%E0%A4%A'),false);assert.equal(hasValidQueryEncoding('/api?q=%00'),false);assert.equal(hasValidQueryEncoding('/api?q=%0d%0a'),false);});

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

test('production shutdown shares one promise across concurrent callers',async()=>{
 const calls=[];let finish;const server={closeIdleConnections:()=>calls.push('idle'),close:callback=>{calls.push('close');finish=callback;},closeAllConnections:()=>calls.push('force')};
 const first=closeProductionHttpServer(server,async()=>{calls.push('store');},20),second=closeProductionHttpServer(server,async()=>{calls.push('store-again');},20);
 assert.equal(first,second);
 finish();
 assert.equal(await first,'graceful');
 assert.deepEqual(calls,['idle','close','store']);
});

test('production shutdown closes storage when the server close reports an error',async()=>{
 const closeError=new Error('server already closed'),calls=[],server={closeIdleConnections:()=>calls.push('idle'),close:callback=>{calls.push('close');callback(closeError)},closeAllConnections:()=>calls.push('force')};
 await assert.rejects(closeProductionHttpServer(server,async()=>{calls.push('store');},20),error=>error===closeError);
 assert.deepEqual(calls,['idle','close','store']);
});

test('production shutdown rejects unsafe deadlines before touching the server',()=>{
 const server={close:()=>{throw new Error('must not run')}};
 for(const value of [0,-1,600001,1.5,Infinity])assert.throws(()=>closeProductionHttpServer(server,async()=>{},value),/HTTP shutdown deadline is invalid/);
});
