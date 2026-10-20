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
 const updated=await member.send('/account/profile',{...input,preferred_name:'Alexis',expected_revision:created.data.revision});assert.equal(updated.status,200);
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
 const actor='user_member@example.com';
 await f.db.tx(async r=>{
  await r.put('profiles',actor,{routine:{steps:[{product_id:'private-product-one'},{product_id:'private-product-two'}]},input:{concerns:['private-concern']}});
  await r.put('style_profiles',actor,{input:{hair_goals:'private-style-answer'}});
  await r.put('saved_retailers',actor,['retailer-one','retailer-two']);
  await r.put('anti_aging_progress',actor+':entry-one',{actor,entry_id:'entry-one',private_note:'hidden-progress'});
  await r.put('anti_aging_reminders','reminder-one',{actor,id:'reminder-one',private_schedule:'hidden-reminder'});
  await r.put('tickets','ticket-owner',{id:'ticket-owner',actor,status:'open',subject:'private-support-subject',message:'private-support-message'});
  await r.put('tickets','ticket-other',{id:'ticket-other',actor:'user_other@example.com',status:'open',subject:'other-private-subject',message:'other-private-message'});
  await r.put('subscriptions',actor+':consumer',{active:true,status:'active',customer_id:'cus_private',subscription_id:'sub_private',payment_method_id:'pm_private'});
  await r.put('consents',actor+':ai_disclosure',{actor,consent_type:'ai_disclosure',version:'2026-09-29',granted:true,captured_at:new Date().toISOString()});
 });
 const response=await member.send('/account/overview');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
 assert.equal(response.data.services.length,10);assert.deepEqual(response.data.summary,{ready:8,attention:1,setup:0,unavailable:1,total:10});
 const byId=Object.fromEntries(response.data.services.map(service=>[service.id,service]));
 assert.equal(byId.skin_routine.count,2);assert.equal(byId.anti_aging.count,2);assert.equal(byId.retail_discovery.count,2);assert.equal(byId.support.count,1);assert.equal(byId.billing.state,'ready');assert.equal(byId.images.state,'unavailable');
 assert.deepEqual(response.data.focus,{ready:3,attention:1,setup:0,unavailable:0,total:4,percent:75,service_ids:['account_profile','skin_routine','anti_aging','support']});assert.deepEqual(response.data.next_steps.map(step=>step.id),['support']);assert.equal(byId.retail_discovery.selected,false);assert.equal(byId.billing.selected,false);assert.equal(byId.support.selected,true);
 const serialized=JSON.stringify(response.data);for(const secret of ['private-concern','private-style-answer','private-product-one','ticket-owner','private-support','ticket-other','other-private','cus_private','sub_private','pm_private','hidden-progress','hidden-reminder'])assert.equal(serialized.includes(secret),false,secret+' was exposed');
});

test('account export includes the connected profile without payment credentials',async t=>{
 const f=await fixture(t),member=f.client();await member.login();
 await member.send('/account/profile',{...input,expected_revision:null});
 await f.db.tx(async r=>{await r.put('regimen_cycles','cycle_export',{id:'cycle_export',actor:'member@example.com',focus:'steady_routine',consent_version:'regimen-cycle-1',starts_at:'2026-10-16T00:00:00.000Z'});await r.put('regimen_cycle_check_ins','checkin_export',{id:'checkin_export',actor:'member@example.com',cycle_id:'cycle_export',status:'comfortable',completed_at:'2026-10-17T00:00:00.000Z'});});
 const exported=await member.send('/account/export');assert.equal(exported.status,200);assert.equal(exported.data.account_profile.preferred_name,'Alex');
 assert.deepEqual(exported.data.regimen_cycles,[{id:'cycle_export',focus:'steady_routine',starts_at:'2026-10-16T00:00:00.000Z'}]);assert.deepEqual(exported.data.regimen_cycle_check_ins,[{id:'checkin_export',cycle_id:'cycle_export',status:'comfortable',completed_at:'2026-10-17T00:00:00.000Z'}]);
 const serialized=JSON.stringify(exported.data);assert.doesNotMatch(serialized,/card_number|security_code|client_secret|payment_method_id|consent_version/);assert.equal(serialized.includes('"actor"'),false);
});

test('account deletion erases the connected profile',async t=>{
 const f=await fixture(t),member=f.client();await member.login();await member.send('/account/profile',{...input,expected_revision:null});
 await f.db.tx(async r=>{await r.put('regimen_cycles','cycle_delete',{id:'cycle_delete',actor:'member@example.com'});await r.put('regimen_cycle_check_ins','checkin_delete',{id:'checkin_delete',actor:'member@example.com',cycle_id:'cycle_delete'});await r.put('wardrobes','user_member@example.com',{items:[{id:'wardrobe_delete',name:'Saved jacket',category:'outer layer',color:'navy',notes:'private',created_at:'2026-10-20T00:00:00.000Z'}],revision:'wardrobe-revision'});});
 const at=Date.now();await f.db.tx(r=>r.put('deletion_requests','user_member@example.com',{request_id:'delete-profile',actor:'user_member@example.com',user_id:'member@example.com',requested_at:new Date(at-1000).toISOString(),not_before:new Date(at-1).toISOString(),status:'pending',attempts:0}));
 const worker=new OperationalWorker(f.db,{env:{NODE_ENV:'test'},identityDeletion:{kind:'test',remove:async()=>{}}});
 const result=await worker.runOnce(at);assert.equal(result.deletions_completed,1);assert.equal(await f.db.tx(r=>r.get('account_profiles','user_member@example.com')),undefined);assert.equal(await f.db.tx(r=>r.get('regimen_cycles','cycle_delete')),undefined);assert.equal(await f.db.tx(r=>r.get('regimen_cycle_check_ins','checkin_delete')),undefined);assert.equal(await f.db.tx(r=>r.get('wardrobes','user_member@example.com')),undefined);
});
