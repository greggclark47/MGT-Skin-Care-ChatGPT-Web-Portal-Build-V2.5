const assert=require('node:assert/strict');
const {test}=require('node:test');
const {createServer}=require('node:http');
const {applyProductionHttpTimeouts}=require('../dist/portal/http-runtime');

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
