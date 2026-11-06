// Reviewed, category-level production remediation. This is intentionally safe
// to return to an operator console: it contains no values, endpoints, paths,
// credentials, or deployment evidence.
export const PRODUCTION_ADMISSION_ACTIONS = Object.freeze({
  ownership: 'Confirm the approved release and support owner declarations.',
  portal_boundary: 'Provide the approved HTTPS portal origin and matching domain.',
  policy_publication: 'Provide distinct approved HTTPS Privacy, Terms, and AI disclosure notice locations.',
  edge_authentication: 'Inject a distinct private token shared only by the edge and API to authenticate forwarded client addresses.',
  worker_timing: 'Set a bounded worker interval and readiness age with the required safety margin.',
  database: 'Provide the reviewed PostgreSQL target with full TLS verification and migrations disabled at runtime.',
  operations: 'Provide named operations contacts, alert delivery, retry policy and retention settings.',
  notifications: 'Choose an approved in-app or HTTPS notification delivery path with bounded retry settings.',
  identity: 'Configure the approved identity project and distinct public and service credentials.',
  backup: 'Provide bounded backup freshness and restore-drill age settings.',
  backup_attestation: 'Choose the reviewed backup-attestation mode and its bounded retention policy.',
  anti_aging: 'Review anti-aging feature flags and retention policy before enabling production traffic.',
  accessibility: 'Attach a current deployed accessibility validation report.',
  subscriptions: 'Keep subscriptions disabled or provide approved terms, catalog IDs, and signed billing settings.',
  sponsored_content: 'Keep Free-plan sponsorship disabled or provide merchant authorization and a current reviewed approval record.',
  ai: 'Keep optional AI runtimes disabled or provide the reviewed service mode and isolation settings.',
  process_surface: 'Bind the production process to the approved host, port and worker-health path.',
  image: 'Pin every production image to a distinct immutable digest.',
  secret_isolation: 'Ensure every configured production secret is distinct and isolated by purpose.',
  endpoint_isolation: 'Ensure monitoring, runbook, accessibility and delivery endpoints are distinct.',
  disabled_feature_residue: 'Remove configuration residue for disabled test, commerce, AI or webhook features.'
} as const);

export type ProductionAdmissionId = keyof typeof PRODUCTION_ADMISSION_ACTIONS;
export type ProductionAdmissionAction = { id: ProductionAdmissionId; action: string };
export const PRODUCTION_ADMISSION_CONTRACT_VERSION = 3;

export function reviewedProductionAdmissionAction(id: unknown): ProductionAdmissionAction | null {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(PRODUCTION_ADMISSION_ACTIONS, id)) return null;
  const safeId = id as ProductionAdmissionId;
  return { id: safeId, action: PRODUCTION_ADMISSION_ACTIONS[safeId] };
}

// A browser must never echo arbitrary API text into an operations view. Require
// the exact reviewed pair so a mismatched or unexpected response fails closed.
export function reviewedProductionAdmissionActions(value: unknown): ProductionAdmissionAction[] {
  if (!Array.isArray(value)) return [];
  const accepted = new Set<ProductionAdmissionId>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = reviewedProductionAdmissionAction((item as { id?: unknown }).id);
    if (candidate && (item as { action?: unknown }).action === candidate.action) accepted.add(candidate.id);
  }
  return (Object.keys(PRODUCTION_ADMISSION_ACTIONS) as ProductionAdmissionId[]).flatMap(id => accepted.has(id) ? [reviewedProductionAdmissionAction(id)!] : []);
}

function reviewedProductionAdmissionCheckIssues(value: unknown): ProductionAdmissionId[] | null {
  const ids = Object.keys(PRODUCTION_ADMISSION_ACTIONS) as ProductionAdmissionId[];
  if (!Array.isArray(value) || value.length !== ids.length) return null;
  const seen = new Set<ProductionAdmissionId>();
  const issues: ProductionAdmissionId[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const id = reviewedProductionAdmissionAction((item as { id?: unknown }).id)?.id;
    const healthy = (item as { healthy?: unknown }).healthy;
    if (!id || typeof healthy !== 'boolean' || seen.has(id)) return null;
    seen.add(id);
    if (!healthy) issues.push(id);
  }
  return ids.every(id => seen.has(id)) ? issues : null;
}

// A console must not present a production runtime as admitted merely because a
// response set a friendly boolean. The healthy form is deliberately exact:
// every blocked category and action list must be absent, rather than merely
// unrecognised by the browser.
export function hasReviewedHealthyProductionAdmission(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { admission_version?: unknown; healthy?: unknown; issues?: unknown; next_actions?: unknown; checks?: unknown };
  const checkIssues = reviewedProductionAdmissionCheckIssues(candidate.checks);
  return candidate.healthy === true
    && candidate.admission_version === PRODUCTION_ADMISSION_CONTRACT_VERSION
    && Array.isArray(candidate.issues) && candidate.issues.length === 0
    && Array.isArray(candidate.next_actions) && candidate.next_actions.length === 0
    && checkIssues !== null && checkIssues.length === 0;
}

// Blocked guidance is useful only if the response remains self-consistent. A
// response with a mismatched issue list, a missing contract version, or an
// altered action is displayed as a generic block instead of guessing what an
// operator should do.
export function reviewedProductionAdmissionBlock(value: unknown): ProductionAdmissionAction[] {
  if (!value || typeof value !== 'object') return [];
  const candidate = value as { admission_version?: unknown; healthy?: unknown; issues?: unknown; next_actions?: unknown; checks?: unknown };
  if (candidate.admission_version !== PRODUCTION_ADMISSION_CONTRACT_VERSION || candidate.healthy !== false || !Array.isArray(candidate.issues)) return [];
  const ids = candidate.issues;
  if (ids.length === 0 || new Set(ids).size !== ids.length || !ids.every(id => reviewedProductionAdmissionAction(id))) return [];
  const checkIssues = reviewedProductionAdmissionCheckIssues(candidate.checks);
  if (!checkIssues || checkIssues.length !== ids.length || !ids.every(id => checkIssues.includes(id))) return [];
  if (!Array.isArray(candidate.next_actions)) return [];
  for (const item of candidate.next_actions) {
    if (!item || typeof item !== 'object') return [];
    const action = reviewedProductionAdmissionAction((item as { id?: unknown }).id);
    if (!action || (item as { action?: unknown }).action !== action.action || !ids.includes(action.id)) return [];
  }
  const actions = reviewedProductionAdmissionActions(candidate.next_actions);
  return actions.length === ids.length && ids.every(id => actions.some(action => action.id === id)) ? actions : [];
}
