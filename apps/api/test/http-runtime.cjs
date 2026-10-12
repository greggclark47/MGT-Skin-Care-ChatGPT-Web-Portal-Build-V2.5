const assert=require('node:assert/strict');
const {test}=require('node:test');
const {createServer}=require('node:http');
const {applyProductionHttpTimeouts,applyProductionHttpLimits,applyProductionExpressBoundary}=require('../dist/portal/http-runtime');

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
 assert.deepEqual(calls,[['disable','trust proxy'],['set','query parser','simple']]);
});
