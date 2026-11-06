import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CASES,CANDIDATES,runQualification,scoreOutput,summarize} from './ai-model-qualification.mjs';

const outputs={
 'product-why':{blurb:'Glycerin in this moisturizer may support the selected hydration goal; patch test first.',cited_knowledge_ids:['knowledge_hydration']},
 'anti-aging-explanation':{kind:'ingredient',summary:'Retinol may support the appearance of fine lines.',limitations:['Results vary.'],safety_notes:['Introduce gradually and use sunscreen.'],citations:[{id:'ingredient_retinol'}],cited_knowledge_ids:['ingredient_retinol'],professional_assessment_required:false,confidence:'limited'},
 'style-color':{palette:'warm',reason:'Warm undertone and selected preferences suggest a warm palette to compare.',wardrobe_ideas:['Try ivory.','Compare terracotta.','Use olive as an accent.']},
 'operator-review':{analysis:'Staging is not ready.',risks:['No worker heartbeat evidence.'],recommendations:['Record rollback evidence and worker heartbeat before release.']},
};

test('preflight reports missing providers without making model calls',async()=>{
 const result=await runQualification({installed:['nomic-embed-text:latest']});
 assert.equal(result.mode,'preflight');assert.equal(result.live_calls,0);
 assert(result.availability.every(item=>!item.available));
});

test('rubric rejects fabricated citations, unsafe claims, and wrong model identity',()=>{
 const example=CASES[0];
 const response={model:'gpt-6-luna',input_tokens:100,output_tokens:50,text:JSON.stringify(outputs[example.id])};
 assert.equal(scoreOutput(example,response,'gpt-6-luna').pass,true);
 assert.equal(scoreOutput(example,{...response,model:'different'},'gpt-6-luna').reason,'provider_model_mismatch');
 assert.equal(scoreOutput(example,{...response,text:JSON.stringify({...outputs[example.id],cited_knowledge_ids:['invented']})},'gpt-6-luna').pass,false);
 assert.equal(scoreOutput(example,{...response,text:JSON.stringify({...outputs[example.id],blurb:'Guaranteed cure.'})},'gpt-6-luna').pass,false);
});

test('synthetic transport proves equal-case comparison, usage and spend accounting without network',async()=>{
 let calls=0;
 const adapter={complete:async(config,_system,prompt)=>{
  calls++;
  const testCase=CASES.find(item=>item.prompt===prompt);
  return{model:config.model,provider:config.provider,input_tokens:400,output_tokens:120,text:JSON.stringify(outputs[testCase.id])};
 }};
 const result=await runQualification({live:true,apiKey:'fixture-only',installed:['llama3.2:3b','deepseek-r1:8b'],maxUsd:5,adapters:{ollama:adapter,openai:adapter}});
 assert.equal(calls,CANDIDATES.length*CASES.length);
 assert.equal(result.summary.complete,true);
 assert(result.summary.groups.every(group=>group.passed===CASES.length));
 assert.equal(result.summary.groups.find(group=>group.model==='llama3.2:3b').estimated_cost_cents_from_usage,0);
 assert(result.summary.groups.find(group=>group.model==='gpt-6-astra').estimated_cost_cents_from_usage>result.summary.groups.find(group=>group.model==='gpt-6.1-sol').estimated_cost_cents_from_usage);
 assert.equal(result.decision,'manual_quality_review_required');
});

test('incomplete matrix never produces a routing recommendation',()=>{
 const summary=summarize([{model:'gpt-6-luna',case_id:'product-why',status:'completed',pass:true,safety:true,latency_ms:10,cost_cents:.01}]);
 assert.equal(summary.complete,false);
});

test('spend cap blocks hosted calls before transport',async()=>{
 let calls=0;
 const adapter={complete:async()=>{calls++;throw new Error('must not call');}};
 const result=await runQualification({live:true,apiKey:'fixture-only',installed:[],maxUsd:.000001,adapters:{openai:adapter}});
 assert.equal(calls,0);
 assert.equal(result.live_calls,0);
 assert.equal(result.decision,'incomplete_no_routing_decision');
 assert(result.rows.filter(row=>row.model.startsWith('gpt-6')).every(row=>row.reason==='spend_cap'));
});
