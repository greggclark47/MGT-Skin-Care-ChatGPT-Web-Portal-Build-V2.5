const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPortal}=require('../dist/portal/server');
const {LocalStore}=require('../dist/portal/store');
const {OperationalWorker}=require('../dist/portal/operations');

const input={preferred_name:'Alex',locale:'en-US',timezone:'America/New_York',measurement_system:'us',service_interests:['skin_match','routine_care','anti_aging'],communication_preferences:{routine_reminders:true,service_announcements:false},accessibility:{reduced_motion:true,high_contrast:false},default_image_storage:'device'};

async function fixture(t){
 const db=new LocalStore(':memory:');
 const app=await createPortal({store:db,env:{NODE_ENV:'test',DEMO_MODE:'true',PUBLIC_ORIGIN:'http://portal.test'},verifyOtp:async email=>({id:email,email})});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();});
 const client=()=>{let cookie='',csrf='';const send=async(path,body)=>{const response=await fetch(base+'/api/hub'+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin:'http://portal.test',...(body===undefined?{}:{'content-type':'application/json','x-csrf-token':csrf})},body:body===undefined?undefined:JSON.stringify(body)});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const data=await response.json();if(data.csrf)csrf=data.csrf;return{status:response.status,data,headers:response.headers};};return{send,login:async(email='member@example.com')=>{await send('/session');assert.equal((await send('/auth/verify',{email,code:'123456'})).status,200);await send('/session');}};};
 return{db,client};
}

test('account profile requires a verified account',async t=>{
 const f=await fixture(t),guest=f.client();await guest.send('/session');
 assert.equal((await guest.send('/account/profile')).status,401);
 assert.equal((await guest.send('/account/profile',input)).status,401);
});

test('account profile saves, reads and rejects stale revisions',async t=>{
 const f=await fixture(t),member=f.client();await member.login();
 const created=await member.send('/account/profile',{...input,expected_revision:null});
 assert.equal(created.status,200);assert.equal(created.data.profile.preferred_name,'Alex');assert.equal(typeof created.data.revision,'string');
 const read=await member.send('/account/profile');assert.deepEqual(read.data,created.data);
 await f.db.tx(async r=>{await r.put('ai_output_events','profile_trace_owner',{trace_id:'profile_trace_owner',actor:'user_member@example.com',user_id:'member@example.com',stale:false});await r.put('ai_output_events','profile_trace_other',{trace_id:'profile_trace_other',actor:'user_other@example.com',user_id:'other@example.com',stale:false});});
 const updated=await member.send('/account/profile',{...input,preferred_name:'Alexis',expected_revision:created.data.revision});assert.equal(updated.status,200);
 const ownerTrace=await f.db.tx(r=>r.get('ai_output_events','profile_trace_owner')),otherTrace=await f.db.tx(r=>r.get('ai_output_events','profile_trace_other'));assert.equal(ownerTrace.stale,true);assert.deepEqual(ownerTrace.stale_reasons,['profile_revision_changed']);assert.equal(otherTrace.stale,false);
 assert.equal((await member.send('/account/profile',{...input,preferred_name:'Stale',expected_revision:created.data.revision})).status,409);
 assert.equal((await member.send('/account/profile')).data.profile.preferred_name,'Alexis');
});

test('account profile validates data minimization fields and test storage availability',async t=>{
 const f=await fixture(t),member=f.client();await member.login();
 for(const invalid of [
  {...input,preferred_name:''},
  {...input,locale:'fr-FR'},
  {...input,timezone:'not/a-zone'},
  {...input,service_interests:[]},
  {...input,communication_preferences:{routine_reminders:'yes',service_announcements:false}},
  {...input,default_image_storage:'test-drive'}
 ])assert.notEqual((await member.send('/account/profile',{...invalid,expected_revision:null})).status,200);
 assert.equal((await f.db.tx(r=>r.get('account_profiles','user_member@example.com'))),undefined);
});

test('account overview requires sign-in and returns isolated metadata-only readiness',async t=>{
 const f=await fixture(t),guest=f.client();await guest.send('/session');assert.equal((await guest.send('/account/overview')).status,401);
 const member=f.client();await member.login();
 const empty=await member.send('/account/overview');assert.equal(empty.data.focus.total,1);assert.equal(empty.data.focus.percent,0);assert.deepEqual(empty.data.focus.service_ids,['account_profile']);assert.deepEqual(empty.data.next_steps.map(step=>step.id),['account_profile']);
 await member.send('/account/profile',{...input,expected_revision:null});
 const guidance=await member.send('/assistant',{role:'onboarding',message:'How do I get started?'});
 assert.equal(guidance.status,200);
 assert.deepEqual(guidance.data.customer_context,{profile_ready:true,preferred_name:'Alex',locale:'en-US',timezone:'America/New_York',measurement_system:'us',service_interests:['skin_match','routine_care','anti_aging'],synchronized_at:guidance.data.customer_context.synchronized_at});
 assert.equal(typeof guidance.data.customer_context.synchronized_at,'string');
 const actor='user_member@example.com';
 await member.send('/profile',{skin_type:'dry',concerns:['hydration'],sensitivity:'none',age_band:'26_35',current_routine:'basic',desired_outcome:'glow',budget_range:'between_25_50',ingredient_avoidances:[],consent:true});
 await f.db.tx(async r=>{
  const currentProfile=await r.get('profiles',actor);await r.put('profiles',actor,{...currentProfile,routine:{...currentProfile.routine,steps:currentProfile.routine.steps.slice(0,2).map((step,index)=>({...step,product_id:`private-product-${index+1}`}))},private_note:'private-profile-note',private_concern:'private-concern'});
  await r.put('style_profiles',actor,{input:{hair_goals:'private-style-answer'}});
  await r.put('saved_retailers',actor,['retailer-one','retailer-two']);
  await r.put('anti_aging_progress',actor+':entry-one',{actor,entry_id:'entry-one',status:'completed',completed_at:'2026-10-20T00:00:00.000Z',private_note:'hidden-progress'});
  await r.put('anti_aging_reminders','reminder-one',{actor,id:'reminder-one',entry_id:'entry-one',cadence:'weekly',next_at:'2026-10-27T00:00:00.000Z',paused:false,private_schedule:'hidden-reminder'});
  await r.put('regimen_cycles','cycle-owner',{actor:'member@example.com',id:'cycle-owner',focus:'steady_routine',starts_at:'2026-10-20T00:00:00.000Z',private_note:'hidden-cycle'});
  await r.put('regimen_cycles','cycle-other',{actor:'other@example.com',id:'cycle-other',focus:'other-private-focus'});
  await r.put('tickets','ticket-owner',{id:'ticket-owner',actor,status:'open',subject:'private-support-subject',message:'private-support-message'});
  await r.put('tickets','ticket-other',{id:'ticket-other',actor:'user_other@example.com',status:'open',subject:'other-private-subject',message:'other-private-message'});
  await r.put('subscriptions',actor+':consumer',{active:true,status:'active',customer_id:'cus_private',subscription_id:'sub_private',payment_method_id:'pm_private'});
  await r.put('consents',actor+':ai_disclosure',{actor,consent_type:'ai_disclosure',version:'2026-09-29',granted:true,captured_at:new Date().toISOString()});
 });
 const response=await member.send('/account/overview');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal(response.data.services.length,10);assert.deepEqual(response.data.summary,{ready:8,attention:1,setup:0,unavailable:1,total:10});
 const byId=Object.fromEntries(response.data.services.map(service=>[service.id,service]));
 assert.equal(byId.skin_routine.count,2);assert.equal(byId.anti_aging.count,3);assert.match(byId.anti_aging.detail,/1 regimen cycle/);assert.equal(byId.retail_discovery.count,2);assert.equal(byId.support.count,1);assert.equal(byId.billing.state,'ready');assert.equal(byId.images.state,'unavailable');
 assert.deepEqual(response.data.focus,{ready:3,attention:1,setup:0,unavailable:0,total:4,percent:75,service_ids:['account_profile','skin_routine','anti_aging','support']});assert.deepEqual(response.data.next_steps.map(step=>step.id),['support']);assert.equal(byId.retail_discovery.selected,false);assert.equal(byId.billing.selected,false);assert.equal(byId.support.selected,true);
 const serialized=JSON.stringify(response.data);for(const secret of ['private-concern','private-style-answer','private-product-one','ticket-owner','private-support','ticket-other','other-private','cus_private','sub_private','pm_private','hidden-progress','hidden-reminder','cycle-owner','private-focus'])assert.equal(serialized.includes(secret),false,secret+' was exposed');
});

test('account export includes the connected profile without payment credentials',async t=>{
 const f=await fixture(t),member=f.client();await member.login();
 await member.send('/account/profile',{...input,expected_revision:null});
 await f.db.tx(async r=>{const current=await r.get('account_profiles','user_member@example.com');assert(current);await r.put('account_profiles','user_member@example.com',{...current,actor:'private-account-actor',private_note:'private-account-note',provider_subject:'private-provider-subject'});});
 const accountRead=await member.send('/account/profile');assert.equal(accountRead.status,200);assert.equal(accountRead.data.profile.preferred_name,'Alex');assert.equal('actor' in accountRead.data.profile,false);assert.equal('private_note' in accountRead.data.profile,false);assert.equal('provider_subject' in accountRead.data.profile,false);
 const skinInput={skin_type:'dry',concerns:['hydration'],sensitivity:'none',age_band:'26_35',current_routine:'basic',desired_outcome:'glow',budget_range:'between_25_50',ingredient_avoidances:[],consent:true};
 const savedSkin=await member.send('/profile',skinInput);assert.equal(savedSkin.status,200);
 await f.db.tx(async r=>{const current=await r.get('profiles','user_member@example.com');assert(current);await r.put('profiles','user_member@example.com',{...current,actor:'private-profile-actor',private_note:'private-profile-note',internal_trace:{provider:'private-provider'}});});
 await f.db.tx(r=>r.put('reminders','user_member@example.com',[{product_id:'cleanser',due_at:'2026-11-10T00:00:00.000Z',paused:false,notification_id:'private-notification-id',private_note:'private-reminder-note'}]));
 await f.db.tx(r=>r.put('saved_retailers','user_member@example.com',['mented','private-retailer-id']));
 await f.db.tx(r=>r.put('orders','order_export',{id:'order_export',actor:'user_member@example.com',status:'fulfilled',items:[{product_id:'cleanser',name:'Gentle cleanser',quantity:1,price_cents:1200,private_item_note:'hidden-item-note'}],total_cents:1200,currency:'usd',created_at:'2026-10-20T00:00:00.000Z',updated_at:'2026-10-21T00:00:00.000Z',payment_intent_id:'pi_private',private_order_note:'hidden-order-note'}));
 await f.db.tx(r=>r.put('orders','hidden-order-id',{id:'hidden-order-id',actor:'user_member@example.com',status:'unexpected-status',items:[{product_id:'cleanser',name:'Gentle cleanser',quantity:1,price_cents:1200}],total_cents:1200,currency:'usd',created_at:'2026-10-20T00:00:00.000Z',updated_at:'2026-10-21T00:00:00.000Z',private_order_note:'hidden-corrupt-order-note'}));
 await f.db.tx(async r=>{await r.put('regimen_cycles','cycle_export',{id:'cycle_export',actor:'member@example.com',focus:'steady_routine',consent_version:'regimen-cycle-1',starts_at:'2026-10-16T00:00:00.000Z',private_note:'hidden-cycle-note'});await r.put('regimen_cycle_check_ins','checkin_export',{id:'checkin_export',actor:'member@example.com',cycle_id:'cycle_export',status:'comfortable',completed_at:'2026-10-17T00:00:00.000Z',private_note:'hidden-checkin-note'});await r.put('ai_output_events','trace_export',{trace_id:'trace_export',actor:'user_member@example.com',user_id:'member@example.com',task:'coach_answer',prompt_version:'prompt-v2.1',safety_policy_version:'reviewed-excerpts-v1',profile_revision:'profile-revision',consent_revision:'2026-09-29:captured',knowledge_revision:'knowledge-revision',profile_context_used:false,generated_at:'2026-10-18T00:00:00.000Z',expires_at:'2026-10-18T00:05:00.000Z',stale:false,result_kind:'reviewed_excerpts',citation_revisions:['moisturizer:2'],private_prompt:'hidden-question'});await r.put('ai_output_events','trace_invalid',{trace_id:{private:'hidden-trace-id'},actor:'user_member@example.com',user_id:'member@example.com',task:'coach_answer',prompt_version:'prompt-v2.1',safety_policy_version:'reviewed-excerpts-v1',consent_revision:'2026-09-29:captured',knowledge_revision:'knowledge-revision',generated_at:'not-a-date',expires_at:'not-a-date',result_kind:'reviewed_excerpts',private_prompt:'hidden-invalid-trace'});await r.put('ai_output_events','trace_other',{trace_id:'trace_other',actor:'user_other@example.com',user_id:'other@example.com',generated_at:'2026-10-19T00:00:00.000Z',private_prompt:'other-hidden-question'});await r.put('consents','user_member@example.com:ai_disclosure',{actor:'user_member@example.com',consent_type:'ai_disclosure',version:'2026-09-29',granted:true,captured_at:'2026-10-17T00:00:00.000Z',revoked_at:null,internal_note:'hidden-consent-note'});});
 await f.db.tx(async r=>{const actor='user_member@example.com',other='user_other@example.com';await r.put('notifications','notification_export',{id:'notification_export',actor,kind:'replenishment_reminder',status:'delivered',scheduled_at:'2026-10-18T00:00:00.000Z',created_at:'2026-10-17T00:00:00.000Z',updated_at:'2026-10-18T00:00:00.000Z',attempts:1,payload:{product_id:'cleanser',due_at:'2026-10-18T00:00:00.000Z',private_payload_note:'hidden-payload-note'},claim_id:'hidden-notification-claim'});await r.put('notifications','notification_other',{id:'notification_other',actor:other,status:'delivered',private_note:'other-notification'});await r.put('anti_aging_progress','progress_export',{actor,entry_id:'progress-export',status:'completed',completed_at:'2026-10-18T00:00:00.000Z',consent_version:'progress-1',created_at:'2026-10-18T00:00:00.000Z',policy_version:'anti-aging-roadmap-1',private_note:'hidden-progress-note'});await r.put('anti_aging_progress','progress_other',{actor:other,entry_id:'progress-other',private_note:'other-progress'});await r.put('anti_aging_reminders','reminder_export',{id:'reminder_export',actor,entry_id:'progress-export',cadence:'weekly',next_at:'2026-10-25T00:00:00.000Z',paused:false,consent_version:'reminders-1',created_at:'2026-10-18T00:00:00.000Z',updated_at:'2026-10-18T00:00:00.000Z',policy_version:'anti-aging-roadmap-1',private_note:'hidden-reminder-note'});await r.put('anti_aging_appointment_requests','appointment_export',{id:'appointment_export',actor,provider_id:'provider-example-dermatology',status:'handoff_pending',consent:'provider_handoff',requested_window:null,data_shared:[],booking_supported:false,uncertainty:'No booking is created.',created_at:'2026-10-18T00:00:00.000Z',updated_at:'2026-10-18T00:00:00.000Z',policy_version:'appointment-handoff-boundary-1',private_note:'hidden-appointment-note'});await r.put('anti_aging_ai_events','event_export',{actor,response_id:'response-export',task:'anti_aging_explanation',latency_ms:125,cost_cents:3,validation:'passed',created_at:'2026-10-18T00:01:00.000Z',private_provider:'hidden-provider'});await r.put('anti_aging_ai_events','event_invalid',{actor,response_id:{private:'hidden-response-id'},task:'anti_aging_explanation',latency_ms:'slow',cost_cents:-1,validation:'passed',created_at:'not-a-date',private_provider:'hidden-invalid-provider'});await r.put('anti_aging_ai_events','event_other',{actor:other,response_id:'response-other',private_provider:'other-provider'});await r.put('anti_aging_ai_feedback','feedback_export',{actor,response_id:'response-export',task:'anti_aging_explanation',rating:'helpful',reason:'other',comment:'This explanation helped me compare options.',created_at:'2026-10-18T00:02:00.000Z',private_route:'hidden-route'});await r.put('anti_aging_ai_feedback','feedback_invalid',{actor,response_id:'response-invalid',task:'anti_aging_explanation',rating:'unknown',comment:{private:'hidden-invalid-feedback'},created_at:'not-a-date',private_route:'hidden-invalid-route'});await r.put('anti_aging_ai_feedback','feedback_other',{actor:other,response_id:'response-other',private_route:'other-route'});});
 const exported=await member.send('/account/export');assert.equal(exported.status,200);assert.equal(exported.data.account_profile.preferred_name,'Alex');assert.equal('actor' in exported.data.account_profile,false);assert.equal('private_note' in exported.data.account_profile,false);assert.equal(JSON.stringify(exported.data.account_profile).includes('private-provider-subject'),false);assert.deepEqual(exported.data.reminders,[{product_id:'cleanser',due_at:'2026-11-10T00:00:00.000Z',paused:false}]);assert.deepEqual(exported.data.saved_retailers,['mented']);assert.equal(exported.data.saved_retailers.includes('private-retailer-id'),false);assert.deepEqual(exported.data.orders,[{id:'order_export',status:'fulfilled',items:[{product_id:'cleanser',name:'Gentle cleanser',quantity:1,price_cents:1200}],total_cents:1200,currency:'usd',created_at:'2026-10-20T00:00:00.000Z',updated_at:'2026-10-21T00:00:00.000Z'}]);assert.equal(JSON.stringify(exported.data.orders).includes('pi_private'),false);assert.equal(JSON.stringify(exported.data.orders).includes('hidden-order-note'),false);assert.equal(exported.data.profile.revision,savedSkin.data.revision);assert.equal('actor' in exported.data.profile,false);assert.equal('private_note' in exported.data.profile,false);assert.equal(JSON.stringify(exported.data.profile).includes('private-provider'),false);
 assert.deepEqual(exported.data.regimen_cycles,[{id:'cycle_export',focus:'steady_routine',starts_at:'2026-10-16T00:00:00.000Z'}]);assert.deepEqual(exported.data.regimen_cycle_check_ins,[{id:'checkin_export',cycle_id:'cycle_export',status:'comfortable',completed_at:'2026-10-17T00:00:00.000Z'}]);
 assert.deepEqual(exported.data.ai_output_traces,[{trace_id:'trace_export',task:'coach_answer',prompt_version:'prompt-v2.1',safety_policy_version:'reviewed-excerpts-v1',profile_revision:'profile-revision',consent_revision:'2026-09-29:captured',knowledge_revision:'knowledge-revision',profile_context_used:false,generated_at:'2026-10-18T00:00:00.000Z',expires_at:'2026-10-18T00:05:00.000Z',stale:false,stale_at:null,stale_reasons:[],result_kind:'reviewed_excerpts',citation_revisions:['moisturizer:2']}]);assert.equal(JSON.stringify(exported.data.regimen_cycles).includes('hidden-cycle-note'),false);assert.equal(JSON.stringify(exported.data.regimen_cycle_check_ins).includes('hidden-checkin-note'),false);
 assert.deepEqual(exported.data.ai_disclosure,{version:'2026-09-29',granted:true,captured_at:'2026-10-17T00:00:00.000Z',revoked_at:null});
 assert.deepEqual(exported.data.notifications.map(item=>item.id),['notification_export']);assert.deepEqual(exported.data.notifications[0].payload,{product_id:'cleanser',due_at:'2026-10-18T00:00:00.000Z'});assert.equal(JSON.stringify(exported.data.notifications).includes('hidden-payload-note'),false);assert.deepEqual(exported.data.anti_aging_progress.map(item=>item.entry_id),['progress-export']);assert.deepEqual(exported.data.anti_aging_reminders.map(item=>item.id),['reminder_export']);assert.deepEqual(exported.data.anti_aging_appointment_requests.map(item=>item.id),['appointment_export']);assert.deepEqual(exported.data.anti_aging_ai_events,[{response_id:'response-export',task:'anti_aging_explanation',latency_ms:125,cost_cents:3,validation:'passed',created_at:'2026-10-18T00:01:00.000Z'}]);assert.deepEqual(exported.data.anti_aging_ai_feedback,[{response_id:'response-export',task:'anti_aging_explanation',rating:'helpful',reason:'other',comment:'This explanation helped me compare options.',created_at:'2026-10-18T00:02:00.000Z'}]);
 const serialized=JSON.stringify(exported.data);assert.doesNotMatch(serialized,/card_number|security_code|client_secret|payment_method_id|private_prompt|hidden-question|hidden-invalid-trace|hidden-trace-id|hidden-consent-note|hidden-notification-claim|hidden-progress-note|hidden-reminder-note|hidden-appointment-note|hidden-provider|hidden-invalid-provider|hidden-invalid-feedback|hidden-route|hidden-order-id|hidden-corrupt-order-note|trace_other|trace_invalid|notification_other|progress_other|event_other|feedback_other|response-invalid|other-notification|other-progress|other-provider|other-route/);assert.equal(serialized.includes('"actor"'),false);assert.equal(serialized.includes('"user_id"'),false);assert.equal(serialized.includes('"consent_type"'),false);
});

test('account export is bounded per account',async t=>{
 const f=await fixture(t),member=f.client();await member.login();
 for(let attempt=0;attempt<5;attempt++)assert.equal((await member.send('/account/export')).status,200);
 assert.equal((await member.send('/account/export')).status,429);
});

test('account consent projection fails closed for malformed stored disclosure',async t=>{
 const f=await fixture(t),member=f.client();await member.login();
 await f.db.tx(async r=>{await r.put('consents','user_member@example.com:ai_disclosure',{actor:'user_member@example.com',consent_type:'ai_disclosure',version:'old-version',granted:true,captured_at:'not-a-date',revoked_at:'not-a-date',private_note:'hidden-consent-note'});await r.put('subscriptions','user_member@example.com:consumer',{subscription_id:{private:'hidden-subscription-id'},status:'active',active:true,current_period_end:'not-a-number',private_note:'hidden-subscription-note'});});
 const consent=await member.send('/account/consents');assert.equal(consent.status,200);assert.deepEqual(consent.data,{ai_disclosure:null});
 const exported=await member.send('/account/export');assert.equal(exported.status,200);assert.equal(exported.data.ai_disclosure,null);assert.deepEqual(exported.data.subscriptions,[{audience:'consumer',record:null}]);assert(!JSON.stringify(exported.data).includes('hidden-consent-note'));assert(!JSON.stringify(exported.data).includes('hidden-subscription'));
});

test('deletion request projection fails closed for malformed stored state',async t=>{
 const f=await fixture(t),member=f.client();await member.login();
 await f.db.tx(r=>r.put('deletion_requests','user_member@example.com',{request_id:{private:'hidden-deletion-id'},status:'pending',requested_at:'not-a-date',not_before:'not-a-date',attempts:-1,blocked_reasons:['hidden-blocker'],last_error:'hidden-deletion-error'}));
 const request=await member.send('/account/deletion-request');assert.equal(request.status,200);assert.deepEqual(request.data,{request:null});const session=await member.send('/session');assert.equal(session.status,200);assert.equal(session.data.deletion_request,null);const exported=await member.send('/account/export');assert.equal(exported.status,200);assert.equal(exported.data.deletion_request,null);assert(!JSON.stringify(exported.data).includes('hidden-deletion'));
});

test('account deletion erases the connected profile',async t=>{
 const f=await fixture(t),member=f.client();await member.login();await member.send('/account/profile',{...input,expected_revision:null});
 await f.db.tx(async r=>{await r.put('regimen_cycles','cycle_delete',{id:'cycle_delete',actor:'member@example.com'});await r.put('regimen_cycle_check_ins','checkin_delete',{id:'checkin_delete',actor:'member@example.com',cycle_id:'cycle_delete'});await r.put('wardrobes','user_member@example.com',{items:[{id:'wardrobe_delete',name:'Saved jacket',category:'outer layer',color:'navy',notes:'private',created_at:'2026-10-20T00:00:00.000Z'}],revision:'wardrobe-revision'});await r.put('consents','user_member@example.com:ai_disclosure',{actor:'user_member@example.com',consent_type:'ai_disclosure',version:'2026-09-29',granted:true,captured_at:new Date().toISOString()});});
 const at=Date.now();await f.db.tx(r=>r.put('deletion_requests','user_member@example.com',{request_id:'delete-profile',actor:'user_member@example.com',user_id:'member@example.com',requested_at:new Date(at-1000).toISOString(),not_before:new Date(at-1).toISOString(),status:'pending',attempts:0}));
 const worker=new OperationalWorker(f.db,{env:{NODE_ENV:'test'},identityDeletion:{kind:'test',remove:async()=>{}}});
 const result=await worker.runOnce(at);assert.equal(result.deletions_completed,1);assert.equal(await f.db.tx(r=>r.get('account_profiles','user_member@example.com')),undefined);assert.equal(await f.db.tx(r=>r.get('regimen_cycles','cycle_delete')),undefined);assert.equal(await f.db.tx(r=>r.get('regimen_cycle_check_ins','checkin_delete')),undefined);assert.equal(await f.db.tx(r=>r.get('wardrobes','user_member@example.com')),undefined);assert.equal(await f.db.tx(r=>r.get('consents','user_member@example.com:ai_disclosure')),undefined);
});
