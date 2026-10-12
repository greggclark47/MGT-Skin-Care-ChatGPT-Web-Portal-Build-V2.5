const assert=require('node:assert/strict');
const {test}=require('node:test');
const {serializeRecord,deserializeRecord,validateRecordAddress,portalTransactionBegin,rollbackPgTransaction,destroyPgClientAfterCommitFailure}=require('../dist/portal/store');

test('stored records reject non-finite numeric values',()=>{
 assert.equal(serializeRecord({count:3}),'{"count":3}');
 for(const value of [NaN,Infinity,-Infinity])assert.throws(()=>serializeRecord({value}),/Stored record is invalid/);
});

test('stored records reject unsupported JSON values instead of dropping them',()=>{
 assert.equal(serializeRecord({kept:true,missing:undefined}),'{"kept":true}');
 for(const value of [undefined,()=>{},Symbol('record'),1n,[undefined]]){
  assert.throws(()=>serializeRecord(value),/Stored record is invalid/);
 }
});

test('stored records reject cyclic references with a bounded error',()=>{
 const value={name:'safe'};value.self=value;
 assert.throws(()=>serializeRecord(value),/^Error: Stored record is invalid\.$/);
});

test('stored records enforce the 256 KiB encoded boundary',()=>{
 assert.doesNotThrow(()=>serializeRecord('x'.repeat(262142)));
 assert.throws(()=>serializeRecord('x'.repeat(262143)),/Stored record is invalid/);
});

test('stored records enforce a 32-level nesting boundary',()=>{
 const nested=levels=>{const root={};let cursor=root;for(let i=0;i<levels;i+=1)cursor=cursor.child={};return root;};
 assert.doesNotThrow(()=>serializeRecord(nested(32)));
 assert.throws(()=>serializeRecord(nested(33)),/Stored record is invalid/);
});

test('stored records enforce a 1000-entry container boundary',()=>{
 assert.doesNotThrow(()=>serializeRecord(Array.from({length:1000},(_,index)=>index)));
 assert.throws(()=>serializeRecord(Array.from({length:1001},(_,index)=>index)),/Stored record is invalid/);
});

test('stored record addresses have bounded canonical scope and id forms',()=>{
 assert.doesNotThrow(()=>validateRecordAddress('profile_revisions','guest:abc-123'));
 for(const args of [['Bad-Scope','id'],['scope',''],['scope','x\n'],['scope','x'.repeat(513)]])assert.throws(()=>validateRecordAddress(...args),/Stored record address is invalid/);
});

test('stored record reads reject corrupt and oversized encoded bodies',()=>{
 assert.deepEqual(deserializeRecord('{"ok":true}'),{ok:true});
 for(const value of ['{"broken":',123,'"'+('x'.repeat(262143))+'"'])assert.throws(()=>deserializeRecord(value),/Stored record is invalid/);
});

test('PostgreSQL transactions declare the supported isolation level',()=>{
 assert.equal(portalTransactionBegin,'BEGIN ISOLATION LEVEL READ COMMITTED');
});

test('rollback failure destroys the client without masking the original error',async()=>{
 const original=new Error('business failure'),rollback=new Error('rollback failure'),released=[];
 const client={query:async()=>{throw rollback;},release:error=>released.push(error)};
 await assert.rejects(rollbackPgTransaction(client,original),error=>error===original);
 assert.deepEqual(released,[rollback]);
});

test('an uncertain commit destroys its pooled client',()=>{
 const original=new Error('commit transport failure'),released=[];
 assert.throws(()=>destroyPgClientAfterCommitFailure({query:async()=>{},release:error=>released.push(error)},original),error=>error===original);
 assert.deepEqual(released,[original]);
});
