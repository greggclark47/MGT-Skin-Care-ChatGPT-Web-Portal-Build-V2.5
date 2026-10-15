const {test}=require('node:test');
const assert=require('node:assert/strict');
const {LocalStore}=require('../dist/portal/store');
const {initializeCatalog,match}=require('../dist/portal/catalog');

const profile={skin_type:'dry',concerns:['anti_aging','hydration'],sensitivity:'moderate',age_band:'36_45',current_routine:'advanced',desired_outcome:'smoother',budget_range:'between_25_50',ingredient_avoidances:[]};

async function fixture(t){
 const db=new LocalStore(':memory:');
 await initializeCatalog(db,true);t.after(async()=>{await db.close();});
 return{run:(input)=>db.tx(records=>match(records,input,true))};
}

test('profile match returns explainable versioned intelligence without AI ranking',async t=>{
 const {run}=await fixture(t);const result=await run(profile);const intelligence=result.match_intelligence;
 assert.equal(intelligence.generated_by,'deterministic_rules');
 assert.equal(intelligence.ai_narrative_status,'not_requested');
 assert.match(intelligence.version,/^1\./);assert.match(intelligence.safety_matrix_version,/^im-\d+-[a-z0-9]+$/);
 assert.ok(intelligence.data_points.some(point=>point.id==='sensitivity'&&point.value==='Moderate'));
 assert.ok(intelligence.data_points.some(point=>point.id==='budget_range'));
 assert.equal(intelligence.coverage.required_slots_total,4);
 assert.ok(intelligence.coverage.excluded_products>=1);
 assert.equal(intelligence.coverage.required_slots_matched,result.routine.steps.filter(step=>['cleanser','treatment','moisturizer','sunscreen'].includes(step.slot)).length);
 assert.equal(intelligence.product_matches.length,result.routine.steps.length);
 assert.ok(intelligence.product_matches.every(item=>Number.isInteger(item.match_score)&&item.match_score>=0&&item.match_score<=100&&item.blurb===null));
 assert.equal(intelligence.retail_discovery.segment,'skincare');
 assert.match(intelligence.retail_discovery.disclosure,/not personal suitability/i);
 assert.ok(intelligence.limitations.some(item=>/Photos are not analyzed/.test(item)));
});

test('simplified routines project explanations and coverage without stale optional matches',async t=>{
 const {run}=await fixture(t);const result=await run(profile);const domain=require('@mgt/domain');
 const simplified=domain.simplify(result.routine);const projected=domain.projectMatchIntelligenceToRoutine(result.match_intelligence,simplified);
 assert.equal(projected.coverage.optional_slots_matched,0);
 assert.equal(projected.product_matches.length,simplified.steps.length);
 assert.deepEqual(projected.retail_discovery.query_terms,[...new Set(simplified.steps.map(step=>step.slot))]);
 assert.ok(projected.product_matches.every(item=>simplified.steps.some(step=>step.product_id===item.product_id)));
});

test('declared avoidances are exposed as datapoints but excluded products never become matches',async t=>{
 const {run}=await fixture(t);const result=await run({...profile,ingredient_avoidances:['retinol']});const intelligence=result.match_intelligence;
 assert.ok(intelligence.data_points.some(point=>point.id==='ingredient_avoidances'&&point.value==='Retinol'));
 assert.ok(intelligence.product_matches.every(item=>!item.ingredients.some(ingredient=>ingredient.name==='Retinol')));
});
