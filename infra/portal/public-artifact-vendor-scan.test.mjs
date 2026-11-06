import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import test from 'node:test';

const require=createRequire(import.meta.url);
const {scanPublicArtifact}=require('./public-artifact-vendor-scan.cjs');
const reviewed=[
 '<strong>DeepSeek</strong>',
 '<small>Local via Ollama · qualification pending</small>',
 'Stripe setup, tier entitlements, terms and signed event verification remain in preparation.',
 'Stripe is the planned payment gateway.'
].join('\n');

test('allows only the exact reviewed operator-demo vendor disclosures',()=>{
 assert.deepEqual(scanPublicArtifact('dist/index.html',reviewed),{blocked:false,invalidDisclosure:false});
 assert.equal(scanPublicArtifact('dist/other.html',reviewed).blocked,true);
 assert.equal(scanPublicArtifact('dist/index.html',reviewed+'\nOpenAI').blocked,true);
 assert.equal(scanPublicArtifact('dist/index.html',reviewed+'\nStripe is the planned payment gateway.').invalidDisclosure,true);
});

test('reviewed copy cannot conceal secret-shaped or configuration references',()=>{
 assert.equal(scanPublicArtifact('dist/index.html',reviewed+'\nSTRIPE_SECRET_KEY=production-material').blocked,true);
 assert.equal(scanPublicArtifact('dist/index.html',reviewed+'\nollama.internal.example').blocked,true);
});
