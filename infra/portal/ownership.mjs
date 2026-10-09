// Accountable owner designated by the user. Names are record metadata;
// authentication and the actual approval evidence remain separate controls.
export const DEFAULT_ACCOUNTABLE_OWNER = 'Gregg Clark of MGT';

// Do not trim, coerce, or case-fold: an altered declaration must fail closed.
export function isAccountableOwner(value) {
  return typeof value === 'string' && value === DEFAULT_ACCOUNTABLE_OWNER;
}

// Field names come from trusted schema definitions, never submitted values.
export function accountableOwnerError(field) {
  return `${field} must equal ${DEFAULT_ACCOUNTABLE_OWNER}.`;
}

export function validateOwnershipEnvironment(env = {}) {
  const errors = ['RELEASE_OWNER_NAME', 'SUPPORT_OWNER_NAME']
    .filter(key => !isAccountableOwner(env?.[key]))
    .map(accountableOwnerError);
  return { ok: errors.length === 0, errors };
}
