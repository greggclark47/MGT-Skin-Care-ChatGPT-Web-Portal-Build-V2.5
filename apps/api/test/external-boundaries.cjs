// Real loopback HTTP failures/timeouts v1.2. No remote credentials or services.
const {test}=require('node:test');const assert=require('node:assert/strict');const http=require('node:http');
const {WebhookNotificationDelivery,SupabaseIdentityDeletion}=require('../dist/portal/operations');
test('notification and identity adapters: success, HTTP rejection, missing identity, and real timeout',async t=>{
 let mode='ok',seen=[];
 const server=http.createServer((req,res)=>{seen.push({method:req.method,url:req.url,authorization:req.headers.authorization,event:req.headers['x-mgt-event'],notificationId:req.headers['x-mgt-notification-id'],attempt:req.headers['x-mgt-attempt']});if(mode==='hang')return;res.statusCode=mode==='fail'?503:mode==='gone'?404:200;res.end('{}');});
 server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
 const delivery=new WebhookNotificationDelivery(origin+'/deliver','test-only');
 const identity=new SupabaseIdentityDeletion(origin,'test-only');
 await delivery.deliver({id:'notification_test',actor:'user_test',kind:'replenishment_reminder',status:'processing',scheduled_at:'2026-10-08T00:00:00.000Z',created_at:'2026-10-08T00:00:00.000Z',updated_at:'2026-10-08T00:00:00.000Z',attempts:1,payload:{product_id:'cleanser',due_at:'2026-10-08T00:00:00.000Z'}});assert.equal(seen[0].authorization,'Bearer test-only');assert.equal(seen[0].event,'mgt.notification');assert.equal(seen[0].notificationId,'notification_test');assert.equal(seen[0].attempt,'1');
 mode='fail';await assert.rejects(delivery.deliver({id:'notification_test'}),/503/);await assert.rejects(identity.remove('user1'),/503/);
 mode='gone';await identity.remove('user/one');assert.equal(seen.at(-1).url,'/auth/v1/admin/users/user%2Fone');
 mode='hang';const start=Date.now();await assert.rejects(delivery.deliver({id:'notification_test'}),error=>error.name==='TimeoutError'||error.name==='AbortError');
 assert(Date.now()-start>=9000&&Date.now()-start<15000,'configured ten-second timeout should abort the HTTP request');
});
