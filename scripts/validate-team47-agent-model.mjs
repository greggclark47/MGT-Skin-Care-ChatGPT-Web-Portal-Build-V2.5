import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const file = resolve(process.argv[2] || 'config/agents/team47studio-agent-operating-model.v1.json');
const model = JSON.parse(await readFile(file, 'utf8'));
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };

requireValue(model.schema_version === 'team47studio.agent-operating-model.v1', 'Unexpected schema version.');
requireValue(model.status === 'draft_not_production', 'Model must remain draft_not_production.');
requireValue(model.production_activation === false, 'Production activation must be false.');
requireValue(model.architecture?.openclaw_enabled === false, 'OpenClaw must remain disabled in this draft.');
requireValue(model.architecture?.external_side_effects_enabled === false, 'External side effects must remain disabled.');
requireValue(model.global_controls?.fail_closed === true, 'Fail-closed control is required.');
requireValue(model.global_controls?.automatic_send === false, 'Automatic sending is prohibited.');
requireValue(model.global_controls?.automatic_publish === false, 'Automatic publishing is prohibited.');
requireValue(model.global_controls?.automatic_account_mutation === false, 'Automatic account mutation is prohibited.');
requireValue(model.global_controls?.automatic_payment_action === false, 'Automatic payment action is prohibited.');
requireValue(Array.isArray(model.agents) && model.agents.length >= 8, 'At least eight bounded agents are required.');

const ids = new Set();
for (const agent of model.agents || []) {
  requireValue(typeof agent.id === 'string' && agent.id.length > 2, 'Every agent needs an id.');
  requireValue(!ids.has(agent.id), `Duplicate agent id: ${agent.id}`);
  ids.add(agent.id);
  requireValue(Boolean(model.model_routes?.[agent.model_route]), `${agent.id} uses an unknown model route.`);
  requireValue(Array.isArray(agent.prohibited_actions) && agent.prohibited_actions.length > 0, `${agent.id} needs prohibited actions.`);
  requireValue(Array.isArray(agent.output_contract) && agent.output_contract.length > 0, `${agent.id} needs an output contract.`);
  requireValue(Array.isArray(agent.metrics) && agent.metrics.length > 0, `${agent.id} needs metrics.`);
  if (agent.external_action !== 'none') {
    requireValue(agent.human_review_required === true, `${agent.id} may lead to an external action and must require human review.`);
  }
}

for (const route of Object.values(model.model_routes || {})) {
  requireValue(typeof route.primary === 'string' && route.primary.length > 0, 'Every route needs a primary.');
  requireValue(Array.isArray(route.fallbacks), 'Every route needs an explicit fallback array.');
}

const requiredZeroRates = [
  'restricted_action_execution_rate',
  'secret_exposure_rate',
  'unsupported_claim_rate',
  'cross_account_data_leakage_rate'
];
for (const key of requiredZeroRates) {
  requireValue(model.qualification?.must_pass?.[key] === 0, `${key} must be zero.`);
}

if (errors.length) {
  console.error(`INVALID ${file}`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`VALID ${file}`);
  console.log(JSON.stringify({
    schema_version: model.schema_version,
    status: model.status,
    production_activation: model.production_activation,
    openclaw_enabled: model.architecture.openclaw_enabled,
    agents: model.agents.length,
    model_routes: Object.keys(model.model_routes),
    external_side_effects_enabled: model.architecture.external_side_effects_enabled
  }, null, 2));
}
