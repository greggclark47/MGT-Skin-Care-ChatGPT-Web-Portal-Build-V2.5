const assert=require('node:assert/strict');
const {LocalStore}=require('../dist/portal/store.js');
const {OperationalWorker,InAppNotificationDelivery}=require('../dist/portal/operations.js');

(async()=>{
 const store=new LocalStore(':memory:');
 const at=Date.parse('2026-09-12T12:00:00.000Z');
 await store.tx(async records=>{
  await records.put('sessions','expired',{expires:at-1});
  await records.put('sessions','active',{expires:at+86400000});
  await records.put('rate','expired',{reset:at-1});
  await records.put('ai_routing_log','old',{at:'2026-07-01T00:00:00.000Z'});
  await records.put('ai_routing_log','recent',{at:'2026-09-11T00:00:00.000Z'});
  await records.put('reminders','user_1',[{product_id:'cleanser',due_at:'2026-09-12T11:00:00.000Z',paused:false},{product_id:'serum',due_at:'2026-09-13T11:00:00.000Z',paused:false}]);
  await records.put('backup_status','latest',{completed_at:'2026-09-12T10:00:00.000Z',location_identifier:'encrypted-offsite',checksum:'abc'});
 });
 const worker=new OperationalWorker(store,{env:{BACKUP_MAX_AGE_HOURS:'26'},delivery:new InAppNotificationDelivery()});
 const result=await worker.runOnce(at);
 assert.equal(result.created,1);assert.equal(result.delivered,1);assert.equal(result.backup_status,'healthy');
 await store.tx(async records=>{
  assert.equal(await records.get('sessions','expired'),undefined);
  assert.ok(await records.get('sessions','active'));
  assert.equal(await records.get('rate','expired'),undefined);
  assert.equal(await records.get('ai_routing_log','old'),undefined);
  assert.ok(await records.get('ai_routing_log','recent'));
  const reminders=await records.get('reminders','user_1');assert.ok(reminders[0].notification_id);
  const notifications=await records.entries('notifications');assert.equal(notifications.length,1);assert.equal(notifications[0].value.status,'delivered');
 });
 const next=await worker.runOnce(at+60000);assert.equal(next.created,0);assert.equal(next.delivered,0);
 await store.close();console.log('operations smoke passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
