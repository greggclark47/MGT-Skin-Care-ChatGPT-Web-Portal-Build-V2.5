const assert=require('node:assert/strict');
const Stripe=require('stripe');
const {createPortal}=require('../dist/portal/server');
const {LocalStore}=require('../dist/portal/store');

(async()=>{
 const db=new LocalStore(':memory:'),signer=new Stripe('sk_test_premium');
 const env={NODE_ENV:'test',PUBLIC_ORIGIN:'http://localhost:3000',SUBSCRIPTIONS_ENABLED:'true',SUBSCRIPTION_TERMS_APPROVED:'true',STRIPE_LIVE_MODE:'false',STRIPE_SECRET_KEY:'sk_test_premium',STRIPE_PREMIUM_PRODUCT_ID:'prod_premium',STRIPE_PREMIUM_MONTHLY_PRICE_ID:'price_premium_month',STRIPE_PREMIUM_ANNUAL_PRICE_ID:'price_premium_year',STRIPE_SUBSCRIPTION_WEBHOOK_SECRET:'whsec_premium'};
 let eventSubscription,checkoutCalls=0,previousStatus='open',priceProduct='prod_premium';const created=[];let existing=[];
 const stripe={
  webhooks:signer.webhooks,
  prices:{retrieve:async id=>({id,active:true,currency:'usd',product:priceProduct,unit_amount:id.endsWith('_year')?14999:1499,recurring:{interval:id.endsWith('_year')?'year':'month',interval_count:1}})},
  customers:{create:async()=>({id:'cus_premium'})},
  subscriptions:{list:async()=>({data:existing,has_more:false}),retrieve:async()=>eventSubscription,update:async()=>eventSubscription},
  checkout:{sessions:{expire:async()=>{previousStatus='expired';return{status:'expired'};},create:async payload=>{checkoutCalls++;created.push(payload);return{id:'cs_premium',url:'https://checkout.stripe.com/test'};},retrieve:async()=>({id:'cs_premium',status:previousStatus,subscription:'sub_premium',url:'https://checkout.stripe.com/test'})}},
  billingPortal:{configurations:{create:async()=>({id:'bpc_premium'})},sessions:{create:async()=>({url:'https://billing.stripe.com/test'})}}
 };
 const app=await createPortal({store:db,env,stripe,verifyOtp:async email=>({id:email,email})});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const client=()=>{let cookie='',csrf='';return async(path,body,headers={})=>{const response=await fetch(origin+(path.startsWith('/webhooks/')?path:'/api/hub'+path),{method:body===undefined?'GET':'POST',headers:{cookie,origin:env.PUBLIC_ORIGIN,'content-type':'application/json','x-csrf-token':csrf,...headers},body:body===undefined?undefined:JSON.stringify(body)});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const data=await response.json();if(data.csrf)csrf=data.csrf;return{status:response.status,data};};};
 const webhook=async(id)=>{const payload=JSON.stringify({id,type:'customer.subscription.updated',livemode:false,created:Math.floor(Date.now()/1000),data:{object:{id:'sub_premium'}}});const signature=signer.webhooks.generateTestHeaderString({payload,secret:env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET});return await fetch(origin+'/webhooks/subscriptions',{method:'POST',headers:{'content-type':'application/json','stripe-signature':signature},body:payload});};
 try{
  const account=client();await account('/session');
  assert.equal((await account('/billing/checkout',{plan:'premium',recurring_consent:true})).status,401);
  assert.equal((await fetch(origin+'/api/hub/partners/me')).status,410);
  await account('/auth/verify',{email:'member@example.com',code:'123456'});await account('/session');
  const catalog=(await account('/billing/plans?cycle=annual')).data;
  assert.deepEqual(catalog.plans.map(plan=>plan.id),['premium']);assert.equal(catalog.baseline.id,'free');assert.equal(catalog.plans[0].pricing.amount,14999);assert.equal(catalog.pricing_options.monthly.amount,1499);assert.deepEqual(catalog.pricing_options.annual_savings,{amount:2989,currency:'usd',percent:17});assert.equal(catalog.recommendation.plan_id,'premium');
  assert(catalog.comparison_rows.every(row=>catalog.baseline.comparison[row.id]&&catalog.plans[0].comparison[row.id]));
  assert.equal((await account('/session')).data.subscription_billing_configured,true);
  priceProduct='prod_wrong';const mismatched=(await account('/billing/plans?cycle=monthly')).data;assert.equal(mismatched.plans[0].pricing_status,'needs_review');assert.equal(mismatched.plans[0].enrollment_open,false);priceProduct='prod_premium';
  assert.equal((await account('/billing?audience=vendor')).status,400);
  assert.equal((await account('/billing/checkout',{plan:'premium',recurring_consent:true})).status,503);
  await db.tx(r=>r.put('settings','company',{policies_published:true,legal_name:'MGT Skin Care',support_email:'support@example.com'}));
  assert.equal((await account('/billing/checkout',{plan:'premium',audience:'vendor',recurring_consent:true})).status,400);
  assert.equal((await account('/billing/checkout',{plan:'premium',recurring_consent:true})).status,200);
  assert.equal((await account('/billing/checkout',{plan:'premium',recurring_consent:true})).status,200);assert.equal(checkoutCalls,1);
  assert.equal(created[0].metadata.plan,'premium');assert.equal(created[0].metadata.audience,'consumer');assert.equal(created[0].subscription_data.trial_period_days,14);
  eventSubscription={id:'sub_premium',customer:'cus_premium',metadata:created[0].subscription_data.metadata,items:{data:[{price:{id:'price_premium_month'}}]},status:'active',cancel_at_period_end:false,current_period_end:Math.floor(Date.now()/1000)+3600};
  assert.equal((await webhook('evt_premium')).status,200);
  const billing=(await account('/billing?plan=premium')).data;assert.equal(billing.subscription.plan_id,'premium');assert.equal(billing.subscription.active,true);
  const activity=(await account('/billing/activity')).data;assert.equal(activity.audience,'consumer');assert(activity.events.some(event=>event.id==='evt_premium'&&event.plan_id==='premium'));
  assert.equal((await account('/account/consents')).data.ai_disclosure,null);
  const revoked=(await account('/account/consents',{consent_type:'ai_disclosure',granted:false})).data.ai_disclosure;assert.equal(revoked.granted,false);assert.ok(revoked.revoked_at);
  const exported=(await account('/account/export')).data;assert.equal(exported.subscriptions.length,1);assert.equal(exported.subscriptions[0].audience,'consumer');assert.equal(exported.ai_disclosure.granted,false);
  existing=[{id:'sub_premium',status:'active'}];assert.equal((await account('/billing/checkout',{plan:'premium',recurring_consent:true})).status,409);
 } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
