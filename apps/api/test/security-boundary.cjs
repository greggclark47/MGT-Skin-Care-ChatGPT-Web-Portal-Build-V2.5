const assert=require('node:assert/strict');
const {hasExactOrigin,sessionCookieValue,sessionRateSource,rate,text}=require('../dist/portal/security');

assert.equal(hasExactOrigin('https://portal.example','https://portal.example'),true);
assert.equal(hasExactOrigin(['https://portal.example'],'https://portal.example'),false);
assert.equal(hasExactOrigin('https://portal.example','x'.repeat(2049)),false);

assert.equal(sessionCookieValue('mgt='+'a'.repeat(64),'mgt'),'a'.repeat(64));
assert.equal(sessionCookieValue('mgt='+'a'.repeat(64)+'; mgt='+'b'.repeat(64),'mgt'),undefined);
assert.equal(sessionCookieValue(['mgt='+'a'.repeat(64)],'mgt'),undefined);
assert.equal(sessionCookieValue('mgt=not-a-token','mgt'),undefined);

const edgeToken='test-edge-token-not-for-production-use-123456';
const source=(headers,remoteAddress='10.0.0.5')=>sessionRateSource({headers,socket:{remoteAddress}},true,edgeToken);
assert.equal(source({'x-mgt-client-ip':'198.51.100.42'}),'10.0.0.5');
assert.equal(source({'x-mgt-client-ip':'198.51.100.42','x-mgt-edge-token':'wrong'}),'10.0.0.5');
assert.equal(source({'x-mgt-client-ip':['198.51.100.42'],'x-mgt-edge-token':edgeToken}),'10.0.0.5');
assert.equal(source({'x-mgt-client-ip':'not-an-ip','x-mgt-edge-token':edgeToken}),'10.0.0.5');
assert.equal(source({'x-mgt-client-ip':'198.51.100.42','x-mgt-edge-token':edgeToken}),'198.51.100.42');
assert.equal(source({'x-mgt-client-ip':'2001:db8::1','x-mgt-edge-token':edgeToken}),'2001:db8::1');
assert.equal(sessionRateSource({headers:{'x-mgt-client-ip':'198.51.100.42','x-mgt-edge-token':edgeToken},socket:{remoteAddress:'10.0.0.5'}},true),'10.0.0.5');

const records={
 lock:async()=>{},
 get:async()=>undefined,
 put:async()=>{},
};
(async()=>{
 await rate(records,'safe-key',1,1000);
 for(const args of [['',1,1000],['x'.repeat(201),1,1000],['bad key',1,1000],['safe\0key',1,1000],['safe',0,1000],['safe',1,0],['safe',1,604800001]])assert.rejects(rate(records,...args),/Rate policy is invalid/);
 assert.equal(text('é',2),'é');
 assert.throws(()=>text('é',1),/Please enter a valid value/);
 assert.throws(()=>text('ok',0),/Please enter a valid value/);
 assert.throws(()=>text('bad\0text'),/Please enter a valid value/);
 console.log('Session cookie, rate policy, and UTF-8 text boundary checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
