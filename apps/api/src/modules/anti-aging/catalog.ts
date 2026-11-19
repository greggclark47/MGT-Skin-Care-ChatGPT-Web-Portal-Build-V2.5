import type {
  IngredientRecord, ProductRecord, ProviderRecord, TreatmentRecord, ReadOnlyPage, RoutinePreview,
  RoutinePreviewRequest,
} from '@mgt/domain';

export interface AntiAgingListQuery {
  q?: string;
  category?: string;
  concern?: string;
  ingredient?: string;
  city?: string;
  provider_type?: string;
  limit: number;
}

export interface AntiAgingCatalog {
  listIngredients(query: AntiAgingListQuery): ReadOnlyPage<IngredientRecord>;
  getIngredient(id: string): IngredientRecord | undefined;
  listProducts(query: AntiAgingListQuery): ReadOnlyPage<ProductRecord>;
  getProduct(id: string): ProductRecord | undefined;
  listTreatments(query: AntiAgingListQuery): ReadOnlyPage<TreatmentRecord>;
  getTreatment(id: string): TreatmentRecord | undefined;
  listProviders(query: AntiAgingListQuery): ReadOnlyPage<ProviderRecord>;
  getProvider(id: string): ProviderRecord | undefined;
  buildRoutinePreview(input: RoutinePreviewRequest): RoutinePreview;
}

const DATE = '2026-10-13T00:00:00.000Z';
const provenance = (source_url: string, source_type: 'editorial' | 'manufacturer' | 'provider' | 'public_registry' | 'partner_feed' = 'editorial') => ({
  source_type, source_url, observed_at: DATE, imported_at: DATE, freshness_until: '2027-01-11T00:00:00.000Z',
  import_run_id: 'anti-aging-seed-v1', reviewed_status: 'approved' as const, reviewed_by: 'content-review',
});
const base = (id: string, slug: string, name: string, source_url: string, professional_assessment_required = false) => ({
  id, slug, name, provenance: provenance(source_url), evidence_level: 'moderate' as const,
  commercial_label: 'none' as const, professional_assessment_required, updated_at: DATE,
});

export const SEED_ANTI_AGING_INGREDIENTS: IngredientRecord[] = [
  {
    ...base('ingredient-retinol', 'retinol', 'Retinol', 'https://example.org/mgt/editorial/retinol'),
    category: 'retinoid', aliases: ['vitamin-a-derivative'],
    educational_summary: 'A vitamin A derivative commonly discussed for texture and visible signs of aging.',
    compatibility_notes: ['Introduce gradually.', 'Use daytime sun protection.', 'Ask a clinician about pregnancy or medication-specific questions.'],
    avoid_for_sensitivity: true,
  },
  {
    ...base('ingredient-vitamin-c', 'vitamin-c', 'Vitamin C', 'https://example.org/mgt/editorial/vitamin-c'),
    category: 'antioxidant', aliases: ['ascorbic-acid', 'l-ascorbic-acid'],
    educational_summary: 'An antioxidant ingredient commonly used in educational routines for tone and environmental exposure.',
    compatibility_notes: ['Formulas vary in strength and stability.', 'Patch test new products.', 'Stop if irritation persists.'],
  },
  {
    ...base('ingredient-niacinamide', 'niacinamide', 'Niacinamide', 'https://example.org/mgt/editorial/niacinamide'),
    category: 'barrier', aliases: ['nicotinamide', 'vitamin-b3'],
    educational_summary: 'A vitamin B3 ingredient commonly included in barrier-support and tone-focused skincare.',
    compatibility_notes: ['Generally used in many routine types.', 'Check the full formula when skin is reactive.'],
  },
];

export const SEED_ANTI_AGING_PRODUCTS: ProductRecord[] = [
  {
    ...base('product-c-brightening-serum', 'c-brightening-serum', 'Brightening Antioxidant Serum', 'https://example.org/mgt/products/c-brightening-serum'),
    brand: 'MGT Education Sample', merchant_name: 'Independent retailer destination', category: 'serum',
    ingredient_ids: ['ingredient-vitamin-c', 'ingredient-niacinamide'], concern_tags: ['brightening', 'environmental_support'],
    external_url: 'https://example.org/mgt/products/c-brightening-serum', price_band: '25_50', sample_only: true,
  },
  {
    ...base('product-night-renewal-serum', 'night-renewal-serum', 'Night Renewal Serum', 'https://example.org/mgt/products/night-renewal-serum'),
    brand: 'MGT Education Sample', merchant_name: 'Independent retailer destination', category: 'treatment',
    ingredient_ids: ['ingredient-retinol'], concern_tags: ['texture', 'visible_signs_of_aging'],
    external_url: 'https://example.org/mgt/products/night-renewal-serum', price_band: '50_100', sample_only: true,
  },
];

export const SEED_ANTI_AGING_TREATMENTS: TreatmentRecord[] = [
  {
    ...base('treatment-dermatology-consultation', 'dermatology-consultation', 'Dermatology Consultation', 'https://example.org/mgt/treatments/dermatology-consultation', true),
    category: 'consultation', evidence_level: 'strong',
    description: 'A conversation with a qualified clinician about personal goals, risks, and appropriate options.',
    expected_questions: ['What are your goals?', 'What products or medicines are you using?', 'What is your comfort with downtime and cost?'],
    aftercare_note: 'Follow the provider instructions and seek care for unexpected or worsening symptoms.',
  },
  {
    ...base('treatment-superficial-peel', 'superficial-peel', 'Superficial Peel Consultation', 'https://example.org/mgt/treatments/superficial-peel', true),
    category: 'peel', evidence_level: 'moderate',
    description: 'A provider-led consultation about a superficial peel and whether it fits the person’s skin and goals.',
    expected_questions: ['What is the planned formulation?', 'What preparation is needed?', 'What downtime and aftercare are expected?'],
    aftercare_note: 'Use only the aftercare plan provided by the treating professional.',
  },
];

export const SEED_ANTI_AGING_PROVIDERS: ProviderRecord[] = [
  {
    ...base('provider-example-dermatology', 'example-dermatology', 'Example Dermatology Practice', 'https://example.org/mgt/providers/example-dermatology', true),
    provider_type: 'dermatology_practice', city: 'New York', region: 'NY', services: ['consultation', 'skin-health-review'],
    website_url: 'https://example.org/mgt/providers/example-dermatology', independent_provider: true,
  },
];

function normalized(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : undefined;
}
function contains(record: { name: string; slug: string }, q?: string): boolean {
  return !q || `${record.name} ${record.slug}`.toLowerCase().includes(q);
}
function page<T>(items: T[], limit: number): ReadOnlyPage<T> {
  return { items: items.slice(0, limit), next_cursor: items.length > limit ? `offset:${limit}` : null };
}

export class SeedAntiAgingCatalog implements AntiAgingCatalog {
  constructor(
    private readonly ingredients = SEED_ANTI_AGING_INGREDIENTS,
    private readonly products = SEED_ANTI_AGING_PRODUCTS,
    private readonly treatments = SEED_ANTI_AGING_TREATMENTS,
    private readonly providers = SEED_ANTI_AGING_PROVIDERS,
  ) {}

  listIngredients(query: AntiAgingListQuery): ReadOnlyPage<IngredientRecord> {
    const q = normalized(query.q), category = normalized(query.category);
    return page(this.ingredients.filter(item => contains(item, q) && (!category || item.category === category)), query.limit);
  }
  getIngredient(id: string) { return this.ingredients.find(item => item.id === id); }
  listProducts(query: AntiAgingListQuery): ReadOnlyPage<ProductRecord> {
    const q = normalized(query.q), category = normalized(query.category), concern = normalized(query.concern), ingredient = normalized(query.ingredient);
    return page(this.products.filter(item => contains(item, q) && (!category || item.category === category) &&
      (!concern || item.concern_tags.includes(concern)) && (!ingredient || item.ingredient_ids.includes(ingredient))), query.limit);
  }
  getProduct(id: string) { return this.products.find(item => item.id === id); }
  listTreatments(query: AntiAgingListQuery): ReadOnlyPage<TreatmentRecord> {
    const q = normalized(query.q), category = normalized(query.category);
    return page(this.treatments.filter(item => contains(item, q) && (!category || item.category === category)), query.limit);
  }
  getTreatment(id: string) { return this.treatments.find(item => item.id === id); }
  listProviders(query: AntiAgingListQuery): ReadOnlyPage<ProviderRecord> {
    const q = normalized(query.q), city = normalized(query.city), type = normalized(query.provider_type), service = normalized(query.category);
    return page(this.providers.filter(item => contains(item, q) && (!city || item.city.toLowerCase() === city) &&
      (!type || item.provider_type === type) && (!service || item.services.includes(service))), query.limit);
  }
  getProvider(id: string) { return this.providers.find(item => item.id === id); }
  buildRoutinePreview(input: RoutinePreviewRequest): RoutinePreview {
    const selected = input.product_ids.map(id => this.getProduct(id)).filter((item): item is ProductRecord => !!item);
    const excluded_product_ids = selected.filter(item => item.ingredient_ids.some(id => input.avoid_ingredient_ids.includes(id))).map(item => item.id);
    const safe = selected.filter(item => !excluded_product_ids.includes(item.id));
    const categoryOrder: ProductRecord['category'][] = ['cleanser', 'serum', 'treatment', 'eye', 'moisturizer', 'sunscreen'];
    const cautions = (item: ProductRecord) => {
      const notes: string[] = [];
      if (item.ingredient_ids.includes('ingredient-retinol')) notes.push('Introduce gradually and follow the product label.');
      if (input.sensitivity !== 'none' && item.ingredient_ids.includes('ingredient-retinol')) notes.push('Consider professional guidance if irritation persists.');
      return notes;
    };
    const steps = safe.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)).map((item, index) => ({
      order: index + 1, time: item.category === 'sunscreen' ? 'am' as const : 'pm' as const,
      category: item.category, product_id: item.id, product_name: item.name, cautions: cautions(item),
    }));
    return {
      status: 'preview_only', steps, excluded_product_ids,
      safety_notes: ['Preview only: nothing is saved or purchased.', 'Patch test new products and follow product labels.', 'Stop and seek professional advice for persistent or severe reactions.'],
      confirmation_required: true,
    };
  }
}
