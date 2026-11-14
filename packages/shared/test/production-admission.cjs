const assert=require('node:assert/strict');
const {test}=require('node:test');
const {PRODUCTION_ADMISSION_ACTIONS,PRODUCTION_ADMISSION_CONTRACT_VERSION,hasReviewedHealthyProductionAdmission,reviewedProductionAdmissionAction,reviewedProductionAdmissionActions,reviewedProductionAdmissionBlock}=require('../dist');

test('production admission actions are bounded and reviewed',()=>{
 assert.equal(Object.keys(PRODUCTION_ADMISSION_ACTIONS).length,21);
 for(const [id,action] of Object.entries(PRODUCTION_ADMISSION_ACTIONS)){
  assert.deepEqual(reviewedProductionAdmissionAction(id),{id,action});
  assert.equal(/(?:[A-Z][A-Z0-9_]{2,}=|https?:\/\/|@sha256:)/.test(action),false,id);
 }
});

test('unexpected production admission responses are not rendered',()=>{
 const known=reviewedProductionAdmissionAction('database');
 assert.deepEqual(reviewedProductionAdmissionActions([known]),[known]);
 assert.deepEqual(reviewedProductionAdmissionActions([{id:'database',action:'DATABASE_URL=do-not-render-this'},{id:'unknown',action:'unexpected'}]),[]);
 assert.deepEqual(reviewedProductionAdmissionActions('not an array'),[]);
});

test('accepted guidance is deduplicated and follows reviewed catalogue order',()=>{
 const ownership=reviewedProductionAdmissionAction('ownership');
 const database=reviewedProductionAdmissionAction('database');
 assert.deepEqual(reviewedProductionAdmissionActions([database,null,ownership,database]),[ownership,database]);
});

test('a ready production admission has an exact empty issue and action shape',()=>{
 const checks=Object.keys(PRODUCTION_ADMISSION_ACTIONS).map(id=>({id,healthy:true}));
 assert.equal(hasReviewedHealthyProductionAdmission({admission_version:PRODUCTION_ADMISSION_CONTRACT_VERSION,healthy:true,issues:[],next_actions:[],checks}),true);
 for(const value of [
  undefined,
  {admission_version:PRODUCTION_ADMISSION_CONTRACT_VERSION,healthy:false,issues:[],next_actions:[],checks},
  {admission_version:PRODUCTION_ADMISSION_CONTRACT_VERSION,healthy:true,issues:['database'],next_actions:[],checks},
  {admission_version:PRODUCTION_ADMISSION_CONTRACT_VERSION,healthy:true,issues:[],next_actions:[reviewedProductionAdmissionAction('database')],checks},
  {admission_version:PRODUCTION_ADMISSION_CONTRACT_VERSION,healthy:true,issues:[],next_actions:[],checks:checks.slice(1)},
  {healthy:true,issues:[],next_actions:[],checks}
 ]) assert.equal(hasReviewedHealthyProductionAdmission(value),false);
});

test('blocked guidance requires a matching versioned issue envelope',()=>{
 const database=reviewedProductionAdmissionAction('database');
 const checks=Object.keys(PRODUCTION_ADMISSION_ACTIONS).map(id=>({id,healthy:id!=='database'}));
 assert.deepEqual(reviewedProductionAdmissionBlock({admission_version:PRODUCTION_ADMISSION_CONTRACT_VERSION,healthy:false,issues:['database'],checks,next_actions:[database]}),[database]);
 for(const value of [
  {healthy:false,issues:['database'],checks,next_actions:[database]},
  {admission_version:PRODUCTION_ADMISSION_CONTRACT_VERSION,healthy:false,issues:[],checks,next_actions:[database]},
  {admission_version:PRODUCTION_ADMISSION_CONTRACT_VERSION,healthy:false,issues:['ownership'],checks,next_actions:[database]},
  {admission_version:PRODUCTION_ADMISSION_CONTRACT_VERSION,healthy:false,issues:['database'],checks:checks.map(item=>item.id==='database'?{...item,healthy:true}:item),next_actions:[database]},
  {admission_version:PRODUCTION_ADMISSION_CONTRACT_VERSION,healthy:false,issues:['database'],checks,next_actions:[{id:'database',action:'DATABASE_URL=unsafe'}]}
 ]) assert.deepEqual(reviewedProductionAdmissionBlock(value),[]);
});
