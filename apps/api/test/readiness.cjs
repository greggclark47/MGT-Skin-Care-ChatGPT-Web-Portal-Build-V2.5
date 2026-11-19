const assert=require('node:assert/strict');
const {createPortal}=require('../dist/portal/server');
const {LocalStore}=require('../dist/portal/store');

(async()=>{
 const store=new LocalStore(':memory:');
 store.kind='postgres';
 for(const origin of ['https://portal.example/path','https://portal.example?token=hidden','https://operator@portal.example','https://other.example']){
  await assert.rejects(createPortal({store,env:{NODE_ENV:'production',DEMO_MODE:'false',PUBLIC_ORIGIN:origin,PORTAL_DOMAIN:'portal.example',OLLAMA_ENABLED:'false',RELEASE_OWNER_NAME:'Gregg Clark of MGT',SUPPORT_OWNER_NAME:'Gregg Clark of MGT',WORKER_INTERVAL_SECONDS:'60',WORKER_READINESS_MAX_AGE_SECONDS:'300'}}),error=>error.message==='Production portal boundary is invalid.');
 }
 const app=await createPortal({store,env:{NODE_ENV:'production',DEMO_MODE:'false',PUBLIC_ORIGIN:'https://portal.example',PORTAL_DOMAIN:'portal.example',WORKER_READINESS_MAX_AGE_SECONDS:'300',OLLAMA_ENABLED:'false',RELEASE_OWNER_NAME:'Gregg Clark of MGT',SUPPORT_OWNER_NAME:'Gregg Clark of MGT',WORKER_INTERVAL_SECONDS:'60'}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 try{
  const sessionResponse=await fetch(url+'/api/hub/session'),sessionBody=await sessionResponse.json(),sessionCookie=sessionResponse.headers.get('set-cookie').split(';')[0];
  let response=await fetch(url+'/readyz');assert.equal(response.status,503);let body=await response.json();
  assert.deepEqual(body.operations.issues,['operations_worker_stale','backup_unhealthy','catalog_unready']);
  assert.deepEqual(Object.keys(body.operations).sort(),['healthy','issues']);
  assert.equal('storage' in body,false);
  assert.equal(JSON.stringify(body).includes('location_identifier'),false);
  assert.equal(JSON.stringify(body).includes('last_run'),false);
  assert.equal((await fetch(url+'/healthz')).status,200);
  const current=Date.now();
  await store.tx(async records=>{
   await records.put('operations','backup_health',{status:'healthy',last_success_at:new Date(current-60000).toISOString(),restore_verified_at:new Date(current-120000).toISOString(),max_age_hours:26,restore_max_age_days:90});
   await records.put('operation_runs','latest',{completed_at:new Date(current-30000).toISOString()});
  });
  response=await fetch(url+'/readyz');assert.equal(response.status,503);body=await response.json();assert.deepEqual(body.operations.issues,['catalog_unready']);
  await store.tx(async records=>{
   await records.put('rules','reviewed_base',{ingredient_key:'reviewed_base',status:'approved',sme_approved_by:'sme_reviewer',sample:false});
   for(const slot of ['cleanser','treatment','moisturizer','sunscreen'])await records.put('products','production_'+slot,{id:'production_'+slot,slot,status:'active',stock:10,approved:true,sample:false,ingredients:['reviewed_base']});
  });
  response=await fetch(url+'/readyz');assert.equal(response.status,200);body=await response.json();
  assert.equal(body.operations.healthy,true);
  assert.deepEqual(body.operations,{healthy:true,issues:[]});
  response=await fetch(url+'/api/hub/catalog');assert.equal(response.status,200);body=await response.json();assert.equal(body.products.length,4);assert.deepEqual(Object.keys(body.products[0]).sort(),['description','id','name','slot']);assert.equal(JSON.stringify(body).includes('reviewed_base'),false);assert.equal(JSON.stringify(body).includes('merchant_id'),false);assert.equal(JSON.stringify(body).includes('approved'),false);
  const adminReadiness=await fetch(url+'/api/hub/admin/readiness');
  assert.notEqual(adminReadiness.status,200);
  await store.tx(async records=>{const sunscreen=await records.get('products','production_sunscreen');await records.put('products','production_sunscreen',{...sunscreen,stock:0});});
  response=await fetch(url+'/readyz');assert.equal(response.status,503);body=await response.json();assert.deepEqual(body.operations.issues,['catalog_unready']);assert.equal(JSON.stringify(body).includes('production_sunscreen'),false);assert.equal(JSON.stringify(body).includes('reviewed_base'),false);
  response=await fetch(url+'/api/hub/catalog');assert.equal(response.status,503);body=await response.json();assert.equal(body.error.code,'catalog_review_pending');assert.equal(JSON.stringify(body).includes('production_sunscreen'),false);assert.equal(JSON.stringify(body).includes('reviewed_base'),false);
  response=await fetch(url+'/api/hub/profile',{method:'POST',headers:{cookie:sessionCookie,origin:'https://portal.example','content-type':'application/json','x-csrf-token':sessionBody.csrf},body:JSON.stringify({skin_type:'dry',concerns:['hydration'],sensitivity:'none',age_band:'26_35',current_routine:'basic',desired_outcome:'glow',budget_range:'between_25_50',ingredient_avoidances:[],consent:true})});assert.equal(response.status,503);body=await response.json();assert.equal(body.error.code,'catalog_review_pending');
  await store.tx(async records=>{const sunscreen=await records.get('products','production_sunscreen');await records.put('products','production_sunscreen',{...sunscreen,stock:10});});
  await store.tx(async records=>{const rule=await records.get('rules','reviewed_base');await records.put('rules','reviewed_base',{...rule,sme_approved_by:null});});
  response=await fetch(url+'/readyz');assert.equal(response.status,503);body=await response.json();assert.deepEqual(body.operations.issues,['catalog_unready']);assert.equal(JSON.stringify(body).includes('reviewed_base'),false);
  await store.tx(async records=>{const rule=await records.get('rules','reviewed_base');await records.put('rules','reviewed_base',{...rule,sme_approved_by:'sme_reviewer'});});
  response=await fetch(url+'/readyz');assert.equal(response.status,200);
  await store.tx(records=>records.put('operation_runs','latest',{completed_at:new Date(current-600000).toISOString()}));
  response=await fetch(url+'/readyz');assert.equal(response.status,503);
  assert((await response.json()).operations.issues.includes('operations_worker_stale'));
  console.log('Production liveness and operational readiness checks passed.');
 }finally{await new Promise(resolve=>server.close(resolve));await store.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
