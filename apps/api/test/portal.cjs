const assert=require('node:assert/strict');
const {createPortal}=require('../dist/portal/server');const {LocalStore}=require('../dist/portal/store');const {RETAILERS}=require('../dist/portal/retailers');
(async()=>{const db=new LocalStore(':memory:');let paymentCalls=0;const stripe=new Proxy({}, {get(){paymentCalls++;throw Error('Payment SDK must not be used in referral mode');}});
 const app=await createPortal({store:db,stripe,env:{NODE_ENV:'test',DEMO_MODE:'true',PUBLIC_ORIGIN:'http://localhost:3000'}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin='http://127.0.0.1:'+server.address().port;
 function client(){let cookie='',csrf='';return async(path,body,extra={})=>{const res=await fetch(origin+'/api/hub'+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin:'http://localhost:3000','content-type':'application/json','x-csrf-token':csrf,...extra},body:body===undefined?undefined:JSON.stringify(body)});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const data=await res.json();if(data.csrf)csrf=data.csrf;return{status:res.status,data};};}
 try{
 const a=client(),b=client();const session=await a('/session');await b('/session');assert.equal(session.status,200);assert.equal(session.data.commerce.mode,'external_referral');assert.equal(session.data.payments_configured,false);
 const directory=(await a('/retailers')).data,retailers=directory.retailers;assert.equal(retailers.length,11);assert.deepEqual(new Set(retailers.map(r=>r.region)),new Set(['South Korea','US','EU']));
 assert.equal(new Set(retailers.map(r=>r.id)).size,retailers.length);
 assert.equal(directory.segments.length,7);
 for(const segment of directory.segments){assert(retailers.some(r=>r.segments.includes(segment.id)),segment.id+' has a destination');assert(segment.studio.startsWith('/'));}
 for(const retailer of retailers){assert(retailer.specialty);assert(retailer.segments.every(id=>directory.segments.some(s=>s.id===id)));assert.equal(new URL(retailer.source_url).protocol,'https:');}
 for(const r of retailers){const url=new URL(r.url);assert.equal(url.protocol,'https:');assert.equal(url.search,'');assert.equal(url.username,'');assert.equal(r.relationship,'independent');assert(RETAILERS.some(v=>v.id===r.id&&v.url===r.url));}
 assert.equal((await a('/saved-retailers',{id:retailers[0].id,saved:true},{'x-csrf-token':'bad'})).status,403);
 assert.equal((await a('/saved-retailers',{id:retailers[0].id,saved:true},{origin:'https://wrong.example'})).status,403);
 assert.equal((await a('/saved-retailers',{id:'https://evil.example',saved:true})).status,400);
 await a('/saved-retailers',{id:retailers[0].id,saved:true});await a('/saved-retailers',{id:retailers[0].id,saved:true});
 assert.deepEqual((await a('/saved-retailers')).data.ids,[retailers[0].id]);assert.deepEqual((await b('/saved-retailers')).data.ids,[]);
 await a('/saved-retailers',{id:retailers[0].id,saved:false});assert.deepEqual((await a('/saved-retailers')).data.ids,[]);
 for(const id of ['mented','pattern','overtone','universal-standard','haute-hijab']){assert.equal((await a('/saved-retailers',{id,saved:true})).status,200);assert((await a('/saved-retailers')).data.ids.includes(id));assert.deepEqual((await b('/saved-retailers')).data.ids,[]);await a('/saved-retailers',{id,saved:false});}
 for(const path of ['/checkout','/cart','/cart/routine','/admin/payout','/admin/refund','/admin/fulfill','/partners/onboard','/admin/partner/approve','/membership/checkout','/membership/portal']){
  const response=await a(path,{});assert.equal(response.status,409,path);assert.equal(response.data.error.code,'external_commerce_only',path);
 }
 assert.equal((await a('/orders')).status,409);assert.equal((await fetch(origin+'/webhooks/stripe',{method:'POST'})).status,409);assert.equal(paymentCalls,0);
 const input={skin_type:'dry',concerns:['hydration'],sensitivity:'none',age_band:'26_35',current_routine:'basic',desired_outcome:'glow',budget_range:'between_25_50',ingredient_avoidances:[],consent:true};
 const result=await a('/profile',input);assert.equal(result.status,200,JSON.stringify(result));assert(result.data.profile.routine.steps.length>0);assert.equal((await b('/profile')).data.profile,null);
 const products=(await a('/catalog')).data.products;await a('/reminders',{product_id:products[0].id,days:30});assert.equal((await a('/reminders')).data.reminders.length,1);assert.equal((await b('/reminders')).data.reminders.length,0);
 await a('/reminders/remove',{product_id:products[0].id});assert.equal((await a('/reminders')).data.reminders.length,0);
 assert.equal((await a('/admin',undefined,{'x-admin-user-id':'superadmin'})).status,401);
 assert.equal((await a('/admin/ai-routing')).status,401);
 await db.tx(async r=>{const user={id:'operator_1',email:'operator@example.test',roles:['superadmin']};await r.put('accounts',user.id,user);for(const session of await r.entries('sessions'))await r.put('sessions',session.id,{...session.value,userId:user.id});await r.put('ai_routing_log','routing_probe',{task_type:'coach_answer',provider:'ollama',model:'llama3.2:3b',latency_ms:123,input_tokens:10,output_tokens:5,cost_cents:0,used_fallback:false,attempts:1,validation_failed:false,failure_reason:null,created_at:new Date().toISOString()});});
 const routing=await a('/admin/ai-routing');assert.equal(routing.status,200);assert.equal(routing.data.requests,1);assert.equal(routing.data.routes[0].provider,'ollama');
 await a('/support',{subject:'Portal question',message:'Test request'});assert.equal((await b('/support')).data.tickets.length,0);
 await assert.rejects(db.tx(async r=>{await r.put('probe','rollback',{value:1});throw Error('rollback');}));assert.equal(await db.tx(r=>r.get('probe','rollback')),undefined);
 console.log('Referral portal checks passed: destination allowlist, saved-list isolation, CSRF/origin, all legacy commerce blocked without payment calls, profiles, reminders, support and rollback.');
 }finally{await new Promise(r=>server.close(r));await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
