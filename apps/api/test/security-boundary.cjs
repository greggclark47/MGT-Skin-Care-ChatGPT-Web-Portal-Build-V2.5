const assert=require('node:assert/strict');
const {sessionCookieValue,rate,text}=require('../dist/portal/security');

assert.equal(sessionCookieValue('mgt='+'a'.repeat(64),'mgt'),'a'.repeat(64));
assert.equal(sessionCookieValue('mgt='+'a'.repeat(64)+'; mgt='+'b'.repeat(64),'mgt'),undefined);
assert.equal(sessionCookieValue(['mgt='+'a'.repeat(64)],'mgt'),undefined);
assert.equal(sessionCookieValue('mgt=not-a-token','mgt'),undefined);

const records={
 lock:async()=>{},
 get:async()=>undefined,
 put:async()=>{},
};
(async()=>{
 await rate(records,'safe-key',1,1000);
 for(const args of [['',1,1000],['x'.repeat(201),1,1000],['safe',0,1000],['safe',1,0],['safe',1,604800001]])assert.rejects(rate(records,...args),/Rate policy is invalid/);
 assert.equal(text('é',2),'é');
 assert.throws(()=>text('é',1),/Please enter a valid value/);
 assert.throws(()=>text('ok',0),/Please enter a valid value/);
 console.log('Session cookie, rate policy, and UTF-8 text boundary checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
