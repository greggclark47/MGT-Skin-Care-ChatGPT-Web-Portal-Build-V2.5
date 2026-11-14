import { RETAILERS, type RetailerListing } from './retailers';

export const OMNI_RETAIL_POLICY_VERSION = 'omni-retail-partner-policy-v1';
export const OMNI_RETAIL_PLACEMENT_MODES = ['independent', 'preferred_partner', 'sponsored'] as const;
export const OMNI_RETAIL_PARTNER_STATUSES = ['draft', 'approved', 'paused'] as const;
export const OMNI_RETAIL_ROUTINE_SLOTS = ['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'sunscreen', 'eye'] as const;

export type OmniRetailPlacementMode = typeof OMNI_RETAIL_PLACEMENT_MODES[number];
export type OmniRetailPartnerStatus = typeof OMNI_RETAIL_PARTNER_STATUSES[number];
export type OmniRetailRoutineSlot = typeof OMNI_RETAIL_ROUTINE_SLOTS[number];

export type RetailPartnerRecord = {
  retailer_id: string;
  status: OmniRetailPartnerStatus;
  placement_mode: OmniRetailPlacementMode;
  authorization_reference: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export type RetailConversionReport = {
  id: string;
  retailer_id: string;
  merchant_authorization_reference: string;
  period_start: string;
  period_end: string;
  attributed_orders: number;
  attributed_units: number;
  routine_slot_units: Array<{ slot: OmniRetailRoutineSlot; units: number }>;
  received_at: string;
  reviewed_by: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key));
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && DATE.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00.000Z'));
}

function validInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validId(value: unknown, max = 100): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(value) && value.length <= max;
}

export function omniRetailStatus(env: NodeJS.ProcessEnv) {
  const requested = env.MGT_OMNI_RETAIL_ENABLED === 'true';
  const authorizationReviewed = env.MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED === 'true';
  const enabled = requested && authorizationReviewed;
  return {
    policy_version: OMNI_RETAIL_POLICY_VERSION,
    enabled,
    requested,
    authorization_reviewed: authorizationReviewed,
    direct_link_checkout: 'external_vendor' as const,
    customer_purchase_tracking: false,
    conversion_reporting: enabled ? 'aggregate_merchant_report' as const : 'not_enabled' as const,
    message: !requested
      ? 'Partner commerce is not enabled in this environment. Independent retailer links remain available.'
      : !authorizationReviewed
        ? 'Partner commerce awaits the recorded authorization and disclosure review.'
        : 'Partner commerce accepts only approved merchant records and aggregate conversion reports.',
    activation_requirements: [
      'Merchant feature authorization recorded and independently reviewed.',
      'Approved destination URL and product feed or catalog scope.',
      'Clear preferred-partner or sponsored-placement disclosure.',
      'Merchant aggregate reporting terms, privacy review, and support handoff.',
    ],
  };
}

export function parseRetailPartner(value: unknown): RetailPartnerRecord | null {
  const allowed = ['retailer_id', 'status', 'placement_mode', 'authorization_reference', 'created_at', 'updated_at', 'reviewed_at', 'reviewed_by'];
  if (!record(value) || !onlyKeys(value, allowed) || !validId(value.retailer_id) || !OMNI_RETAIL_PARTNER_STATUSES.includes(value.status as OmniRetailPartnerStatus) || !OMNI_RETAIL_PLACEMENT_MODES.includes(value.placement_mode as OmniRetailPlacementMode) || !validInstant(value.created_at) || !validInstant(value.updated_at)) return null;
  const authorizationReference = value.authorization_reference === null ? null : typeof value.authorization_reference === 'string' && REFERENCE.test(value.authorization_reference) ? value.authorization_reference : null;
  const reviewedAt = value.reviewed_at === null ? null : typeof value.reviewed_at === 'string' && Number.isFinite(Date.parse(value.reviewed_at)) ? value.reviewed_at : null;
  const reviewedBy = value.reviewed_by === null ? null : typeof value.reviewed_by === 'string' && value.reviewed_by.length > 0 && value.reviewed_by.length <= 200 ? value.reviewed_by : null;
  if ((value.status === 'approved' && (!authorizationReference || !reviewedAt || !reviewedBy)) || (value.status !== 'approved' && value.placement_mode !== 'independent')) return null;
  if (!RETAILERS.some(retailer => retailer.id === value.retailer_id)) return null;
  return {
    retailer_id: value.retailer_id,
    status: value.status as OmniRetailPartnerStatus,
    placement_mode: value.placement_mode as OmniRetailPlacementMode,
    authorization_reference: authorizationReference,
    created_at: value.created_at,
    updated_at: value.updated_at,
    reviewed_at: reviewedAt,
    reviewed_by: reviewedBy,
  };
}

export function partnerFromInput(value: unknown, now: string, reviewer: string, existing: RetailPartnerRecord | null): RetailPartnerRecord | null {
  if (!record(value) || !onlyKeys(value, ['retailer_id', 'status', 'placement_mode', 'authorization_reference']) || !validId(value.retailer_id) || !OMNI_RETAIL_PARTNER_STATUSES.includes(value.status as OmniRetailPartnerStatus) || !OMNI_RETAIL_PLACEMENT_MODES.includes(value.placement_mode as OmniRetailPlacementMode)) return null;
  if (!RETAILERS.some(retailer => retailer.id === value.retailer_id)) return null;
  const status = value.status as OmniRetailPartnerStatus;
  const placementMode = value.placement_mode as OmniRetailPlacementMode;
  const reference = typeof value.authorization_reference === 'string' && REFERENCE.test(value.authorization_reference) ? value.authorization_reference : null;
  if ((status === 'approved' && (!reference || placementMode === 'independent')) || (status !== 'approved' && placementMode !== 'independent')) return null;
  return {
    retailer_id: value.retailer_id,
    status,
    placement_mode: placementMode,
    authorization_reference: reference,
    created_at: existing?.created_at || now,
    updated_at: now,
    reviewed_at: status === 'approved' ? now : null,
    reviewed_by: status === 'approved' ? reviewer : null,
  };
}

export function publicRetailPartner(value: unknown) {
  const partner = parseRetailPartner(value);
  if (!partner) return null;
  const retailer = RETAILERS.find(item => item.id === partner.retailer_id);
  if (!retailer) return null;
  return {
    retailer_id: retailer.id,
    merchant_name: retailer.name,
    primary_domain: new URL(retailer.url).hostname,
    status: partner.status,
    placement_mode: partner.placement_mode,
    authorization_recorded: partner.authorization_reference !== null,
    reviewed_at: partner.reviewed_at,
  };
}

export function decorateRetailers(retailers: readonly RetailerListing[], values: readonly unknown[]) {
  const partners = new Map(values.map(parseRetailPartner).filter((item): item is RetailPartnerRecord => !!item).map(item => [item.retailer_id, item]));
  return retailers.map(retailer => {
    const partner = partners.get(retailer.id);
    if (!partner || partner.status !== 'approved') return { ...retailer, relationship: 'independent' as const, placement_label: 'Independent listing' };
    if (partner.placement_mode === 'sponsored') return { ...retailer, relationship: 'sponsored' as const, placement_label: 'Sponsored placement' };
    return { ...retailer, relationship: 'approved_partner' as const, placement_label: 'Preferred partner' };
  });
}

export function parseRetailConversionReport(value: unknown, now: string, reviewer: string, merchantAuthorizationReference: unknown): RetailConversionReport | null {
  if (!record(value) || !onlyKeys(value, ['retailer_id', 'batch_reference', 'period_start', 'period_end', 'attributed_orders', 'attributed_units', 'routine_slot_units']) || !validId(value.retailer_id) || !REFERENCE.test(String(value.batch_reference || '')) || !REFERENCE.test(String(merchantAuthorizationReference || '')) || !validDate(value.period_start) || !validDate(value.period_end) || Date.parse(value.period_end + 'T00:00:00.000Z') < Date.parse(value.period_start + 'T00:00:00.000Z')) return null;
  const days = (Date.parse(value.period_end + 'T00:00:00.000Z') - Date.parse(value.period_start + 'T00:00:00.000Z')) / 86400000;
  if (days > 366 || !Number.isInteger(value.attributed_orders) || !Number.isInteger(value.attributed_units) || Number(value.attributed_orders) < 0 || Number(value.attributed_units) < 0 || Number(value.attributed_orders) > 100000000 || Number(value.attributed_units) > 100000000 || !Array.isArray(value.routine_slot_units) || value.routine_slot_units.length > OMNI_RETAIL_ROUTINE_SLOTS.length) return null;
  const slots: Array<{ slot: OmniRetailRoutineSlot; units: number }> = [];
  for (const item of value.routine_slot_units) {
    if (!record(item) || !OMNI_RETAIL_ROUTINE_SLOTS.includes(item.slot as OmniRetailRoutineSlot) || !Number.isInteger(item.units) || Number(item.units) < 0 || Number(item.units) > 100000000 || slots.some(row => row.slot === item.slot)) return null;
    slots.push({ slot: item.slot as OmniRetailRoutineSlot, units: Number(item.units) });
  }
  if (slots.reduce((sum, item) => sum + item.units, 0) > Number(value.attributed_units)) return null;
  return {
    id: `${value.retailer_id}:${value.batch_reference}`,
    retailer_id: value.retailer_id,
    merchant_authorization_reference: String(merchantAuthorizationReference),
    period_start: value.period_start,
    period_end: value.period_end,
    attributed_orders: Number(value.attributed_orders),
    attributed_units: Number(value.attributed_units),
    routine_slot_units: slots,
    received_at: now,
    reviewed_by: reviewer,
  };
}

export function publicRetailConversionReport(value: unknown): RetailConversionReport | null {
  if (!record(value) || !validId(value.retailer_id) || !REFERENCE.test(String(value.merchant_authorization_reference || '')) || !validDate(value.period_start) || !validDate(value.period_end) || !Number.isInteger(value.attributed_orders) || !Number.isInteger(value.attributed_units) || !Array.isArray(value.routine_slot_units) || typeof value.received_at !== 'string' || !Number.isFinite(Date.parse(value.received_at))) return null;
  const slots: Array<{ slot: OmniRetailRoutineSlot; units: number }> = [];
  for (const item of value.routine_slot_units) {
    if (!record(item) || !OMNI_RETAIL_ROUTINE_SLOTS.includes(item.slot as OmniRetailRoutineSlot) || !Number.isInteger(item.units) || Number(item.units) < 0 || slots.some(row => row.slot === item.slot)) return null;
    slots.push({ slot: item.slot as OmniRetailRoutineSlot, units: Number(item.units) });
  }
  return { id: typeof value.id === 'string' ? value.id : '', retailer_id: value.retailer_id, merchant_authorization_reference: String(value.merchant_authorization_reference), period_start: value.period_start, period_end: value.period_end, attributed_orders: Number(value.attributed_orders), attributed_units: Number(value.attributed_units), routine_slot_units: slots, received_at: value.received_at, reviewed_by: '' };
}

export function summarizeRetailConversions(values: readonly unknown[]) {
  const reports = values.map(publicRetailConversionReport).filter((item): item is RetailConversionReport => !!item);
  const byRetailer = new Map<string, { reports: number; orders: number; units: number }>();
  const bySlot = new Map<OmniRetailRoutineSlot, number>();
  for (const report of reports) {
    const current = byRetailer.get(report.retailer_id) || { reports: 0, orders: 0, units: 0 };
    current.reports++; current.orders += report.attributed_orders; current.units += report.attributed_units;
    byRetailer.set(report.retailer_id, current);
    for (const row of report.routine_slot_units) bySlot.set(row.slot, (bySlot.get(row.slot) || 0) + row.units);
  }
  return {
    reports: reports.length,
    attributed_orders: reports.reduce((sum, report) => sum + report.attributed_orders, 0),
    attributed_units: reports.reduce((sum, report) => sum + report.attributed_units, 0),
    by_retailer: [...byRetailer.entries()].map(([retailer_id, value]) => ({ retailer_id, ...value })).sort((a, b) => b.units - a.units || a.retailer_id.localeCompare(b.retailer_id)),
    routine_slot_volume: OMNI_RETAIL_ROUTINE_SLOTS.map(slot => ({ slot, units: bySlot.get(slot) || 0 })).filter(row => row.units > 0),
    privacy_note: 'These are merchant-submitted aggregate reports. They do not identify customers, record payment details, verify a customer purchase, or change a routine automatically.',
  };
}
