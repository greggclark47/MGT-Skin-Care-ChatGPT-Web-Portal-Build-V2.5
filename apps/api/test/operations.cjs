const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {LocalStore}=require('../dist/portal/store.js');
const {OperationalWorker,InAppNotificationDelivery,WebhookOperationsAlertDelivery,aiRuntimeReadiness,operationalReadiness,operationalSnapshot,operationsAlertDeliveryFromEnv,verifyOperationsAlertSignature,writeWorkerHeartbeat}=require('../dist/portal/operations.js');

(async()=>{
 const store=new LocalStore(':memory:');
 const at=Date.parse('2026-09-12T12:00:00.000Z');
 await store.tx(async records=>{
  await records.put('sessions','expired',{expires:at-1});
  await records.put('sessions','active',{expires:at+86400000});
  await records.put('rate','expired',{reset:at-1});
  await records.put('profile_merge_pending','guest_expired',{account_id:'other',guest_actor:'guest_expired',expires_at:new Date(at-1).toISOString()});
  await records.put('ai_routing_log','old',{at:'2026-07-01T00:00:00.000Z'});
  await records.put('ai_routing_log','recent',{at:'2026-09-11T00:00:00.000Z'});
  await records.put('deletion_completions','old_proof',{completed_at:'2024-01-01T00:00:00.000Z'});
  await records.put('subscription_webhook_receipts','old_receipt',{last_received_at:'2024-01-01T00:00:00.000Z'});
  await records.put('support_metrics','old_support_metric',{date:'2026-01-01',updated_at:'2026-01-01T00:00:00.000Z'});
  await records.put('support_metrics','recent_support_metric',{date:'2026-09-11',updated_at:'2026-09-11T00:00:00.000Z'});
  await records.put('referral_metrics','old_referral_metric',{date:'2026-01-01',updated_at:'2026-01-01T00:00:00.000Z'});
  await records.put('referral_metrics','recent_referral_metric',{date:'2026-09-11',updated_at:'2026-09-11T00:00:00.000Z'});
 await records.put('reminders','user_1',[{product_id:'cleanser',due_at:'2026-09-12T11:00:00.000Z',paused:false},{product_id:'serum',due_at:'2026-09-13T11:00:00.000Z',paused:false}]);
 await records.put('backup_status','latest',{completed_at:'2026-09-12T10:00:00.000Z',restore_verified_at:'2026-09-10T10:00:00.000Z',location_identifier:'encrypted-offsite',restore_reference:'https://evidence.example.test/restore',checksum:'sha256:'+'a'.repeat(64)});
  await records.put('accounts','erase_me',{id:'erase_me',email:'erase@example.test',roles:[]});
  await records.put('profiles','user_erase_me',{input:{skin_type:'dry'}});
  await records.put('sessions','erase_session',{actor:'user_erase_me',userId:'erase_me',expires:at+86400000});
  await records.put('tickets','erase_ticket',{id:'erase_ticket',actor:'user_erase_me',email:'erase@example.test',status:'open'});
  await records.put('orders','erase_order',{id:'erase_order',actor:'user_erase_me',email:'erase@example.test',status:'fulfilled'});
  await records.put('audit','erase_audit',{id:'erase_audit',actor:'user_erase_me',action:'profile.saved',target:'self',at:'2026-09-01T00:00:00.000Z'});
  await records.put('deletion_requests','user_erase_me',{request_id:'request_erase',actor:'user_erase_me',user_id:'erase_me',requested_at:'2026-08-01T00:00:00.000Z',not_before:'2026-09-01T00:00:00.000Z',status:'pending'});
  await records.put('accounts','blocked',{id:'blocked',email:'blocked@example.test',roles:[]});
  await records.put('subscriptions','user_blocked:consumer',{customer_id:'cus_blocked',subscription_id:'sub_blocked',status:'active'});
  await records.put('deletion_requests','user_blocked',{request_id:'request_blocked',actor:'user_blocked',user_id:'blocked',requested_at:'2026-08-01T00:00:00.000Z',not_before:'2026-09-01T00:00:00.000Z',status:'pending'});
 });
 const identities=[];
 const worker=new OperationalWorker(store,{env:{BACKUP_MAX_AGE_HOURS:'26'},delivery:new InAppNotificationDelivery(),identityDeletion:{kind:'test',remove:async id=>identities.push(id)}});
 const result=await worker.runOnce(at);
 assert.equal(result.created,1);assert.equal(result.delivered,1);assert.equal(result.backup_status,'healthy');
 assert.equal(result.deletions_completed,1);assert.equal(result.deletions_blocked,1);assert.deepEqual(identities,['erase_me']);
 await store.tx(async records=>{
  assert.equal(await records.get('sessions','expired'),undefined);
  assert.ok(await records.get('sessions','active'));
  assert.equal(await records.get('rate','expired'),undefined);
  assert.equal(await records.get('profile_merge_pending','guest_expired'),undefined);
  assert.equal(await records.get('ai_routing_log','old'),undefined);
  assert.ok(await records.get('ai_routing_log','recent'));
  assert.equal(await records.get('deletion_completions','old_proof'),undefined);
  assert.equal(await records.get('subscription_webhook_receipts','old_receipt'),undefined);
  assert.equal(await records.get('support_metrics','old_support_metric'),undefined);
  assert.ok(await records.get('support_metrics','recent_support_metric'));
  assert.equal(await records.get('referral_metrics','old_referral_metric'),undefined);
  assert.ok(await records.get('referral_metrics','recent_referral_metric'));
  const reminders=await records.get('reminders','user_1');assert.ok(reminders[0].notification_id);
  const notifications=await records.entries('notifications');assert.equal(notifications.length,1);assert.equal(notifications[0].value.status,'delivered');
  assert.equal(await records.get('accounts','erase_me'),undefined);assert.equal(await records.get('profiles','user_erase_me'),undefined);assert.equal(await records.get('sessions','erase_session'),undefined);assert.equal(await records.get('tickets','erase_ticket'),undefined);
  assert.equal((await records.get('orders','erase_order')).email,null);assert.match((await records.get('orders','erase_order')).actor,/^deleted_/);
  assert.match((await records.get('audit','erase_audit')).actor,/^deleted_/);assert.ok(await records.get('deletion_completions','request_erase'));
  assert((await records.get('deletion_requests','user_blocked')).blocked_reasons.includes('active_consumer_subscription'));
 });
 const next=await worker.runOnce(at+60000);assert.equal(next.created,0);assert.equal(next.delivered,0);assert.equal(next.deletions_completed,0);assert.equal(next.deletions_blocked,1);
 const healthy=operationalReadiness(
  {status:'healthy',last_success_at:new Date(at-3600000).toISOString()},
  [{id:'newer',value:{completed_at:new Date(at-60000).toISOString()}},{id:'older',value:{completed_at:new Date(at-120000).toISOString()}}],
  at,300000);
 assert.equal(healthy.healthy,true);assert.equal(healthy.last_run.completed_at,new Date(at-60000).toISOString());
 assert.deepEqual(operationalReadiness({status:'unverified',last_success_at:new Date(at-3600000).toISOString()},[],at).issues,
  ['operations_worker_stale','backup_unhealthy']);
 assert.deepEqual(operationalReadiness({status:'stale',last_success_at:new Date(at-3600000).toISOString()},[],at).issues,
  ['operations_worker_stale','backup_unhealthy']);
 assert.equal(operationalReadiness({status:'healthy',last_success_at:new Date(at+60000).toISOString()},
  [{id:'future',value:{completed_at:new Date(at+60000).toISOString()}}],at).healthy,false);
 const snapshot=operationalSnapshot({
  notifications:[{status:'queued',created_at:new Date(at-20*60000).toISOString()},{status:'failed',created_at:new Date(at-60000).toISOString()}],
  deletions:[{status:'pending',not_before:new Date(at-60000).toISOString(),blocked_reasons:['active_consumer_subscription']}],
  tickets:[{status:'open',created_at:new Date(at-25*3600000).toISOString()}],
  runs:[{completed_at:new Date(at-60000).toISOString(),failed:2}],
  webhooks:[{status:'processing',last_received_at:new Date(at-11*60000).toISOString()},{status:'failed',last_received_at:new Date(at-60000).toISOString()}]
 },at,24);
 assert.equal(snapshot.healthy,false);assert.equal(snapshot.notifications.oldest_pending_minutes,20);assert.equal(snapshot.deletions.blocked,1);assert.equal(snapshot.support.overdue,1);assert.equal(snapshot.worker.delivery_failures_24h,2);assert.equal(snapshot.subscriptions.stalled,1);assert(snapshot.alerts.includes('notification_queue_aging'));assert(snapshot.alerts.includes('support_response_target_missed'));
 const clearSnapshot=operationalSnapshot({notifications:[],deletions:[],tickets:[],runs:[],webhooks:[]},at,24);assert.equal(clearSnapshot.healthy,true);assert.deepEqual(clearSnapshot.alerts,[]);
 assert.equal(operationsAlertDeliveryFromEnv({OPERATIONS_ALERT_DELIVERY:'disabled'}).kind,'disabled');
 assert.throws(()=>operationsAlertDeliveryFromEnv({NODE_ENV:'production',OPERATIONS_ALERT_DELIVERY:'webhook',OPERATIONS_ALERT_WEBHOOK_URL:'http://alerts.test',OPERATIONS_ALERT_WEBHOOK_TOKEN:'token'}),/HTTPS/);
 const originalFetch=global.fetch,request=[];global.fetch=async(url,init)=>{request.push({url,init});return {ok:true};};
 await new WebhookOperationsAlertDelivery('https://alerts.test/events','test-secret',1000).deliver({version:'1',delivery_id:'delivery_test',attempt:1,status:'active',alerts:['notification_delivery_failures'],summary:clearSnapshot,generated_at:new Date(at).toISOString()});
 global.fetch=originalFetch;const signedAt=Date.parse(request[0].init.headers['x-mgt-timestamp']);assert.equal(request[0].init.headers['x-mgt-event'],'operations.alert');assert.equal(request[0].init.headers['x-mgt-delivery-id'],'delivery_test');assert.equal(request[0].init.headers['x-mgt-attempt'],'1');assert.match(request[0].init.headers['x-mgt-timestamp'],/^2026-/);assert.match(request[0].init.headers['x-mgt-signature'],/^sha256=[a-f0-9]{64}$/);assert.equal(request[0].init.body.includes('test-secret'),false);assert.equal(verifyOperationsAlertSignature({timestamp:request[0].init.headers['x-mgt-timestamp'],signature:request[0].init.headers['x-mgt-signature'],body:request[0].init.body,secret:'test-secret',at:signedAt}),true);assert.equal(verifyOperationsAlertSignature({timestamp:request[0].init.headers['x-mgt-timestamp'],signature:request[0].init.headers['x-mgt-signature'],body:request[0].init.body,secret:'wrong-secret',at:signedAt}),false);assert.equal(verifyOperationsAlertSignature({timestamp:request[0].init.headers['x-mgt-timestamp'],signature:request[0].init.headers['x-mgt-signature'],body:request[0].init.body,secret:'test-secret',at:signedAt+301000}),false);
 const alertStore=new LocalStore(':memory:'),captured=[];
 await alertStore.tx(async records=>{await records.put('notifications','failed_alert',{id:'failed_alert',status:'failed',created_at:new Date(at-60000).toISOString(),updated_at:new Date(at-60000).toISOString(),attempts:3});await records.put('tickets','overdue_alert',{id:'overdue_alert',status:'open',created_at:new Date(at-25*3600000).toISOString()});});
 const alertWorker=new OperationalWorker(alertStore,{env:{SUPPORT_RESPONSE_TARGET_HOURS:'24'},delivery:new InAppNotificationDelivery(),identityDeletion:{kind:'test',remove:async()=>{}},alertDelivery:{kind:'test',deliver:async alert=>captured.push(alert)}});
 await alertWorker.runOnce(at);assert.equal(captured.length,1);assert.equal(captured[0].status,'active');assert(captured[0].alerts.includes('notification_delivery_failures'));assert.equal(JSON.stringify(captured[0]).includes('overdue_alert'),false);
 await alertWorker.runOnce(at+60000);assert.equal(captured.length,1,'unchanged alert fingerprint is not redelivered');
 await alertStore.tx(async records=>{await records.remove('notifications','failed_alert');const ticket=await records.get('tickets','overdue_alert');await records.put('tickets','overdue_alert',{...ticket,status:'closed'});});
 await alertWorker.runOnce(at+120000);assert.equal(captured.length,2);assert.equal(captured[1].status,'resolved');assert.deepEqual(captured[1].alerts,[]);
 await alertStore.close();
 const retryStore=new LocalStore(':memory:'),retryAttempts=[];
 await retryStore.tx(async records=>{await records.put('notifications','failed_retry',{id:'failed_retry',status:'failed',created_at:new Date(at-60000).toISOString(),updated_at:new Date(at-60000).toISOString(),attempts:1});});
 const retryWorker=new OperationalWorker(retryStore,{env:{OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS:'300'},delivery:new InAppNotificationDelivery(),identityDeletion:{kind:'test',remove:async()=>{}},alertDelivery:{kind:'test',deliver:async()=>{retryAttempts.push('attempt');throw new Error('Operations alert delivery returned 401.');}}});
 await retryWorker.runOnce(at);await retryWorker.runOnce(at+60000);assert.equal(retryAttempts.length,1,'failed alert delivery respects retry cooldown');await retryWorker.runOnce(at+301000);assert.equal(retryAttempts.length,2);
 const retryState=await retryStore.tx(records=>records.get('operations','alert_state'));assert.equal(retryState.last_error_code,'delivery_rejected');assert.equal(JSON.stringify(retryState).includes('401.'),false);const retryEvents=await retryStore.tx(records=>records.entries('operations_alert_events'));assert.equal(retryEvents.length,2);assert(retryEvents.every(event=>event.value.event_id&&event.value.attempt>=1));assert.equal(retryEvents[0].value.delivery_id,retryEvents[1].value.delivery_id,'retry preserves receiver idempotency key');await retryStore.close();
 assert.deepEqual(await aiRuntimeReadiness({OLLAMA_ENABLED:'false'}),{enabled:false,healthy:true});
 const models={models:[{name:'llama3.2:3b'},{name:'deepseek-r1:8b'},{model:'nomic-embed-text'}]};
 assert.deepEqual(await aiRuntimeReadiness({OLLAMA_ENABLED:'true',OLLAMA_BASE_URL:'http://ollama'},async()=>({ok:true,json:async()=>models})),{enabled:true,healthy:true});
 assert.deepEqual(await aiRuntimeReadiness({OLLAMA_ENABLED:'true',OLLAMA_BASE_URL:'http://ollama'},async()=>({ok:true,json:async()=>({models:models.models.slice(0,2)})})),{enabled:true,healthy:false});
 assert.deepEqual(await aiRuntimeReadiness({OLLAMA_ENABLED:'true',OLLAMA_BASE_URL:'http://ollama'},async()=>{throw new Error('offline');}),{enabled:true,healthy:false});
 const heartbeatFile=path.resolve('tmp','worker-heartbeat-test.json');
 await fs.mkdir(path.dirname(heartbeatFile),{recursive:true});
 await writeWorkerHeartbeat(heartbeatFile,{run_id:'test'});
 assert.equal(JSON.parse(await fs.readFile(heartbeatFile,'utf8')).result.run_id,'test');
 await fs.unlink(heartbeatFile);
 await store.close();console.log('operations smoke passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
