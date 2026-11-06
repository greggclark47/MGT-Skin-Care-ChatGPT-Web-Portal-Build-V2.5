import express from 'express';
import {randomUUID} from 'node:crypto';
import type {AiGateway,TaskType} from '@mgt/ai-gateway';
import type {Store} from './store';
import {check,role,text,wrap} from './security';

const AGENTS={
 customer_care:{name:'Account Setup & Customer Care',requested_model:'qwen3.5:4b',task:'support_draft' as TaskType,channel:'portal',external_action:'none'},
 gtm_strategy:{name:'Go-to-Market Strategy',requested_model:'gpt-4o',task:null,channel:'internal_brief',external_action:'none',blocked_reason:'requested_model_deprecated'},
 social_engagement:{name:'Social Engagement',requested_model:'deepseek-r1:8b',task:'social_engagement_draft' as TaskType,channel:'social_draft',external_action:'publish_requires_separate_integration'},
 marketing_promotions:{name:'Marketing Promotions',requested_model:'qwen3.5:4b',task:'marketing_promotion_draft' as TaskType,channel:'email_draft',external_action:'gmail_send_requires_separate_approval'},
 retailer_partnerships:{name:'Retailer Partnerships',requested_model:'deepseek-r1:8b',task:'retailer_outreach_draft' as TaskType,channel:'lead_review',external_action:'outreach_requires_separate_approval'},
} as const;
type AgentId=keyof typeof AGENTS;
const isAgent=(value:unknown):value is AgentId=>typeof value==='string'&&value in AGENTS;
const publicAgent=(id:AgentId)=>({id,...AGENTS[id],mode:'draft_only',human_review_required:true,automatic_publish:false,automatic_send:false,automatic_scraping:false});
const publicRun=(run:any)=>({id:run.id,agent_id:run.agent_id,status:run.status,draft:run.draft,source_refs:run.source_refs,created_at:run.created_at,updated_at:run.updated_at,reviewed_at:run.reviewed_at||null,review_decision:run.review_decision||null});

const systems:Record<Exclude<AgentId,'gtm_strategy'>,string>={
 customer_care:'Draft concise customer-care guidance for Team 47 Studio. Never claim to reset credentials, inspect payments, change an account, or contact support. Return text only and direct the user to the relevant secure portal area.',
 social_engagement:'Draft one factual Team 47 Studio social post for human review. Do not publish, use medical claims, invent product partnerships, mention private data, or claim real-time trend monitoring. Return text only.',
 marketing_promotions:'Draft a consent-respecting Team 47 Studio promotional email for human review. Do not send, invent discounts, use sensitive profile traits, or imply guaranteed cosmetic results. Return text only.',
 retailer_partnerships:'Draft a retailer partnership outreach note from operator-supplied facts for human review. Do not scrape, enrich, contact, or claim an existing partnership. Return text only.',
};

export function installAgentOperations(app:express.Express,db:Store,gateway:AiGateway){
 const operator=(req:any)=>role(req,['superadmin','compliance']);
 app.get('/api/hub/admin/agents',wrap(async(req,res)=>{operator(req);res.set('Cache-Control','no-store').json({agents:(Object.keys(AGENTS) as AgentId[]).map(publicAgent),policy:{draft_only:true,human_review_required:true,external_side_effects_enabled:false,lead_scraping_enabled:false},model_notice:'GPT-4o remains recorded exactly as requested for the GTM agent, but execution is blocked because that model is deprecated. An explicitly approved replacement is required.'});}));
 app.get('/api/hub/admin/agents/runs',wrap(async(req,res)=>{operator(req);const runs=await db.tx(r=>r.list<any>('agent_runs'));res.set('Cache-Control','no-store').json({runs:runs.map(publicRun).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,100)});}));
 app.post('/api/hub/admin/agents/runs',wrap(async(req,res)=>{
  const actor=operator(req);check(isAgent(req.body?.agent_id),400,'agent_invalid','Choose a supported agent.');const agent_id=req.body.agent_id as AgentId,agent=AGENTS[agent_id];
  check(agent.task!==null,409,'agent_model_blocked','The requested GTM model is deprecated. Approve a supported replacement before activating this agent.');
  const brief=text(req.body?.brief,6000);const source_refs=Array.isArray(req.body?.source_refs)?req.body.source_refs:[];check(source_refs.length<=20&&source_refs.every((item:unknown)=>typeof item==='string'&&item.length>=3&&item.length<=500&&!/[\u0000\u007f]/.test(item)),400,'source_refs_invalid','Use up to 20 bounded source references.');
  const result=await gateway.execute({task_type:agent.task,user_id:actor.id,system_prompt:systems[agent_id as Exclude<AgentId,'gtm_strategy'>],user_prompt:brief,has_operator_authorization:true,metadata:{agent_id,mode:'draft_only'}});
  check(result.ok&&typeof result.text==='string'&&result.text.trim().length>0&&Buffer.byteLength(result.text,'utf8')<=12000,503,'agent_draft_unavailable','The agent could not produce a reviewable draft.');
  const timestamp=new Date().toISOString(),run={id:'agent_'+randomUUID(),agent_id,status:'draft',draft:result.text.trim(),source_refs,created_at:timestamp,updated_at:timestamp,created_by:actor.id,provider:result.provider,model:result.model};await db.tx(r=>r.put('agent_runs',run.id,run));
  res.status(201).set('Cache-Control','no-store').json({run:publicRun(run),notice:'Draft created for human review. Nothing was published, emailed, sent to a retailer, or written to an external lead system.'});
 }));
 app.post('/api/hub/admin/agents/runs/:id/review',wrap(async(req,res)=>{
  const actor=operator(req),decision=req.body?.decision;check(decision==='submit'||decision==='approve'||decision==='reject',400,'review_decision_invalid','Choose submit, approve, or reject.');
  let saved:any;await db.tx(async r=>{await r.lock('agent-run:'+req.params.id);const run=await r.get<any>('agent_runs',req.params.id);check(run,404,'agent_run_missing','No such agent draft.');const allowed=decision==='submit'?run.status==='draft':run.status==='pending_review';check(allowed,409,'agent_review_conflict','Refresh this draft before reviewing it.');const timestamp=new Date().toISOString();saved={...run,status:decision==='submit'?'pending_review':decision==='approve'?'approved':'rejected',review_decision:decision,reviewed_at:decision==='submit'?null:timestamp,reviewed_by:decision==='submit'?null:actor.id,updated_at:timestamp};await r.put('agent_runs',run.id,saved);});
  res.set('Cache-Control','no-store').json({run:publicRun(saved),notice:saved.status==='approved'?'Approved for a later, separately authorized export or delivery step. No external action occurred.':'Review state updated. No external action occurred.'});
 }));
}
