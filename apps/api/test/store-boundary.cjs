const assert=require('node:assert/strict');
const {test}=require('node:test');
const {serializeRecord}=require('../dist/portal/store');

test('stored records reject non-finite numeric values',()=>{
 assert.equal(serializeRecord({count:3}),'{"count":3}');
 for(const value of [NaN,Infinity,-Infinity])assert.throws(()=>serializeRecord({value}),/Stored record is invalid/);
});

test('stored records reject unsupported JSON values instead of dropping them',()=>{
 for(const value of [undefined,()=>{},Symbol('record'),1n,{missing:undefined},[undefined]]){
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
