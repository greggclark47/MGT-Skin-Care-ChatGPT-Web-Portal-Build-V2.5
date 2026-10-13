import { Router, type Response } from 'express';
import { isCanonicalId, type AntiAgingResponseMeta } from '@mgt/domain';
import { SeedAntiAgingCatalog, type AntiAgingCatalog, type AntiAgingListQuery } from './catalog';

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

function pageResponse<T>(res: Response, page: { items: T[]; next_cursor: string | null }) {
  res.json({ data: page, meta });
}

export function antiAgingRouter(catalog: AntiAgingCatalog = new SeedAntiAgingCatalog()): Router {
  const router = Router();

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
  router.get('/providers/:id', (req, res) => {
    const id = idParam(req.params.id); if (!id) return fail(res, 400, 'invalid_id', 'Use a valid record identifier.');
    const item = catalog.getProvider(id); if (!item) return fail(res, 404, 'not_found', 'Provider not found.');
    return res.json({ data: item, meta });
  });

  return router;
}
