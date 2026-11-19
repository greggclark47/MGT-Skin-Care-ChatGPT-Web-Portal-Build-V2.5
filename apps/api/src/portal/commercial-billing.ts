import express from 'express';
import {createHash} from 'node:crypto';
import type Stripe from 'stripe';
import type {Store} from './store';
import {check,role,text,wrap} from './security';

const REFERENCE=/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/;
const CUSTOMER=/^cus_[A-Za-z0-9_]{6,180}$/;
const ACCOUNT=/^[a-z0-9][a-z0-9_-]{2,79}$/;
const EVENT_NAME=/^[a-z][a-z0-9_.-]{2,99}$/;
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();

export function commercialBillingStatus(stripe:Stripe|undefined,env:NodeJS.ProcessEnv){
 const usage_requested=env.STRIPE_USAGE_BILLING_ENABLED==='true';
 const invoicing_requested=env.STRIPE_B2B_INVOICING_ENABLED==='true';
 const usage_configured=usage_requested&&!!stripe&&EVENT_NAME.test(env.STRIPE_API_METER_EVENT_NAME||'');
 const invoicing_configured=invoicing_requested&&!!stripe;
 return{
  usage_requested,usage_configured,invoicing_requested,invoicing_configured,
  checkout:'stripe_hosted',customer_portal:'stripe_hosted',raw_card_data_accepted:false,
  invoice_policy:'draft_only',external_activation_required:true,
 };
}

export function installCommercialBilling(app:express.Express,db:Store,stripe:Stripe|undefined,env:NodeJS.ProcessEnv){
 const status=()=>commercialBillingStatus(stripe,env);
 const operator=(req:any)=>role(req,['superadmin','compliance']);

 app.get('/api/hub/admin/billing/commercial/status',wrap(async(req,res)=>{
  operator(req);res.set('Cache-Control','no-store').json({...status(),meter_event_name:status().usage_configured?env.STRIPE_API_METER_EVENT_NAME:null});
 }));

 app.post('/api/hub/admin/billing/b2b-accounts',wrap(async(req,res)=>{
  const actor=operator(req),state=status();check(state.invoicing_configured,503,'b2b_invoicing_unconfigured','B2B invoicing is awaiting approved Stripe setup.');
  const id=text(req.body?.account_id,80).toLowerCase(),legal_name=text(req.body?.legal_name,160),customer_id=text(req.body?.stripe_customer_id,200),approval_reference=text(req.body?.approval_reference,120);
  check(ACCOUNT.test(id)&&CUSTOMER.test(customer_id)&&REFERENCE.test(approval_reference),400,'b2b_account_invalid','Provide a valid approved business billing record.');
  let saved:any;await db.tx(async r=>{await r.lock('b2b-billing:'+id);const existing=await r.get<any>('b2b_billing_accounts',id);check(!existing||existing.stripe_customer_id===customer_id,409,'b2b_account_conflict','This business account is already linked to another Stripe customer.');saved={id,legal_name,stripe_customer_id:customer_id,approval_reference,status:'approved',updated_at:now(),updated_by:actor.id};await r.put('b2b_billing_accounts',id,saved);});
  res.status(201).set('Cache-Control','no-store').json({account:{id:saved.id,legal_name:saved.legal_name,status:saved.status,updated_at:saved.updated_at}});
 }));

 app.post('/api/hub/admin/billing/usage-events',wrap(async(req,res)=>{
  const actor=operator(req),state=status();check(state.usage_configured,503,'usage_billing_unconfigured','Usage billing is awaiting an approved Stripe meter.');
  const account_id=text(req.body?.account_id,80).toLowerCase(),event_reference=text(req.body?.event_reference,120);const units=Number(req.body?.units);
  check(ACCOUNT.test(account_id)&&REFERENCE.test(event_reference)&&Number.isSafeInteger(units)&&units>=1&&units<=1_000_000,400,'usage_event_invalid','Provide one valid metered usage event.');
  const occurred=typeof req.body?.occurred_at==='string'?Date.parse(req.body.occurred_at):Date.now(),current=Date.now();
  check(Number.isFinite(occurred)&&occurred>=current-35*86400000&&occurred<=current+5*60000,400,'usage_timestamp_invalid','Usage time must be within the supported Stripe meter window.');
  const id='usage_'+digest(account_id+':'+event_reference).slice(0,40);let duplicate=false,record:any;
  await db.tx(async r=>{await r.lock('usage-billing:'+id);const previous=await r.get<any>('usage_billing_events',id),account=await r.get<any>('b2b_billing_accounts',account_id);check(account?.status==='approved'&&CUSTOMER.test(account.stripe_customer_id),409,'b2b_account_unapproved','Approve the business billing account before recording usage.');
   if(previous){check(previous.units===units&&previous.account_id===account_id&&previous.occurred_at===new Date(occurred).toISOString(),409,'usage_event_conflict','This usage reference was already used with different values.');duplicate=true;record=previous;return;}
   const remote=await stripe!.billing.meterEvents.create({event_name:env.STRIPE_API_METER_EVENT_NAME!,identifier:id,payload:{stripe_customer_id:account.stripe_customer_id,value:String(units)},timestamp:Math.floor(occurred/1000)});
   record={id,account_id,event_reference,units,occurred_at:new Date(occurred).toISOString(),stripe_meter_event_id:remote.identifier||id,recorded_at:now(),recorded_by:actor.id};await r.put('usage_billing_events',id,record);
  });
  res.status(duplicate?200:201).set('Cache-Control','no-store').json({recorded:!duplicate,duplicate,event:{id:record.id,account_id:record.account_id,units:record.units,occurred_at:record.occurred_at}});
 }));

 app.post('/api/hub/admin/billing/draft-invoices',wrap(async(req,res)=>{
  const actor=operator(req),state=status();check(state.invoicing_configured,503,'b2b_invoicing_unconfigured','B2B invoicing is awaiting approved Stripe setup.');
  const account_id=text(req.body?.account_id,80).toLowerCase(),invoice_reference=text(req.body?.invoice_reference,120),description=text(req.body?.description,500);const days_until_due=Number(req.body?.days_until_due);
  check(ACCOUNT.test(account_id)&&REFERENCE.test(invoice_reference)&&Number.isSafeInteger(days_until_due)&&days_until_due>=1&&days_until_due<=90,400,'draft_invoice_invalid','Provide a valid business invoice draft.');
  const id='invoice_'+digest(account_id+':'+invoice_reference).slice(0,40);let duplicate=false,record:any;
  await db.tx(async r=>{await r.lock('draft-invoice:'+id);const previous=await r.get<any>('b2b_invoice_drafts',id),account=await r.get<any>('b2b_billing_accounts',account_id);check(account?.status==='approved'&&CUSTOMER.test(account.stripe_customer_id),409,'b2b_account_unapproved','Approve the business billing account before drafting an invoice.');
   if(previous){check(previous.description===description&&previous.days_until_due===days_until_due,409,'draft_invoice_conflict','This invoice reference was already used with different values.');duplicate=true;record=previous;return;}
   const remote=await stripe!.invoices.create({customer:account.stripe_customer_id,auto_advance:false,collection_method:'send_invoice',days_until_due,description,metadata:{team47_account_id:account_id,team47_invoice_reference:invoice_reference,review_state:'draft_only'}},{idempotencyKey:id});
   check(remote.status==='draft',502,'stripe_invoice_state_invalid','Stripe did not return a reviewable draft invoice.');record={id,account_id,invoice_reference,description,days_until_due,stripe_invoice_id:remote.id,status:'draft',created_at:now(),created_by:actor.id};await r.put('b2b_invoice_drafts',id,record);
  });
  res.status(duplicate?200:201).set('Cache-Control','no-store').json({created:!duplicate,duplicate,invoice:{id:record.id,account_id:record.account_id,status:record.status,created_at:record.created_at},notice:'The Stripe invoice remains a draft. This action did not finalize, email, or charge the customer.'});
 }));
}
