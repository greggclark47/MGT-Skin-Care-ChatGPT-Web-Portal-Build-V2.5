const assert=require('node:assert/strict');
const {test}=require('node:test');
const {serializeRecord}=require('../dist/portal/store');

test('stored records reject non-finite numeric values',()=>{
 assert.equal(serializeRecord({count:3}),'{"count":3}');
 for(const value of [NaN,Infinity,-Infinity])assert.throws(()=>serializeRecord({value}),/Stored record is invalid/);
});
