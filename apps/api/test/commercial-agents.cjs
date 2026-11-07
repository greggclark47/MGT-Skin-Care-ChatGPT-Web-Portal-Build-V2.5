const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createPortal}=require('../dist/portal/server');
const {LocalStore}=require('../dist/portal/store');

test('commercial billing and agent operations remain idempotent and review gated',async()=>{
 const db=new LocalStore(':memory:'),meterCalls=[],invoiceCalls=[],agentCalls=[];
 const stripe={
  billing:{meterEvents:{create:async payload=>{meterCalls.push(payload);return{identifier:payload.identifier};}}},
  invoices:{create:async(payload,options)=>{invoiceCalls.push({payload,options});return{id:'in_draft_1',status:'draft'};}},
 };
 const gateway={configured:true,execute:async request=>{agentCalls.push(request);return{ok:true,text:'Reviewable draft output.',parsed:null,provider:'ollama',model:'qwen3.5:4b',prompt_version:'v1.0.0',latency_ms:1,input_tokens:10,output_tokens:5,cost_cents:0,used_fallback:false,attempts:1,failure_reason:null};}};
 const env={NODE_ENV:'test',PUBLIC_ORIGIN:'http://localhost:3000',SUBSCRIPTIONS_ENABLED:'false',STRIPE_USAGE_BILLING_ENABLED:'true',STRIPE_API_METER_EVENT_NAME:'team47_api_tokens',STRIPE_B2B_INVOICING_ENABLED:'true'};
 const app=await createPortal({store:db,env,stripe,analysisGateway:gateway,verifyOtp:async email=>({id:email,email})});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const client=()=>{let cookie='',csrf='';return async(path,body)=>{const response=await fetch(origin+'/api/hub'+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin:env.PUBLIC_ORIGIN,'content-type':'application/json','x-csrf-token':csrf},body:body===undefined?undefined:JSON.stringify(body)});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const data=await response.json();if(data.csrf)csrf=data.csrf;return{status:response.status,data};};};
 const request=client();
 try{
  await request('/session');await request('/auth/verify',{email:'admin@example.com',code:'123456'});await db.tx(async r=>{const account=await r.get('accounts','admin@example.com');await r.put('accounts','admin@example.com',{...account,roles:['superadmin']});});await request('/session');
  const status=await request('/admin/billing/commercial/status');assert.equal(status.status,200);assert.equal(status.data.raw_card_data_accepted,false);assert.equal(status.data.invoice_policy,'draft_only');
  const account={account_id:'retailer-one',legal_name:'Retailer One LLC',stripe_customer_id:'cus_retailerone123',approval_reference:'approval-2026-001'};
  assert.equal((await request('/admin/billing/b2b-accounts',account)).status,201);
  const occurred_at=new Date().toISOString(),usage={account_id:'retailer-one',event_reference:'usage-event-0001',units:73,occurred_at};
  assert.equal((await request('/admin/billing/usage-events',usage)).status,201);const repeated=await request('/admin/billing/usage-events',usage);assert.equal(repeated.status,200);assert.equal(repeated.data.duplicate,true);assert.equal(meterCalls.length,1);assert.equal(meterCalls[0].payload.value,'73');
  const invoice={account_id:'retailer-one',invoice_reference:'invoice-ref-0001',description:'Reviewed API services draft',days_until_due:30};
  assert.equal((await request('/admin/billing/draft-invoices',invoice)).status,201);const repeatedInvoice=await request('/admin/billing/draft-invoices',invoice);assert.equal(repeatedInvoice.status,200);assert.equal(repeatedInvoice.data.duplicate,true);assert.equal(invoiceCalls.length,1);assert.equal(invoiceCalls[0].payload.auto_advance,false);assert.equal(invoiceCalls[0].payload.collection_method,'send_invoice');
  const catalog=await request('/admin/agents');assert.equal(catalog.status,200);assert.equal(catalog.data.policy.external_side_effects_enabled,false);assert.equal(catalog.data.agents.find(item=>item.id==='gtm_strategy').requested_model,'gpt-4o');
  assert.equal((await request('/admin/agents/runs',{agent_id:'gtm_strategy',brief:'Prepare strategy.'})).status,409);
  assert.equal((await request('/admin/agents/runs',{agent_id:'marketing_promotions',brief:'Draft an onboarding offer.',source_refs:['https://user:secret@example.com/source']})).status,400);
  const created=await request('/admin/agents/runs',{agent_id:'marketing_promotions',brief:'Draft an onboarding offer.',source_refs:['drive:approved-campaign-1']});assert.equal(created.status,201);assert.equal(created.data.run.status,'draft');assert.equal(agentCalls.length,1);assert.equal(agentCalls[0].task_type,'marketing_promotion_draft');
  const id=created.data.run.id;assert.equal((await request('/admin/agents/runs/'+id+'/export')).status,409);assert.equal((await request('/admin/agents/runs/not-an-agent/export')).status,400);
  assert.equal((await request('/admin/agents/runs/'+id+'/review',{decision:'submit'})).data.run.status,'pending_review');const selfApproval=await request('/admin/agents/runs/'+id+'/review',{decision:'approve'});assert.equal(selfApproval.status,409);assert.equal(selfApproval.data.error.code,'agent_independent_review_required');
  const reviewer=client();await reviewer('/session');await reviewer('/auth/verify',{email:'reviewer@example.com',code:'123456'});await db.tx(async r=>{const account=await r.get('accounts','reviewer@example.com');await r.put('accounts','reviewer@example.com',{...account,roles:['compliance']});});await reviewer('/session');const approved=await reviewer('/admin/agents/runs/'+id+'/review',{decision:'approve'});assert.equal(approved.data.run.status,'approved');assert.match(approved.data.notice,/No external action occurred/);
  const exported=await request('/admin/agents/runs/'+id+'/export');assert.equal(exported.status,200);assert.equal(exported.data.artifact.schema_version,'team47studio.agent-review-export.v1');assert.equal(exported.data.artifact.status,'approved');assert.deepEqual(exported.data.artifact.source_refs,['drive:approved-campaign-1']);assert.equal(exported.data.artifact.controls.external_action_performed,false);assert.match(exported.data.notice,/No email, social post, retailer outreach, Drive write/);
  const {integrity,...content}=exported.data.artifact;assert.equal(integrity.algorithm,'sha256');assert.equal(integrity.content_sha256,createHash('sha256').update(JSON.stringify(content),'utf8').digest('hex'));assert.equal(JSON.stringify(exported.data).includes('qwen3.5:4b'),false);assert.equal(JSON.stringify(exported.data).includes('admin@example.com'),false);
  const corruptId='agent_00000000-0000-4000-8000-000000000000';await db.tx(r=>r.put('agent_runs',corruptId,{id:corruptId,agent_id:'marketing_promotions',status:'approved',review_decision:'approve',draft:'Unsafe stored row',source_refs:'not-an-array',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),reviewed_at:new Date().toISOString(),reviewed_by:'reviewer@example.com'}));assert.equal((await request('/admin/agents/runs/'+corruptId+'/export')).status,409);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();}
});
