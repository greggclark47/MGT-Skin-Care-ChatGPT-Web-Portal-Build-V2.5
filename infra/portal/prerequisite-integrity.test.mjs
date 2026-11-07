import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildProductionPrerequisites, productionPrerequisitesChecksum, validateProductionPrerequisites } from './production-prerequisites.mjs';
import { buildProductionPrerequisiteReview, productionPrerequisiteReviewChecksum, validateProductionPrerequisiteReview, verifyProductionPrerequisiteReview, PREREQUISITE_RECORD_IDS } from './production-prerequisite-review.mjs';
import { buildSecretInjectionAdmission, REQUIRED_CONFIG_VARIABLES } from './secret-injection-admission.mjs';
import { SECRET_INJECTION_CONSUMERS, SECRET_INJECTION_VARIABLES, createSecretInjectionContractTemplate } from './secret-injection-contract.mjs';
import { recoveryDrillChecksum } from './recovery-drill-review.mjs';

const now = '2026-10-08T12:00:00.000Z';
function fixture() {
  // Synthetic configuration readiness, never evidence of a deployed service.
  const document = buildProductionPrerequisites({ env: {}, candidateCommit: 'a'.repeat(40) });
  document.generated_at = now;
  document.local.configuration = { status: 'ready_for_live_validation', source: 'process_environment', env_file_status: 'not_supplied', errors: [], error_codes: [], warnings: ['External observations still required'] };
  document.status = 'blocked_on_external_prerequisites';
  document.prerequisites_checksum = productionPrerequisitesChecksum(document);
  return document;
}
function seal(document) { document.prerequisite_review_checksum = productionPrerequisiteReviewChecksum(document); return document; }
function secretContract(environment, candidateCommit) { const namespace = `secret://approved/mgt/${environment}`; const references = Object.fromEntries(SECRET_INJECTION_CONSUMERS.map((consumer) => [consumer, Object.fromEntries(SECRET_INJECTION_VARIABLES[consumer].map((name) => [name, null]))])); for (const [consumer, names] of Object.entries({ edge: ['MGT_EDGE_TOKEN'], api: ['DATABASE_URL', 'MGT_EDGE_TOKEN', 'SUPABASE_ANON_KEY'], worker: ['DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPERATIONS_ALERT_WEBHOOK_TOKEN'] })) for (const name of names) references[consumer][name] = `${namespace}/${name.toLowerCase().replaceAll('_', '-')}`; references.api.MGT_EDGE_TOKEN = references.edge.MGT_EDGE_TOKEN; references.worker.DATABASE_URL = references.api.DATABASE_URL; return createSecretInjectionContractTemplate({ environment, candidateCommit, providerReference: 'secret-manager://approved/mgt', namespaceReference: namespace, workloadIdentities: { edge: `workload://mgt/${environment}/edge`, api: `workload://mgt/${environment}/api`, worker: `workload://mgt/${environment}/worker` }, secretReferences: references }); }
function secretAdmission(candidateCommit) { const config = (consumer) => { if (consumer === 'edge') return { PORTAL_DOMAIN: 'portal.mgt-skin-care.test' }; const values = Object.fromEntries(REQUIRED_CONFIG_VARIABLES[consumer].map((name) => [name, 'configured'])); values.NODE_ENV = 'production'; values.DEMO_MODE = 'false'; values.PORTAL_AUTO_MIGRATE = 'false'; if (consumer === 'api') { values.OLLAMA_ENABLED = 'false'; values.OPENCLAW_ENABLED = 'false'; values.OLLAMA_CLOUD_ENABLED = 'false'; values.HOSTED_OPENAI_ENABLED = 'false'; values.BACKUP_ATTESTATION_ENABLED = 'false'; values.SUBSCRIPTIONS_ENABLED = 'false'; values.MGT_OMNI_RETAIL_ENABLED = 'false'; values.MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED = 'false'; values.MGT_SPONSORED_CONTENT_ENABLED = 'false'; values.MGT_SPONSORED_CONTENT_REVIEWED = 'false'; } if (consumer === 'worker') values.NOTIFICATION_DELIVERY = 'in_app'; return values; }; const api = config('api'), worker = config('worker'); return buildSecretInjectionAdmission({ environment: 'production', composeProjectName: 'mgt-skin-care-production', candidateCommit, stagingContract: secretContract('staging', candidateCommit), productionContract: secretContract('production', candidateCommit), inventories: { edge: { config_values: config('edge'), config_keys: ['PORTAL_DOMAIN'], secret_keys: ['MGT_EDGE_TOKEN'] }, api: { config_values: api, config_keys: Object.keys(api), secret_keys: ['DATABASE_URL', 'MGT_EDGE_TOKEN', 'SUPABASE_ANON_KEY'] }, worker: { config_values: worker, config_keys: Object.keys(worker), secret_keys: ['DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPERATIONS_ALERT_WEBHOOK_TOKEN'] } }, privateFilesDistinct: true, fileSecurity: 'verified', generatedAt: '2026-10-01T00:00:00.000Z' }); }

const mutations = [];
for (let index = 0; index < 10; index++) {
  for (const field of ['id', 'requirement', 'status']) {
    for (const variant of ['replace', 'null', 'delete']) {
      mutations.push({ name: `external[${index}].${field}: ${variant}`, change(document) {
        if (variant === 'delete') delete document.external[index][field];
        else document.external[index][field] = variant === 'null' ? null : 'altered';
      } });
    }
  }
}
mutations.push(
  { name: 'configuration status', change: d => { d.local.configuration.status = 'blocked'; } },
  { name: 'configuration errors added', change: d => { d.local.configuration.errors.push('Observed failure'); } },
  { name: 'configuration errors removed', change: d => { delete d.local.configuration.errors; } },
  { name: 'configuration error codes changed', change: d => { d.local.configuration.error_codes = ['PRODUCTION_FIELD_INVALID']; } },
  { name: 'configuration warning changed', change: d => { d.local.configuration.warnings[0] = 'Changed warning'; } },
  { name: 'configuration warnings removed', change: d => { delete d.local.configuration.warnings; } },
  { name: 'configuration removed', change: d => { delete d.local.configuration; } },
  { name: 'build assertion changed', change: d => { d.local.backend_build = 'verified_by_ci_build'; } },
  { name: 'test assertion changed', change: d => { d.local.portal_tests = 'verified_by_local_suite'; } },
  { name: 'nested owner added', change: d => { d.local.configuration.owner = 'Unrecorded replacement'; } },
  { name: 'external records reordered', change: d => { d.external.reverse(); } }
);
assert.equal(mutations.length, 101);
for (const { name, change } of mutations) {
  test(`prerequisite integrity detects ${name}`, () => {
    const original = fixture();
    const review = buildProductionPrerequisiteReview({ prerequisites: original, now });
    const changed = structuredClone(original);
    change(changed);
    assert.notEqual(productionPrerequisitesChecksum(changed), original.prerequisites_checksum);
    assert.equal(validateProductionPrerequisites(changed).ok, false);
    assert.equal(buildProductionPrerequisiteReview({ prerequisites: changed, now }).status, 'blocked');
    assert.equal(validateProductionPrerequisiteReview(review, { prerequisites: changed, now }).ok, false);
  });
}

test('configuration inspection makes no build or test execution claim', () => {
  const document = buildProductionPrerequisites({ env: {} });
  assert.equal(document.local.backend_build, 'not_evaluated');
  assert.equal(document.local.portal_tests, 'not_evaluated');
});

test('canonical prerequisites survive JSON round trip and object key reordering', () => {
  function reorder(value) {
    if (Array.isArray(value)) return value.map(reorder);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).reverse().map(key => [key, reorder(value[key])]));
    return value;
  }
  const original = fixture();
  const changed = reorder(JSON.parse(JSON.stringify(original)));
  assert.equal(productionPrerequisitesChecksum(changed), original.prerequisites_checksum);
  assert.equal(validateProductionPrerequisites(changed).ok, true);
});

test('legacy shallow digest must be regenerated', () => {
  const original = fixture();
  const { prerequisites_checksum, ...unsigned } = original;
  original.prerequisites_checksum = 'sha256:' + createHash('sha256').update(JSON.stringify(unsigned, Object.keys(unsigned).sort())).digest('hex');
  assert.notEqual(original.prerequisites_checksum, prerequisites_checksum);
  assert.equal(validateProductionPrerequisites(original).ok, false);
});

test('recomputed digest cannot hide missing requirements or configuration errors', () => {
  for (const change of [d => d.external.pop(), d => { d.external[0].status = 'pass'; }, d => d.local.configuration.errors.push('Still blocked')]) {
    const document = fixture();
    change(document);
    document.prerequisites_checksum = productionPrerequisitesChecksum(document);
    assert.equal(validateProductionPrerequisites(document).ok, false);
  }
});

test('complete review verifies; incomplete or forged ready review fails even with a recomputed digest', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mgt-integrity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'work'));
  const prerequisites = fixture();
  const admission = secretAdmission(prerequisites.candidate_commit);
  fs.mkdirSync(path.join(root, 'work', 'recovery'), { recursive: true });
  const recoveryEvidence = ['restore_transcript', 'rollback_plan', 'failed_restore_procedure'].map(id => { const reference = `work/recovery/${id}.md`; const content = `Synthetic ${id} evidence\n`; fs.writeFileSync(path.join(root, reference), content); return { id, reference, checksum: `sha256:${createHash('sha256').update(content).digest('hex')}`, bytes: Buffer.byteLength(content), owner: 'Gregg Clark of MGT', reviewed_at: now, status: 'pass' }; });
  const recovery = { version: '1.0', candidate_commit: prerequisites.candidate_commit, generated_at: now, status: 'ready_for_recovery_review', target_seconds: { rto: 120, rpo: 300 }, measured_seconds: { rto: 90, rpo: 60 }, restored_migration_version: '0010_ingredient_rule_seed_alignment', evidence: recoveryEvidence, decision: { decider: 'Gregg Clark of MGT', decision: 'accepted', decided_at: now }, errors: [] };
  recovery.recovery_drill_checksum = recoveryDrillChecksum(recovery);
  const records = Object.fromEntries(PREREQUISITE_RECORD_IDS.map(id => {
    const policyApproval = { version: '1.0', candidate_commit: prerequisites.candidate_commit, status: 'approved', approved_at: now, approval_reference: 'governance://mgt/policy-publication/test', policy_urls: { privacy_notice: 'https://policies.mgt-skin-care.test/privacy', terms_of_use: 'https://policies.mgt-skin-care.test/terms', ai_disclosure: 'https://policies.mgt-skin-care.test/ai-disclosure' } };
    const structured = id === 'secret_manager' || id === 'backup_restore' || id === 'policy_publication_approval';
    const reference = `work/${id}${structured ? '.json' : '.md'}`;
    fs.writeFileSync(path.join(root, reference), id === 'secret_manager' ? `${JSON.stringify(admission, null, 2)}\n` : id === 'backup_restore' ? `${JSON.stringify(recovery, null, 2)}\n` : id === 'policy_publication_approval' ? `${JSON.stringify(policyApproval, null, 2)}\n` : `Synthetic ${id} evidence\n`);
    return [id, { reference, owner: 'Gregg Clark of MGT', reviewed_at: now, status: 'pass', ...(id === 'secret_manager' ? { contract_checksums: admission.contract_checksums } : {}) }];
  }));
  const complete = buildProductionPrerequisiteReview({ root, prerequisites, records, now });
  assert.equal(validateProductionPrerequisiteReview(complete, { prerequisites, now }).ok, true);
  assert.equal(verifyProductionPrerequisiteReview({ root, document: complete, now }).verified.length, PREREQUISITE_RECORD_IDS.length);
  const invalid = [
    d => { d.entries = []; },
    d => { d.entries.pop(); },
    d => { d.entries.push(d.entries[0]); },
    d => { d.entries[0].id = 'unknown'; },
    d => { d.entries[0].owner = ''; },
    d => { d.entries[0].status = 'pending'; },
    d => { d.entries[0].reviewed_at = '2999-01-01T00:00:00.000Z'; },
    d => { d.errors.push('unresolved'); },
    d => { d.entries[0].bytes = -1; },
    d => { d.entries[0].checksum = 'bad'; },
  ];
  for (const change of invalid) {
    const changed = structuredClone(complete);
    change(changed); seal(changed);
    assert.equal(validateProductionPrerequisiteReview(changed, { prerequisites, now }).ok, false);
    const verification = verifyProductionPrerequisiteReview({ root, document: changed, now });
    assert.equal(verification.ok, false);
    assert.deepEqual(verification.verified, []);
  }
  const stale = structuredClone(complete);
  stale.entries[0].owner = 'Another owner';
  assert.equal(verifyProductionPrerequisiteReview({ root, document: stale, now }).ok, false);
});

test('missing or pending standalone reviews never report successful verification', () => {
  for (const document of [undefined, null, {}, [], { entries: [] }, buildProductionPrerequisiteReview({ prerequisites: fixture(), now })]) {
    assert.equal(verifyProductionPrerequisiteReview({ document, now }).ok, false);
  }
});
