// Reviewed, category-level production remediation. This is intentionally safe
// to return to an operator console: it contains no values, endpoints, paths,
// credentials, or deployment evidence.
export const PRODUCTION_ADMISSION_ACTIONS = Object.freeze({
  ownership: 'Confirm the approved release and support owner declarations.',
  portal_boundary: 'Provide the approved HTTPS portal origin and matching domain.',
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
  ai: 'Keep optional AI runtimes disabled or provide the reviewed service mode and isolation settings.',
  process_surface: 'Bind the production process to the approved host, port and worker-health path.',
  image: 'Pin every production image to a distinct immutable digest.',
  secret_isolation: 'Ensure every configured production secret is distinct and isolated by purpose.',
  endpoint_isolation: 'Ensure monitoring, runbook, accessibility and delivery endpoints are distinct.',
  disabled_feature_residue: 'Remove configuration residue for disabled test, commerce, AI or webhook features.'
} as const);

export type ProductionAdmissionId = keyof typeof PRODUCTION_ADMISSION_ACTIONS;
export type ProductionAdmissionAction = { id: ProductionAdmissionId; action: string };

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
