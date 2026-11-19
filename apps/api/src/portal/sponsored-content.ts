import { createHash } from 'node:crypto';
import { parseRetailPartner } from './omni-retail';
import { RETAILERS } from './retailers';

export const SPONSORED_CONTENT_PLACEMENTS = ['free_plan_membership', 'free_plan_shop'] as const;
export const SPONSORED_CONTENT_STATUSES = ['draft', 'approved', 'paused'] as const;
export const SPONSORED_CONTENT_CATEGORIES = ['retail_product', 'beauty_service', 'education_resource'] as const;

type Placement = typeof SPONSORED_CONTENT_PLACEMENTS[number];
type Status = typeof SPONSORED_CONTENT_STATUSES[number];
type Category = typeof SPONSORED_CONTENT_CATEGORIES[number];

export type SponsoredCampaign = {
  id: string;
  retailer_id: string;
  merchant_authorization_reference: string | null;
  status: Status;
  placement: Placement;
  category: Category;
  campaign_reference: string;
  headline: string;
  body: string;
  cta: string;
  destination_url: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/;
const UNSAFE_MARKETING_COPY = /\b(diagnos(?:e|is)|treat(?:ment)?|cure|prevent|medical|clinically\s+proven|guarantee(?:d)?|personalized|for\s+your\s+(?:skin|condition)|acne)\b/i;

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]) { return Object.keys(value).every(key => allowed.includes(key)); }
function validDate(value: unknown): value is string { return typeof value === 'string' && DATE.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00.000Z')); }
function validInstant(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function validRetailer(value: unknown): value is string { return typeof value === 'string' && RETAILERS.some(retailer => retailer.id === value); }
function validCopy(value: unknown, max: number): value is string { return typeof value === 'string' && value === value.trim() && value.length > 0 && Buffer.byteLength(value, 'utf8') <= max && !/[\u0000-\u001f\u007f]/.test(value) && !UNSAFE_MARKETING_COPY.test(value); }

function validDestination(value: unknown, retailerId: string): value is string {
  if (typeof value !== 'string' || value.length > 1000 || value !== value.trim()) return false;
  const retailer = RETAILERS.find(item => item.id === retailerId);
  if (!retailer) return false;
  try {
    const destination = new URL(value), merchant = new URL(retailer.url);
    return destination.protocol === 'https:' && destination.origin === merchant.origin && !destination.username && !destination.password && !destination.search && !destination.hash;
  } catch { return false; }
}

function validRange(start: unknown, end: unknown) {
  return validDate(start) && validDate(end) && Date.parse(end + 'T00:00:00.000Z') >= Date.parse(start + 'T00:00:00.000Z') && Date.parse(end + 'T00:00:00.000Z') - Date.parse(start + 'T00:00:00.000Z') <= 366 * 86400000;
}

function publicCampaignId(campaign: SponsoredCampaign) {
  return 'sponsored-' + createHash('sha256').update(campaign.id).digest('hex').slice(0, 24);
}

export function sponsoredContentStatus(env: NodeJS.ProcessEnv) {
  const requested = env.MGT_SPONSORED_CONTENT_ENABLED === 'true';
  const reviewed = env.MGT_SPONSORED_CONTENT_REVIEWED === 'true';
  const enabled = requested && reviewed;
  return {
    policy_version: 'sponsored-content-policy-v1', enabled, requested, reviewed,
    audience: 'free_plan_only' as const,
    intelligence_mode: 'explainable_nonpersonal_rules' as const,
    personal_targeting: false,
    external_ad_networks: false,
    advertiser_billing: false,
    settlement: 'not_implemented' as const,
    message: !requested ? 'Sponsored content is not enabled in this environment.' : !reviewed ? 'Sponsored content awaits commercial, privacy, and disclosure review.' : 'Only approved, visibly labelled campaigns may appear on the Free plan.',
    prohibited_inputs: ['account profile', 'Skin Match or complexion fields', 'photos or facial data', 'health information', 'location or contact information', 'payment data', 'individual click or purchase history'],
    activation_requirements: ['Current sponsored merchant authorization record exactly matches each approved campaign review.', 'Reviewed campaign copy and verified HTTPS destination.', 'Visible Sponsored label and free-plan notice.', 'Commercial, privacy, accessibility, and support approval.'],
  };
}

export function parseSponsoredCampaign(value: unknown): SponsoredCampaign | null {
  const allowed = ['id', 'retailer_id', 'merchant_authorization_reference', 'status', 'placement', 'category', 'campaign_reference', 'headline', 'body', 'cta', 'destination_url', 'start_date', 'end_date', 'created_at', 'updated_at', 'reviewed_at', 'reviewed_by'];
  if (!record(value) || !onlyKeys(value, allowed) || !validRetailer(value.retailer_id) || typeof value.id !== 'string' || value.id.length < 12 || value.id.length > 220 || !SPONSORED_CONTENT_STATUSES.includes(value.status as Status) || !SPONSORED_CONTENT_PLACEMENTS.includes(value.placement as Placement) || !SPONSORED_CONTENT_CATEGORIES.includes(value.category as Category) || typeof value.campaign_reference !== 'string' || !REFERENCE.test(value.campaign_reference) || value.id !== `sponsor:${value.retailer_id}:${value.campaign_reference}` || !validCopy(value.headline, 120) || !validCopy(value.body, 360) || !validCopy(value.cta, 80) || !validDestination(value.destination_url, value.retailer_id) || !validDate(value.start_date) || !validDate(value.end_date) || !validRange(value.start_date, value.end_date) || !validInstant(value.created_at) || !validInstant(value.updated_at)) return null;
  const authorizationReference = value.merchant_authorization_reference === null ? null : typeof value.merchant_authorization_reference === 'string' && REFERENCE.test(value.merchant_authorization_reference) ? value.merchant_authorization_reference : null;
  const reviewedAt = value.reviewed_at === null ? null : validInstant(value.reviewed_at) ? value.reviewed_at : null;
  const reviewedBy = value.reviewed_by === null ? null : validCopy(value.reviewed_by, 200) ? value.reviewed_by : null;
  if ((value.status === 'approved' && (!authorizationReference || !reviewedAt || !reviewedBy)) || (value.status !== 'approved' && (authorizationReference || reviewedAt || reviewedBy))) return null;
  return { id: value.id, retailer_id: value.retailer_id, merchant_authorization_reference: authorizationReference, status: value.status as Status, placement: value.placement as Placement, category: value.category as Category, campaign_reference: value.campaign_reference, headline: value.headline, body: value.body, cta: value.cta, destination_url: value.destination_url, start_date: value.start_date, end_date: value.end_date, created_at: value.created_at, updated_at: value.updated_at, reviewed_at: reviewedAt, reviewed_by: reviewedBy };
}

export function campaignFromInput(value: unknown, now: string, reviewer: string, existing: SponsoredCampaign | null, sponsoredMerchantAuthorizationReference: string | null): SponsoredCampaign | null {
  const allowed = ['retailer_id', 'status', 'placement', 'category', 'campaign_reference', 'headline', 'body', 'cta', 'destination_url', 'start_date', 'end_date'];
  if (!record(value) || !onlyKeys(value, allowed) || !validRetailer(value.retailer_id) || !SPONSORED_CONTENT_STATUSES.includes(value.status as Status) || !SPONSORED_CONTENT_PLACEMENTS.includes(value.placement as Placement) || !SPONSORED_CONTENT_CATEGORIES.includes(value.category as Category) || typeof value.campaign_reference !== 'string' || !REFERENCE.test(value.campaign_reference) || !validCopy(value.headline, 120) || !validCopy(value.body, 360) || !validCopy(value.cta, 80) || !validDestination(value.destination_url, value.retailer_id) || !validDate(value.start_date) || !validDate(value.end_date) || !validRange(value.start_date, value.end_date)) return null;
  const status = value.status as Status;
  if (status === 'approved' && (!sponsoredMerchantAuthorizationReference || !REFERENCE.test(sponsoredMerchantAuthorizationReference))) return null;
  const id = `sponsor:${value.retailer_id}:${value.campaign_reference}`;
  if (existing && existing.id !== id) return null;
  return { id, retailer_id: value.retailer_id, merchant_authorization_reference: status === 'approved' ? sponsoredMerchantAuthorizationReference : null, status, placement: value.placement as Placement, category: value.category as Category, campaign_reference: value.campaign_reference, headline: value.headline, body: value.body, cta: value.cta, destination_url: value.destination_url, start_date: value.start_date, end_date: value.end_date, created_at: existing?.created_at || now, updated_at: now, reviewed_at: status === 'approved' ? now : null, reviewed_by: status === 'approved' ? reviewer : null };
}

export function publicSponsoredCampaign(value: unknown) {
  const campaign = parseSponsoredCampaign(value), retailer = campaign && RETAILERS.find(item => item.id === campaign.retailer_id);
  if (!campaign || !retailer) return null;
  return { id: publicCampaignId(campaign), merchant_name: retailer.name, retailer_id: campaign.retailer_id, placement: campaign.placement, category: campaign.category, headline: campaign.headline, body: campaign.body, cta: campaign.cta, destination_url: campaign.destination_url, start_date: campaign.start_date, end_date: campaign.end_date, status: campaign.status, disclosure: 'Sponsored — MGT may receive compensation. The merchant owns checkout, payment, delivery, returns, and merchant support.' };
}

export function activeSponsoredCampaigns(values: readonly unknown[], placement: unknown, date = new Date().toISOString().slice(0, 10)) {
  if (!SPONSORED_CONTENT_PLACEMENTS.includes(placement as Placement) || !validDate(date)) return [];
  return values.map(publicSponsoredCampaign).filter((item): item is NonNullable<ReturnType<typeof publicSponsoredCampaign>> => !!item && item.status === 'approved' && item.placement === placement && item.start_date <= date && item.end_date >= date).sort((a, b) => a.id.localeCompare(b.id));
}

// A campaign's own reviewed status is not sufficient authorization. A merchant can
// withdraw, change its placement permission, or replace its authorization after that
// campaign was recorded, so every public display and outbound action must also consult
// the current partner record and require the exact authorization reference to match.
export function authorizedSponsoredCampaigns(campaignValues: readonly unknown[], partnerValues: readonly unknown[]) {
  const currentAuthorizations = new Map(partnerValues
    .map(parseRetailPartner)
    .filter((partner): partner is NonNullable<ReturnType<typeof parseRetailPartner>> => !!partner && partner.status === 'approved' && partner.placement_mode === 'sponsored')
    .map(partner => [partner.retailer_id, partner.authorization_reference] as const));
  return campaignValues
    .map(parseSponsoredCampaign)
    .filter((campaign): campaign is SponsoredCampaign => !!campaign && campaign.merchant_authorization_reference !== null && campaign.merchant_authorization_reference === currentAuthorizations.get(campaign.retailer_id));
}

export function sponsoredCampaignOperations(campaignValues: readonly unknown[], partnerValues: readonly unknown[], date = new Date().toISOString().slice(0, 10)) {
  const authorizedIds = new Set(authorizedSponsoredCampaigns(campaignValues, partnerValues).map(campaign => campaign.id));
  return campaignValues.map(value => {
    const campaign = parseSponsoredCampaign(value), publicCampaign = publicSponsoredCampaign(value);
    if (!campaign || !publicCampaign) return null;
    const authorization_current = authorizedIds.has(campaign.id);
    return { ...publicCampaign, authorization_current, eligible_for_display: authorization_current && activeSponsoredCampaigns([campaign], campaign.placement, date).length === 1 };
  }).filter((item): item is NonNullable<ReturnType<typeof publicSponsoredCampaign>> & { authorization_current: boolean; eligible_for_display: boolean } => !!item);
}

export function selectSponsoredCampaign(values: readonly unknown[], placement: unknown, date = new Date().toISOString().slice(0, 10)) {
  const candidates = activeSponsoredCampaigns(values, placement, date);
  if (!candidates.length) return null;
  const day = Math.floor(Date.parse(date + 'T00:00:00.000Z') / 86400000);
  return candidates[day % candidates.length];
}

export function publicSponsoredMetric(value: unknown) {
  if (!record(value) || typeof value.id !== 'string' || !validDate(value.date) || typeof value.campaign_id !== 'string' || value.campaign_id.length < 12 || value.campaign_id.length > 220 || !SPONSORED_CONTENT_PLACEMENTS.includes(value.placement as Placement) || !Number.isInteger(value.count) || Number(value.count) < 1 || Number(value.count) > 1000000000 || !validInstant(value.updated_at)) return null;
  return { date: value.date, campaign_id: value.campaign_id, placement: value.placement as Placement, count: Number(value.count) };
}

export function sponsoredContentIntelligence(campaignValues: readonly unknown[], metricValues: readonly unknown[]) {
  const campaigns = campaignValues.map(publicSponsoredCampaign).filter((item): item is NonNullable<ReturnType<typeof publicSponsoredCampaign>> => !!item);
  const metrics = metricValues.map(publicSponsoredMetric).filter((item): item is NonNullable<ReturnType<typeof publicSponsoredMetric>> => !!item);
  const today = new Date().toISOString().slice(0, 10);
  const active = campaigns.filter(item => item.status === 'approved' && item.start_date <= today && item.end_date >= today);
  return {
    intelligence_mode: 'explainable_nonpersonal_rules',
    campaign_count: campaigns.length,
    active_campaign_count: active.length,
    aggregate_outbound_events: metrics.reduce((total, item) => total + item.count, 0),
    selection_rule: 'Select only approved, in-date campaigns whose recorded merchant authorization exactly matches the current sponsored authorization; rotate the sorted eligible set once per UTC day.',
    allowed_inputs: ['approved campaign record', 'placement inventory', 'aggregate outbound count'],
    prohibited_inputs: ['account profile', 'Skin Match or complexion fields', 'photos or facial data', 'health information', 'location or contact information', 'payment data', 'individual click or purchase history'],
    human_review_required: true,
    automatic_actions: ['display a visibly labelled sponsored placement when an approved campaign is eligible'],
    never_actions: ['personalize a campaign', 'rank a product for an individual', 'change a routine', 'send customer data to a merchant', 'record a purchase or payment'],
  };
}
