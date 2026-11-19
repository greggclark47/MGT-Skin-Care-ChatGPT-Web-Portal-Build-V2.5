const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const {createPortal}=require('../dist/portal/server');
const {LocalStore}=require('../dist/portal/store');
const {SafeCoach}=require('../dist/portal/ai');

const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'assistant-policy-cases.json'),'utf8'));

test('assistant candidate policy cases stay bounded before model and payment routing',async()=>{
 assert.equal(fixture.review_status,'engineering_candidate_sme_review_pending');
 assert.equal(new Set(fixture.cases.map(item=>item.id)).size,fixture.cases.length);
 const db=new LocalStore(':memory:');let modelCalls=0,paymentCalls=0;
 const quote='A moisturizer helps support the skin barrier and retain moisture.';
 const provider={name:'fixture',model:'fixture',call:async(_system,prompt)=>{
  modelCalls++;
  const input=JSON.parse(prompt);
  assert(input.documents.length<=8);
  if(input.question.includes('knowledge changes')){
   await db.tx(async r=>{const article=await r.get('knowledge','moisturizer_approved');await r.put('knowledge','moisturizer_approved',{...article,version:article.version+1});});
   return JSON.stringify({excerpts:[{knowledge_id:'moisturizer_approved',quote}]});
  }
  if(input.question.includes('context changes')){
   await db.tx(async r=>{const saved=(await r.entries('account_profiles'))[0];await r.put('account_profiles',saved.id,{...saved.value,revision:'changed-during-answer'});});
   return JSON.stringify({excerpts:[{knowledge_id:'moisturizer_approved',quote}]});
  }
  if(input.question.includes('bad quote'))return JSON.stringify({excerpts:[{knowledge_id:'moisturizer_approved',quote:'An invented treatment claim that was never reviewed.'}]});
  return JSON.stringify({excerpts:[{knowledge_id:'moisturizer_approved',quote}]});
 }};
 const stripe=new Proxy({}, {get(){paymentCalls++;throw Error('A payment provider must not be called by assistant guidance.');}});
 const app=await createPortal({store:db,coach:new SafeCoach([provider]),stripe,env:{NODE_ENV:'test',DEMO_MODE:'true',PUBLIC_ORIGIN:'http://localhost:3000'}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let cookie='',csrf='';
 async function call(path,body){
  const response=await fetch(origin+'/api/hub'+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin:'http://localhost:3000','content-type':'application/json','x-csrf-token':csrf},body:body===undefined?undefined:JSON.stringify(body)});
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
  const data=await response.json();if(data.csrf)csrf=data.csrf;
  return {status:response.status,data};
 }
 try{
  assert.equal((await call('/session')).status,200);
  for(const item of fixture.cases){
   const result=await call('/assistant',{role:item.role,message:item.message,ai_consent:false});
   assert.equal(result.status,200,item.id+': '+JSON.stringify(result.data));
   assert.equal(result.data.role,item.role,item.id);
   assert.equal(result.data.kind,item.kind,item.id);
   assert.equal(result.data.category,item.category,item.id);
   assert.equal(result.data.next_step?.path??null,item.path,item.id);
   if(item.contains)assert(result.data.text.includes(item.contains),item.id);
   assert.deepEqual(result.data.citations,[],item.id);
   assert.equal(modelCalls,0,item.id+' reached the model');
   assert.equal(paymentCalls,0,item.id+' reached payments');
  }
  const consolidated=await call('/assistant',{role:'customer_care',message:'Can I make it simpler?',history:['How do I simplify my routine?']});
  assert.equal(consolidated.status,200);
  assert.equal(consolidated.data.inquiry_context.turns,2);
  assert.equal(consolidated.data.inquiry_context.repeated,true);
  assert.deepEqual(consolidated.data.inquiry_context.topics,['routine']);
  assert.equal((await call('/assistant',{role:'routine_guidance',message:'What does a moisturizer do?',ai_consent:true})).status,401);
  await db.tx(async r=>{
   const user={id:'assistant-review-user',email:'assistant-review@example.test',roles:[]};
   await r.put('accounts',user.id,user);
   for(const session of await r.entries('sessions'))await r.put('sessions',session.id,{...session.value,userId:user.id});
  });
  const withoutConsent=await call('/assistant',{role:'routine_guidance',message:'What does a moisturizer do?',ai_consent:true});
  assert.equal(withoutConsent.status,403);assert.equal(withoutConsent.data.error.code,'consent_required');
  assert.equal((await call('/account/consents',{consent_type:'ai_disclosure',granted:true})).status,200);
  const accountProfile=(await call('/account/profile',{preferred_name:'Review User',locale:'en-US',timezone:'America/New_York',measurement_system:'us',service_interests:['routine_care'],communication_preferences:{routine_reminders:false,service_announcements:false},accessibility:{reduced_motion:false,high_contrast:false},default_image_storage:'device',expected_revision:null})).data;
  const unavailable=await call('/assistant',{role:'routine_guidance',message:'What does a moisturizer do?',ai_consent:true});
  assert.equal(unavailable.status,200);assert.equal(unavailable.data.category,'reviewed_unavailable');assert.equal(unavailable.data.next_step.path,'/support');assert.equal(modelCalls,0);
  await db.tx(r=>r.put('knowledge','moisturizer_approved',{id:'moisturizer_approved',title:'Moisturizer',body:quote,source_url:'https://example.test/reviewed',status:'approved',approved_by:'fixture-reviewer',version:1}));
  const noMatch=await call('/assistant',{role:'product_referral',message:'What is azelaic acid?',ai_consent:true});
  assert.equal(noMatch.status,200);assert.equal(noMatch.data.kind,'no_match');assert.equal(noMatch.data.next_step.path,'/support');assert.equal(modelCalls,0);
  const reviewed=await call('/assistant',{role:'routine_guidance',message:'What does a moisturizer do?',ai_consent:true});
  assert.equal(reviewed.status,200);assert.equal(reviewed.data.kind,'reviewed_excerpts');assert.equal(reviewed.data.citations[0].text,quote);assert.equal(modelCalls,1);
  assert.equal(reviewed.data.output_trace.profile_revision,accountProfile.revision);assert.match(reviewed.data.output_trace.consent_revision,/^2026-09-29:/);assert.equal(reviewed.data.output_trace.prompt_version,'prompt-v2.1');assert.equal(reviewed.data.output_trace.safety_policy_version,'reviewed-excerpts-v1');assert.equal(reviewed.data.output_trace.profile_context_used,false);assert.equal(reviewed.data.output_trace.stale,false);assert(Date.parse(reviewed.data.output_trace.expires_at)>Date.parse(reviewed.data.output_trace.generated_at));
  const storedTrace=await db.tx(r=>r.get('ai_output_events',reviewed.data.output_trace.trace_id));assert.equal(storedTrace.actor.startsWith('guest_'),true);assert.equal(storedTrace.user_id,'assistant-review-user');assert.deepEqual(storedTrace.citation_revisions,['moisturizer_approved:1']);assert.equal('message' in storedTrace,false);assert.equal('text' in storedTrace,false);
  const rejected=await call('/assistant',{role:'routine_guidance',message:'Give me a moisturizer bad quote',ai_consent:true});
  assert.equal(rejected.status,200);assert.equal(rejected.data.category,'reviewed_unavailable');assert.equal(rejected.data.next_step.path,'/support');assert.equal(modelCalls,2);
  const traceCountBeforeRace=(await db.tx(r=>r.entries('ai_output_events'))).length;
  const changedDuringAnswer=await call('/assistant',{role:'routine_guidance',message:'What happens when moisturizer context changes?',ai_consent:true});
  assert.equal(changedDuringAnswer.status,409);assert.equal(changedDuringAnswer.data.error.code,'guidance_context_changed');assert.equal(modelCalls,3);assert.equal((await db.tx(r=>r.entries('ai_output_events'))).length,traceCountBeforeRace);
  const changedKnowledge=await call('/assistant',{role:'routine_guidance',message:'What happens when moisturizer knowledge changes?',ai_consent:true});
  assert.equal(changedKnowledge.status,409);assert.equal(changedKnowledge.data.error.code,'guidance_context_changed');assert.equal(modelCalls,4);assert.equal((await db.tx(r=>r.entries('ai_output_events'))).length,traceCountBeforeRace);
  assert.equal((await call('/account/consents',{consent_type:'ai_disclosure',granted:false})).status,200);
  const revokedTrace=await db.tx(r=>r.get('ai_output_events',reviewed.data.output_trace.trace_id));assert.equal(revokedTrace.stale,true);assert.deepEqual(revokedTrace.stale_reasons,['consent_revision_changed']);
  assert.equal(paymentCalls,0);
  assert.equal((await call('/support')).data.tickets.length,0);
  assert(!JSON.stringify(rejected.data).includes('invented treatment claim'));
 }finally{await new Promise(resolve=>server.close(resolve));await db.close();}
});
