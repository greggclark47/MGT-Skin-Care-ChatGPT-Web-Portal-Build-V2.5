const assert=require('node:assert/strict');
const {test}=require('node:test');
const {PRODUCTION_ADMISSION_ACTIONS,reviewedProductionAdmissionAction,reviewedProductionAdmissionActions}=require('../dist');

test('production admission actions are bounded and reviewed',()=>{
 assert.equal(Object.keys(PRODUCTION_ADMISSION_ACTIONS).length,18);
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
