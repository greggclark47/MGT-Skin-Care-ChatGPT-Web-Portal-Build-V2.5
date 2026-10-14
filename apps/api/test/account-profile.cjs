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
 const client=()=>{let cookie='',csrf='';const send=async(path,body)=>{const response=await fetch(base+'/api/hub'+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin:'http://portal.test',...(body===undefined?{}:{'content-type':'application/json','x-csrf-token':csrf})},body:body===undefined?undefined:JSON.stringify(body)});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const data=await response.json();if(data.csrf)csrf=data.csrf;return{status:response.status,data};};return{send,login:async(email='member@example.com')=>{await send('/session');assert.equal((await send('/auth/verify',{email,code:'123456'})).status,200);await send('/session');}};};
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

test('account export includes the connected profile without payment credentials',async t=>{
 const f=await fixture(t),member=f.client();await member.login();
 await member.send('/account/profile',{...input,expected_revision:null});
 const exported=await member.send('/account/export');assert.equal(exported.status,200);assert.equal(exported.data.account_profile.preferred_name,'Alex');
 const serialized=JSON.stringify(exported.data);assert.doesNotMatch(serialized,/card_number|security_code|client_secret|payment_method_id/);
});

test('account deletion erases the connected profile',async t=>{
 const f=await fixture(t),member=f.client();await member.login();await member.send('/account/profile',{...input,expected_revision:null});
 const at=Date.now();await f.db.tx(r=>r.put('deletion_requests','user_member@example.com',{request_id:'delete-profile',actor:'user_member@example.com',user_id:'member@example.com',requested_at:new Date(at-1000).toISOString(),not_before:new Date(at-1).toISOString(),status:'pending',attempts:0}));
 const worker=new OperationalWorker(f.db,{env:{NODE_ENV:'test'},identityDeletion:{kind:'test',remove:async()=>{}}});
 const result=await worker.runOnce(at);assert.equal(result.deletions_completed,1);assert.equal(await f.db.tx(r=>r.get('account_profiles','user_member@example.com')),undefined);
});
