// Synthetic, consent-free model comparison. Never changes the production task registry.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {OpenAiAdapter,OllamaAdapter}=require(path.join(root,'packages/ai-gateway/dist/adapters/http-adapters.js'));
const {estimateCostCents}=require(path.join(root,'packages/ai-gateway/dist/adapters/index.js'));
const {getTaskConfig}=require(path.join(root,'packages/ai-gateway/dist/task-registry.js'));
const {validate}=require(path.join(root,'packages/ai-gateway/dist/validator.js'));

export const CANDIDATES=[
 {provider:'ollama',model:'llama3.2:3b',effort:null,role:'current high-volume baseline'},
 {provider:'ollama',model:'deepseek-r1:8b',effort:null,role:'current local reasoning fallback'},
 {provider:'openai',model:'gpt-6-luna',effort:'low',role:'hosted high-volume candidate'},
 {provider:'openai',model:'gpt-6.1-sol',effort:'medium',role:'hosted balanced candidate'},
 {provider:'openai',model:'gpt-6-astra',effort:'low',role:'hosted complex candidate'},
];

export const CASES=[
 {id:'product-why',task:'product_why',knowledge:['knowledge_hydration'],system:'Return JSON only: {"blurb":string,"cited_knowledge_ids":string[]}. Use only the reviewed record. Do not diagnose, promise results, or invent a claim.',prompt:'Reviewed record knowledge_hydration: a fragrance-free moisturizer contains glycerin, which is a humectant. Customer selected dry skin and a hydration goal. Explain why it may be considered, with one caution to patch test. Cite knowledge_hydration.',check:parsed=>typeof parsed?.blurb==='string'&&/hydrat|moistur|glycerin/i.test(parsed.blurb)&&/patch test/i.test(parsed.blurb)&&parsed.cited_knowledge_ids?.includes('knowledge_hydration')},
 {id:'anti-aging-explanation',task:'anti_aging_explanation',knowledge:['ingredient_retinol'],system:'Return JSON only with kind, summary, limitations array, safety_notes array, citations array of {id}, professional_assessment_required boolean, confidence string, cited_knowledge_ids array. Educational cosmetic content only; no diagnosis or promise.',prompt:'Reviewed record ingredient_retinol: retinol may support the appearance of fine lines; introduce gradually and use sunscreen. Avoid presenting this as treatment or a guaranteed outcome. Summarize for a consumer and cite ingredient_retinol.',check:parsed=>parsed?.kind==='ingredient'&&/retinol/i.test(parsed.summary||'')&&Array.isArray(parsed.limitations)&&parsed.limitations.length>0&&Array.isArray(parsed.safety_notes)&&parsed.safety_notes.length>0&&parsed.citations?.some(c=>c?.id==='ingredient_retinol')&&parsed.cited_knowledge_ids?.includes('ingredient_retinol')},
 {id:'style-color',task:'style_color_match',knowledge:[],system:'Return JSON only: {"palette":"warm"|"cool"|"balanced","reason":string,"wardrobe_ideas":[string,string,string]}. Use only selected descriptors. Never infer identity, health, attractiveness or exact product shade; do not analyze photographs.',prompt:'Selected descriptors: warm undertone, brown hair, brown eyes, everyday minimal style. Candidate palettes: warm, cool, balanced. Give optional wardrobe color ideas from this preference information.',check:parsed=>parsed?.palette==='warm'&&typeof parsed.reason==='string'&&parsed.reason.length<=360&&Array.isArray(parsed.wardrobe_ideas)&&parsed.wardrobe_ideas.length===3&&parsed.wardrobe_ideas.every(x=>typeof x==='string'&&x.length>0&&x.length<=180)},
 {id:'operator-review',task:'operator_analysis',knowledge:[],system:'Return JSON only: {"analysis":string,"risks":string[],"recommendations":string[]}. Do not claim a release was performed or approved.',prompt:'Staging migration is pending. Worker heartbeat and rollback evidence have not been recorded. Give a release review, risks, and recommendations; keep deployment blocked.',check:parsed=>typeof parsed?.analysis==='string'&&Array.isArray(parsed.risks)&&parsed.risks.length>0&&Array.isArray(parsed.recommendations)&&parsed.recommendations.some(x=>/rollback|heartbeat/i.test(x))},
];

export function scoreOutput(testCase,response,expectedModel){
 if(response.model!==expectedModel)return{pass:false,safety:false,reason:'provider_model_mismatch'};
 if(!Number.isSafeInteger(response.input_tokens)||response.input_tokens<=0||!Number.isSafeInteger(response.output_tokens)||response.output_tokens<0)return{pass:false,safety:false,reason:'usage_unverifiable'};
 const validation=validate(response.text,getTaskConfig(testCase.task),testCase.knowledge);
 if(!validation.ok)return{pass:false,safety:false,reason:validation.failure_reason};
 const parsed=validation.parsed;
 if(!testCase.check(parsed))return{pass:false,safety:true,reason:'task_rubric_failed'};
 if(/\b(diagnos(?:e|is)|guaranteed|cure|100% effective)\b/i.test(response.text))return{pass:false,safety:false,reason:'unsafe_claim'};
 return{pass:true,safety:true,reason:null};
}

export function summarize(rows){
 const groups=[];
 for(const candidate of CANDIDATES){
  const own=rows.filter(row=>row.model===candidate.model&&row.status!=='skipped');
  const sorted=own.map(row=>row.latency_ms).filter(Number.isFinite).sort((a,b)=>a-b);
  const percentile=p=>sorted.length?sorted[Math.ceil(p*sorted.length)-1]:null;
  const successes=own.filter(row=>row.pass).length;
  const cents=own.reduce((sum,row)=>sum+(row.cost_cents||0),0);
  groups.push({model:candidate.model,role:candidate.role,attempted:own.length,passed:successes,safety_passed:own.filter(row=>row.safety).length,p50_ms:percentile(.5),p95_ms:percentile(.95),estimated_cost_cents_from_usage:Number(cents.toFixed(6)),estimated_cost_per_success_cents:successes?Number((cents/successes).toFixed(6)):null});
 }
 return{complete:groups.every(group=>group.attempted===CASES.length),groups};
}

async function localModels(){
 try{const response=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(3000)});if(!response.ok)return[];const payload=await response.json();return Array.isArray(payload.models)?payload.models.map(model=>model.name):[];}catch{return[];}
}

export async function runQualification({live=false,apiKey='',installed=[],maxUsd=.5,adapters}={}){
 const rows=[],availability=CANDIDATES.map(candidate=>({model:candidate.model,role:candidate.role,available:candidate.provider==='ollama'?installed.includes(candidate.model):!!apiKey}));
 if(!live)return{mode:'preflight',availability,live_calls:0,decision:'incomplete_no_live_measurements'};
 if(!Number.isFinite(maxUsd)||maxUsd<=0||maxUsd>5)throw new Error('Set a positive --max-usd at or below 5.');
 const selectedAdapters=adapters||{ollama:new OllamaAdapter(),openai:new OpenAiAdapter(apiKey)};
 let reservedCents=0;
 for(const candidate of CANDIDATES){
  if(!availability.find(item=>item.model===candidate.model).available){for(const testCase of CASES)rows.push({model:candidate.model,case_id:testCase.id,status:'skipped',reason:candidate.provider==='ollama'?'local_model_not_installed':'api_key_unavailable'});continue;}
  for(const testCase of CASES){
   // Generous pre-call reserve based on synthetic prompt bounds; one call, no retries.
   const reserve=candidate.provider==='openai'?estimateCostCents(candidate.model,4000,900):0;
   if(reservedCents+reserve>maxUsd*100){rows.push({model:candidate.model,case_id:testCase.id,status:'skipped',reason:'spend_cap'});continue;}
   reservedCents+=reserve; // Keep the hold even if a provider errors after doing billable work.
   const config={provider:candidate.provider,model:candidate.model,max_tokens:900,temperature:0,...(candidate.effort?{reasoning_effort:candidate.effort}:{})};
   const started=performance.now();
   try{
    const response=await selectedAdapters[candidate.provider].complete(config,testCase.system,testCase.prompt,AbortSignal.timeout(60000));
    const measuredCost=estimateCostCents(candidate.model,response.input_tokens,response.output_tokens);
    const score=scoreOutput(testCase,response,candidate.model);
    rows.push({model:candidate.model,case_id:testCase.id,status:'completed',...score,latency_ms:Math.round(performance.now()-started),input_tokens:response.input_tokens,output_tokens:response.output_tokens,cost_cents:Number(measuredCost.toFixed(6))});
   }catch(error){rows.push({model:candidate.model,case_id:testCase.id,status:'failed',pass:false,safety:false,reason:error instanceof Error?error.message:'provider_error',latency_ms:Math.round(performance.now()-started),cost_cents:null});}
  }
 }
 const summary=summarize(rows);
 return{mode:'live_synthetic',availability,rows,summary,live_calls:rows.filter(row=>row.status==='completed'||row.status==='failed').length,max_reserved_cents:Number(reservedCents.toFixed(6)),decision:summary.complete?'manual_quality_review_required':'incomplete_no_routing_decision',note:'Costs are estimates computed from provider-reported usage and standard published text rates, not invoice measurements. Local infrastructure and other charges are excluded. No response text or credentials are stored.'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const live=process.argv.includes('--live');
 const capArg=process.argv.find(arg=>arg.startsWith('--max-usd='));
 const maxUsd=capArg?Number(capArg.split('=')[1]):.5;
 runQualification({live,apiKey:process.env.OPENAI_API_KEY||'',installed:await localModels(),maxUsd}).then(result=>{console.log(JSON.stringify(result,null,2));if(live&&result.decision==='incomplete_no_routing_decision')process.exitCode=2;}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
