import { Router, type Response } from 'express';
import {
  isCanonicalId, isAntiAgingGoal, isAntiAgingSensitivity, isAntiAgingAiTask, isFeedbackReason, isFeedbackRating,
  providerMatchesCity, type AntiAgingResponseMeta,
} from '@mgt/domain';
import { wrap } from '../../portal/security';
import type { Store } from '../../portal/store';
import { SeedAntiAgingCatalog, type AntiAgingCatalog, type AntiAgingListQuery } from './catalog';
import { ANTI_AGING_AI_DISCLAIMER, ANTI_AGING_AI_POLICY_VERSION, explanationForIngredient, explanationForProduct, searchAntiAging, createAntiAgingAiTelemetry } from './ai';
import type { AntiAgingAiTelemetry } from './telemetry';

const POLICY_VERSION = 'anti-aging-read-only-1';
const DISCLAIMER = 'Educational discovery only. This portal does not diagnose, prescribe, book care, process purchases, or replace professional advice.';
const meta: AntiAgingResponseMeta = { api_version: 'v1', policy_version: POLICY_VERSION, mode: 'read_only_referral', disclaimer: DISCLAIMER };

function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}

function queryValue(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (Array.isArray(value) || typeof value !== 'string' || value.length > 80) return null;
  return value.trim() || undefined;
}

function listQuery(req: { query: Record<string, unknown> }): AntiAgingListQuery | null {
  const read = (key: string) => queryValue(req.query[key]);
  const q = read('q'), category = read('category'), concern = read('concern'), ingredient = read('ingredient');
  const city = read('city'), provider_type = read('provider_type');
  if ([q, category, concern, ingredient, city, provider_type].some(value => value === null)) return null;
  const rawLimit = queryValue(req.query.limit);
  if (rawLimit === null) return null;
  const limit = rawLimit === undefined ? 20 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return null;
  return { q: q ?? undefined, category: category ?? undefined, concern: concern ?? undefined,
    ingredient: ingredient ?? undefined, city: city ?? undefined, provider_type: provider_type ?? undefined, limit };
}

function idParam(value: unknown): string | null {
  return isCanonicalId(value) ? value : null;
}

function csvQuery(value: unknown, max = 6): string[] | null {
  if (value === undefined) return [];
  if (Array.isArray(value) || typeof value !== 'string' || value.length > max * 81) return null;
  const raw = value.trim();
  if (!raw) return [];
  const values = raw.split(',').map(item => item.trim()).filter(Boolean);
  return values.length <= max ? [...new Set(values)] : null;
}

function pageResponse<T>(res: Response, page: { items: T[]; next_cursor: string | null }) {
  res.json({ data: page, meta });
}

export function antiAgingRouter(catalog: AntiAgingCatalog = new SeedAntiAgingCatalog(), telemetry?: AntiAgingAiTelemetry, store?: Store): Router {
  const router = Router();
  const aiTelemetry = createAntiAgingAiTelemetry(telemetry);

  router.get('/search', (req, res) => {
    const q = queryValue(req.query.q);
    const rawLimit = queryValue(req.query.limit);
    const limit = rawLimit === undefined ? 8 : Number(rawLimit);
    if (!q || rawLimit === null || !Number.isInteger(limit) || limit < 1 || limit > 20) return fail(res, 400, 'invalid_search', 'Provide one short search question and a limit from one to twenty.');
    const result = searchAntiAging(catalog, q, limit);
    if (result.blocked) return res.status(422).json({ error: { code: 'question_out_of_scope', message: result.message }, meta });
    return res.json({ data: { results: result.results, uncertainty: result.uncertainty, task: 'anti_aging_search', policy_version: ANTI_AGING_AI_POLICY_VERSION }, meta: { ...meta, disclaimer: ANTI_AGING_AI_DISCLAIMER } });
  });

  router.get('/explanations/ingredients/:id', (req, res) => {
    const id = idParam(req.params.id); if (!id) return fail(res, 400, 'invalid_id', 'Use a valid record identifier.');
    const explanation = explanationForIngredient(catalog, id); if (!explanation) return fail(res, 404, 'not_found', 'Ingredient not found.');
    return res.json({ data: { task: 'anti_aging_explanation', policy_version: ANTI_AGING_AI_POLICY_VERSION, ...explanation }, meta: { ...meta, disclaimer: ANTI_AGING_AI_DISCLAIMER } });
  });

  router.get('/explanations/products/:id', (req, res) => {
    const id = idParam(req.params.id); if (!id) return fail(res, 400, 'invalid_id', 'Use a valid record identifier.');
    const explanation = explanationForProduct(catalog, id); if (!explanation) return fail(res, 404, 'not_found', 'Product not found.');
    return res.json({ data: { task: 'anti_aging_explanation', policy_version: ANTI_AGING_AI_POLICY_VERSION, ...explanation }, meta: { ...meta, disclaimer: ANTI_AGING_AI_DISCLAIMER } });
  });

  router.post('/ai/feedback', (req, res, next) => {
    const responseId = typeof req.body?.response_id === 'string' ? req.body.response_id : '';
    const task = req.body?.task;
    const rating = req.body?.rating;
    const reason = req.body?.reason;
    const comment = req.body?.comment;
    if (!isCanonicalId(responseId) || !isAntiAgingAiTask(task) || !isFeedbackRating(rating) || (reason !== undefined && !isFeedbackReason(reason)) || (comment !== undefined && (typeof comment !== 'string' || comment.length > 500))) {
      return fail(res, 400, 'invalid_feedback', 'Provide a response reference, supported task, rating, and optional review reason.');
    }
    const actor = typeof (req as any).actor === 'string' ? (req as any).actor : 'anonymous';
    void aiTelemetry.recordFeedback({ response_id: responseId, task, rating, reason, comment, created_at: new Date().toISOString() }, actor)
      .then(() => res.status(202).json({ data: { recorded: true, response_id: responseId }, meta }))
      .catch(next);
  });

  router.get('/onboarding/preview', (req, res) => {
    const goals = csvQuery(req.query.goals, 3);
    const sensitivity = queryValue(req.query.sensitivity);
    const consent = queryValue(req.query.consent);
    if (!goals || goals.length < 1 || goals.some(goal => !isAntiAgingGoal(goal)) ||
      !sensitivity || !isAntiAgingSensitivity(sensitivity) || consent === null ||
      (consent !== undefined && consent !== 'personalization')) {
      return fail(res, 400, 'invalid_onboarding', 'Choose one to three goals, a sensitivity level, and an optional personalization consent.');
    }
    const ready = consent === 'personalization';
    return res.json({ data: {
      status: ready ? 'ready' : 'consent_required', next_step: ready ? 'routine_preview' : 'ingredient_explorer',
      goals, sensitivity, safety_notes: [
        'This preview is educational and is not a diagnosis or treatment plan.',
        'Personalization consent is optional and is not implied by browsing.',
        'Seek professional advice for persistent, severe, or changing symptoms.',
      ],
    }, meta });
  });

  router.get('/routines/preview', (req, res) => {
    const productIds = csvQuery(req.query.product_ids, 6);
    const avoidIds = csvQuery(req.query.avoid_ingredient_ids, 20);
    const sensitivity = queryValue(req.query.sensitivity);
    if (!productIds || productIds.length < 1 || productIds.some(id => !isCanonicalId(id)) ||
      !avoidIds || avoidIds.some(id => !isCanonicalId(id)) || !sensitivity || !isAntiAgingSensitivity(sensitivity)) {
      return fail(res, 400, 'invalid_routine_preview', 'Choose valid product, ingredient, and sensitivity values.');
    }
    if (productIds.some(id => !catalog.getProduct(id))) return fail(res, 404, 'not_found', 'One or more products were not found.');
    return res.json({ data: catalog.buildRoutinePreview({ product_ids: productIds, avoid_ingredient_ids: avoidIds, sensitivity }), meta });
  });

  router.get('/ingredients', (req, res) => {
    const query = listQuery(req); if (!query) return fail(res, 400, 'invalid_query', 'Use one short value per supported query parameter.');
    return pageResponse(res, catalog.listIngredients(query));
  });
  router.get('/ingredients/:id/compatibility', (req, res) => {
    const id = idParam(req.params.id); if (!id) return fail(res, 400, 'invalid_id', 'Use a valid record identifier.');
    const ingredient = catalog.getIngredient(id); if (!ingredient) return fail(res, 404, 'not_found', 'Ingredient not found.');
    return res.json({ data: { ingredient_id: ingredient.id, status: 'general_education_only', notes: ingredient.compatibility_notes,
      professional_assessment_required: ingredient.professional_assessment_required }, meta });
  });
  router.get('/ingredients/:id', (req, res) => {
    const id = idParam(req.params.id); if (!id) return fail(res, 400, 'invalid_id', 'Use a valid record identifier.');
    const item = catalog.getIngredient(id); if (!item) return fail(res, 404, 'not_found', 'Ingredient not found.');
    return res.json({ data: item, meta });
  });

  router.get('/products/compare', (req, res) => {
    const raw = queryValue(req.query.ids);
    if (!raw) return fail(res, 400, 'invalid_ids', 'Provide one to four product identifiers.');
    const ids = raw.split(',').map(item => item.trim()).filter(Boolean);
    if (ids.length < 1 || ids.length > 4 || ids.some(id => !isCanonicalId(id))) return fail(res, 400, 'invalid_ids', 'Provide one to four valid product identifiers.');
    const products = ids.map(id => catalog.getProduct(id)).filter((item): item is NonNullable<typeof item> => !!item);
    if (products.length !== ids.length) return fail(res, 404, 'not_found', 'One or more products were not found.');
    return res.json({ data: { items: products, comparison_scope: 'educational_metadata_only' }, meta });
  });
  router.get('/products', (req, res) => {
    const query = listQuery(req); if (!query) return fail(res, 400, 'invalid_query', 'Use one short value per supported query parameter.');
    return pageResponse(res, catalog.listProducts(query));
  });
  router.get('/products/:id', (req, res) => {
    const id = idParam(req.params.id); if (!id) return fail(res, 400, 'invalid_id', 'Use a valid record identifier.');
    const item = catalog.getProduct(id); if (!item) return fail(res, 404, 'not_found', 'Product not found.');
    return res.json({ data: item, meta });
  });

  router.get('/treatments', (req, res) => {
    const query = listQuery(req); if (!query) return fail(res, 400, 'invalid_query', 'Use one short value per supported query parameter.');
    return pageResponse(res, catalog.listTreatments(query));
  });
  router.get('/treatments/:id', (req, res) => {
    const id = idParam(req.params.id); if (!id) return fail(res, 400, 'invalid_id', 'Use a valid record identifier.');
    const item = catalog.getTreatment(id); if (!item) return fail(res, 404, 'not_found', 'Treatment not found.');
    return res.json({ data: item, meta });
  });

  router.get('/providers', (req, res) => {
    const query = listQuery(req); if (!query) return fail(res, 400, 'invalid_query', 'Use one short value per supported query parameter.');
    return pageResponse(res, catalog.listProviders(query));
  });
  router.get('/providers/:id/handoff', (req, res) => {
    const id = idParam(req.params.id); if (!id) return fail(res, 400, 'invalid_id', 'Use a valid record identifier.');
    const item = catalog.getProvider(id); if (!item) return fail(res, 404, 'not_found', 'Provider not found.');
    return res.json({ data: { provider_id: item.id, handoff_type: 'external_referral', handoff_url: item.website_url,
      data_shared: [], booking_supported: false, disclosure: 'You are leaving MGT Skin Care for an independent provider destination.' }, meta });
  });
  router.get('/providers/nearby', wrap(async (req, res) => {
    const started = Date.now();
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const radius = typeof req.query.radius_km === 'string' ? Number(req.query.radius_km) : 10;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 20;
    if (!city || city.length > 80 || !Number.isFinite(radius) || radius < 0 || radius > 50 || !Number.isInteger(limit) || limit < 1 || limit > 50) return fail(res, 400, 'invalid_location_query', 'Use a city and a bounded radius from zero to fifty kilometres.');
    const providers = catalog.listProviders({ city, limit: 50 }).items.filter(item => providerMatchesCity(item, city)).slice(0, limit);
    if (store) await store.tx(async records => { const day = new Date().toISOString().slice(0, 10); const key = `city:${day}`; await records.lock('anti-aging-search:' + day); const current = await records.get<any>('anti_aging_search_metrics', key) || { day, requests: 0, empty_results: 0, latencies: [] }; const latencies = Array.isArray(current.latencies) ? current.latencies.filter((item: unknown) => typeof item === 'number').slice(-199) : []; latencies.push(Date.now() - started); await records.put('anti_aging_search_metrics', key, { day, requests: current.requests + 1, empty_results: current.empty_results + (providers.length ? 0 : 1), latencies }); });
    return res.json({ data: { items: providers, radius_km: radius, location_precision: 'city', geocoding: 'disabled', uncertainty: 'Results use reviewed city records only; no precise location is inferred.' }, meta });
  }));
  router.get('/providers/:id', (req, res) => {
    const id = idParam(req.params.id); if (!id) return fail(res, 400, 'invalid_id', 'Use a valid record identifier.');
    const item = catalog.getProvider(id); if (!item) return fail(res, 404, 'not_found', 'Provider not found.');
    return res.json({ data: item, meta });
  });

  return router;
}
