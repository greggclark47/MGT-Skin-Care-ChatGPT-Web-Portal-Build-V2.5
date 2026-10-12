const assert=require('node:assert/strict');
const {test}=require('node:test');
const {createServer}=require('node:http');
const {applyProductionHttpTimeouts,applyProductionHttpLimits,applyProductionExpressBoundary,closeProductionHttpServer,isSupportedHttpMethod,requestTargetWithinLimit}=require('../dist/portal/http-runtime');

test('request targets are bounded by UTF-8 byte length',()=>{
 assert.equal(requestTargetWithinLimit('/api/hub/catalog?query=clean'),true);
 assert.equal(requestTargetWithinLimit('/'+ 'a'.repeat(4096)),false);
 assert.equal(requestTargetWithinLimit('/'+ 'é'.repeat(2048)),false);
 assert.equal(requestTargetWithinLimit(undefined),false);
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
