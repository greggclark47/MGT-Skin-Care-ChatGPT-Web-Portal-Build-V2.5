import { Router } from 'express';
import {
  aggregateProgress, buildAppointmentRequest, buildMerchantReferral, buildProgressReminder, isCanonicalId, isProgressReminderCadence, isProgressStatus, progressReminderState, snoozeProgressReminder, validateProgressEntry,
  type AppointmentRequestInput, type ProgressEntry, type ProgressReminder,
} from '@mgt/domain';
import { check, hash, wrap } from '../../portal/security';
import type { Store } from '../../portal/store';
import type { AntiAgingCatalog } from './catalog';

function actorOf(req: { actor?: unknown }): string {
  check(typeof req.actor === 'string' && req.actor.length > 0, 401, 'authentication_required', 'Sign in to use this feature.');
  return req.actor as string;
}

function missingStore(store: Store | undefined): asserts store is Store {
  check(store, 503, 'state_unavailable', 'This preview is not configured to save records yet.');
}

export function antiAgingRoadmapRouter(catalog: AntiAgingCatalog, store?: Store): Router {
  const router = Router();

  router.get('/referrals/preview', (req, res) => {
    const id = typeof req.query.product_id === 'string' ? req.query.product_id : '';
    if (!isCanonicalId(id)) return res.status(400).json({ error: { code: 'invalid_product', message: 'Choose a valid sample product.' } });
    const product = catalog.getProduct(id);
    if (!product) return res.status(404).json({ error: { code: 'not_found', message: 'Product not found.' } });
    try { return res.json({ data: buildMerchantReferral(product), meta: { mode: 'read_only_referral', data_shared: [] } }); }
    catch { return res.status(409).json({ error: { code: 'referral_unavailable', message: 'This destination is awaiting allowlist review.' } }); }
  });

  router.post('/referrals/click', wrap(async (req, res) => {
    missingStore(store);
    const id = typeof req.body?.product_id === 'string' ? req.body.product_id : '';
    const product = isCanonicalId(id) ? catalog.getProduct(id) : undefined;
    check(product, 400, 'invalid_product', 'Choose a valid sample product.');
    const day = new Date().toISOString().slice(0, 10);
    const key = `${day}:${product.id}`;
    await store.tx(async records => {
      await records.lock('anti-aging-referral:' + hash(key));
      const current = await records.get<{ clicks: number }>('anti_aging_referral_clicks', key);
      await records.put('anti_aging_referral_clicks', key, { clicks: (current?.clicks || 0) + 1, product_id: product.id, day });
    });
    res.status(202).json({ data: { recorded: true, measurement: 'aggregate_click_only', data_shared: [] } });
  }));

  router.post('/progress', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    check(req.body?.consent === 'progress_tracking', 400, 'consent_required', 'Progress tracking requires purpose-specific consent.');
    check(typeof req.body?.entry_id === 'string' && isCanonicalId(req.body.entry_id), 400, 'invalid_progress', 'Choose a valid progress entry reference.');
    check(isProgressStatus(req.body?.status), 400, 'invalid_progress', 'Choose a supported progress status.');
    check(typeof req.body?.completed_at === 'string' && typeof req.body?.consent_version === 'string', 400, 'invalid_progress', 'Provide a progress timestamp and consent version.');
    const validation = validateProgressEntry({ entry_id: req.body.entry_id, status: req.body.status, completed_at: req.body.completed_at, consent_version: req.body.consent_version });
    check(validation.ok && validation.value, 400, 'invalid_progress', 'Provide a recent progress timestamp and a valid consent version.');
    const input = validation.value;
    const now = new Date().toISOString();
    const saved = await store.tx(async records => {
      await records.lock('anti-aging-progress:' + hash(actor + ':' + input.entry_id));
      const existing = await records.get<ProgressEntry>('anti_aging_progress', actor + ':' + input.entry_id);
      if (existing) return existing;
      const entry: ProgressEntry = { ...input, actor, created_at: now, policy_version: 'anti-aging-roadmap-1' };
      await records.put('anti_aging_progress', actor + ':' + input.entry_id, entry);
      return entry;
    });
    res.status(202).json({ data: saved, note: 'Aggregate adherence only; no diagnostic inference is made.' });
  }));

  router.get('/progress', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const entries = await store.tx(async records => (await records.entries<ProgressEntry>('anti_aging_progress')).map(item => item.value).filter(item => item.actor === actor));
    res.json({ data: { entries, aggregate: aggregateProgress(entries), consent_scope: 'progress_tracking' } });
  }));

  router.get('/progress/export', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const bundle = await store.tx(async records => ({
      entries: (await records.entries<ProgressEntry>('anti_aging_progress')).map(item => item.value).filter(item => item.actor === actor),
      reminders: (await records.entries<ProgressReminder>('anti_aging_reminders')).map(item => item.value).filter(item => item.actor === actor),
    }));
    res.json({ data: { ...bundle, export_format: 'json', data_shared: [], note: 'Portable personal copy; not a diagnosis or treatment record.' } });
  }));

  router.delete('/progress', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    check(req.body?.confirm === true, 400, 'confirmation_required', 'Confirm removal of progress records.');
    const removed = await store.tx(async records => { let count = 0; for (const item of await records.entries<ProgressEntry>('anti_aging_progress')) if (item.value.actor === actor) { await records.remove('anti_aging_progress', item.id); count++; } for (const item of await records.entries<ProgressReminder>('anti_aging_reminders')) if (item.value.actor === actor) await records.remove('anti_aging_reminders', item.id); return count; });
    res.json({ data: { deleted: removed, reminders_deleted: true, consent_revoked: true } });
  }));

  router.get('/progress/reminders', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const reminders = await store.tx(async records => (await records.entries<ProgressReminder>('anti_aging_reminders')).map(item => item.value).filter(item => item.actor === actor));
    res.json({ data: { reminders, states: reminders.reduce((summary, reminder) => { const state = progressReminderState(reminder); summary[state]++; return summary; }, { paused: 0, due: 0, scheduled: 0 } as Record<string, number>), consent_scope: 'reminders' } });
  }));

  router.post('/progress/reminders', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    check(req.body?.consent === 'reminders', 400, 'consent_required', 'Reminder delivery requires purpose-specific consent.');
    const entryId = typeof req.body?.entry_id === 'string' ? req.body.entry_id : '';
    const cadence = req.body?.cadence;
    const days = Number(req.body?.days_from_now);
    const consentVersion = typeof req.body?.consent_version === 'string' ? req.body.consent_version : '';
    check(isCanonicalId(entryId) && isProgressReminderCadence(cadence) && Number.isInteger(days) && days >= 1 && days <= 365 && consentVersion.length > 0, 400, 'invalid_reminder', 'Choose a supported cadence, date window, and consent version.');
    const id = 'aa_rem_' + hash(actor + ':' + entryId + ':' + cadence).slice(0, 56);
    const reminder = await store.tx(async records => { await records.lock('anti-aging-reminder:' + hash(id)); const saved = buildProgressReminder({ entry_id: entryId, cadence, days_from_now: days, consent_version: consentVersion }, actor, id); await records.put('anti_aging_reminders', id, saved); return saved; });
    res.status(202).json({ data: reminder });
  }));

  router.post('/progress/reminders/:id', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const action = req.body?.action;
    check(isCanonicalId(id) && (action === 'pause' || action === 'resume' || action === 'snooze'), 400, 'invalid_reminder', 'Choose pause, resume, or snooze for this reminder.');
    if (action === 'snooze') check(Number.isInteger(Number(req.body?.days)) && Number(req.body.days) >= 1 && Number(req.body.days) <= 30, 400, 'invalid_reminder', 'Choose a snooze window from 1 to 30 days.');
    const saved = await store.tx(async records => { await records.lock('anti-aging-reminder:' + hash(id)); const reminder = await records.get<ProgressReminder>('anti_aging_reminders', id); check(reminder?.actor === actor, 404, 'reminder_not_found', 'Reminder not found.'); const next = action === 'snooze' ? snoozeProgressReminder(reminder, Number(req.body?.days || 1)) : { ...reminder, paused: action === 'pause', updated_at: new Date().toISOString() }; await records.put('anti_aging_reminders', id, next); return next; });
    res.json({ data: saved });
  }));

  router.delete('/progress/reminders/:id', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    check(isCanonicalId(id), 400, 'invalid_reminder', 'Use a valid reminder reference.');
    const removed = await store.tx(async records => { const reminder = await records.get<ProgressReminder>('anti_aging_reminders', id); check(reminder?.actor === actor, 404, 'reminder_not_found', 'Reminder not found.'); await records.remove('anti_aging_reminders', id); return true; });
    res.json({ data: { deleted: removed } });
  }));

  router.post('/appointment-requests', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const providerId = typeof req.body?.provider_id === 'string' ? req.body.provider_id : '';
    check(isCanonicalId(providerId) && !!catalog.getProvider(providerId), 400, 'invalid_provider', 'Choose a reviewed independent provider.');
    const input: AppointmentRequestInput = { provider_id: providerId, idempotency_key: String(req.body?.idempotency_key || ''), consent: req.body?.consent, requested_window: req.body?.requested_window };
    const id = 'aa_req_' + hash(actor + ':' + input.idempotency_key).slice(0, 56);
    const result = await store.tx(async records => {
      await records.lock('anti-aging-appointment:' + hash(id));
      const existing = await records.get<any>('anti_aging_appointment_requests', id);
      if (existing) return existing;
      const request = buildAppointmentRequest(input, actor, id);
      await records.put('anti_aging_appointment_requests', id, request);
      return request;
    });
    res.status(202).json({ data: result });
  }));

  router.get('/appointment-requests/:id', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    check(isCanonicalId(id), 400, 'invalid_request', 'Use a valid appointment request reference.');
    const request = await store.tx(records => records.get<any>('anti_aging_appointment_requests', id));
    check(request?.actor === actor, 404, 'request_not_found', 'No appointment handoff request was found.');
    res.json({ data: request });
  }));

  return router;
}
