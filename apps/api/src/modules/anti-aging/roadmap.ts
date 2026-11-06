import { Router } from 'express';
import {
  aggregateProgress, buildAppointmentRequest, buildMerchantReferral, buildProgressControlSummary, buildProgressExportManifest, buildProgressReminder, createRegimenCycle, createRegimenCycleCheckIn, isCanonicalId, isProgressReminderCadence, isProgressStatus, isRegimenCycleCheckInStatus, isRegimenCycleFocus, previewProgressReminder, progressReminderState, snoozeProgressReminder, summarizeProgressExport, summarizeRegimenCycle, validateProgressEntry, withdrawAppointmentRequest,
  type AppointmentRequestInput, type ProgressEntry, type ProgressReminder, type RegimenCycle, type RegimenCycleCheckIn, type RegimenCycleSummary,
} from '@mgt/domain';
import { account, check, hash, wrap } from '../../portal/security';
import type { Store } from '../../portal/store';
import type { AntiAgingCatalog } from './catalog';

function actorOf(req: { actor?: unknown }): string {
  check(typeof req.actor === 'string' && req.actor.length > 0, 401, 'authentication_required', 'Sign in to use this feature.');
  return req.actor as string;
}

function missingStore(store: Store | undefined): asserts store is Store {
  check(store, 503, 'state_unavailable', 'This preview is not configured to save records yet.');
}

function publicRegimenSummary(summary: RegimenCycleSummary) {
  return {
    cycle: {
      id: summary.cycle.id,
      focus: summary.cycle.focus,
      starts_at: summary.cycle.starts_at,
      ends_at: summary.cycle.ends_at,
      status: summary.cycle.status,
      cycle_days: summary.cycle.cycle_days,
      created_at: summary.cycle.created_at,
      policy_version: summary.cycle.policy_version,
      data_shared: [],
    },
    check_ins: summary.check_ins,
    comfortable: summary.comfortable,
    no_change: summary.no_change,
    needs_review: summary.needs_review,
    days_remaining: summary.days_remaining,
    rotation_state: summary.rotation_state,
    deterministic_guidance: {
      mode: 'explain_only',
      next_step: summary.deterministic_guidance.next_step,
      routine_changes: 'never_automatic',
      note: summary.deterministic_guidance.note,
    },
    ai_boundary: {
      enabled: 'configuration_dependent',
      input: 'cycle_metadata_only',
      can_change_routine: false,
      note: summary.ai_boundary.note,
    },
    data_shared: [],
  };
}

function publicRegimenCheckIn(checkIn: RegimenCycleCheckIn) {
  return {
    id: checkIn.id,
    cycle_id: checkIn.cycle_id,
    status: checkIn.status,
    completed_at: checkIn.completed_at,
    created_at: checkIn.created_at,
    policy_version: checkIn.policy_version,
    data_shared: [],
  };
}

const validDate=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const validText=(value:unknown,max=80)=>typeof value==='string'&&value.length>0&&value.length<=max;

export function publicProgressEntry(value: unknown) {
  const entry=value&&typeof value==='object'&&!Array.isArray(value)?value as Partial<ProgressEntry>:null;
  if(!entry||typeof entry.entry_id!=='string'||!isCanonicalId(entry.entry_id)||!isProgressStatus(entry.status)||!validDate(entry.completed_at)||!validText(entry.consent_version)||!validDate(entry.created_at)||!validText(entry.policy_version))return null;
  return{entry_id:entry.entry_id,status:entry.status,completed_at:entry.completed_at,consent_version:entry.consent_version,created_at:entry.created_at,policy_version:entry.policy_version};
}

export function publicProgressReminder(value: unknown) {
  const reminder=value&&typeof value==='object'&&!Array.isArray(value)?value as Partial<ProgressReminder>:null;
  if(!reminder||typeof reminder.id!=='string'||!isCanonicalId(reminder.id)||typeof reminder.entry_id!=='string'||!isCanonicalId(reminder.entry_id)||!isProgressReminderCadence(reminder.cadence)||!validDate(reminder.next_at)||typeof reminder.paused!=='boolean'||!validText(reminder.consent_version)||!validDate(reminder.created_at)||!validDate(reminder.updated_at)||!validText(reminder.policy_version))return null;
  return{id:reminder.id,entry_id:reminder.entry_id,cadence:reminder.cadence,next_at:reminder.next_at,paused:reminder.paused,consent_version:reminder.consent_version,created_at:reminder.created_at,updated_at:reminder.updated_at,policy_version:reminder.policy_version};
}

export function publicAppointmentRequest(value: unknown) {
  const request=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,any>:null;
  if(!request||typeof request.id!=='string'||!isCanonicalId(request.id)||typeof request.provider_id!=='string'||!isCanonicalId(request.provider_id)||!['handoff_pending','partner_acknowledged','uncertain','closed'].includes(request.status)||request.consent!=='provider_handoff'||(request.requested_window!==null&&request.requested_window!==undefined&&typeof request.requested_window!=='string')||!validText(request.uncertainty,500)||!validDate(request.created_at)||!validDate(request.updated_at)||!validText(request.policy_version))return null;
  return{id:request.id,provider_id:request.provider_id,status:request.status,consent:'provider_handoff',requested_window:request.requested_window??null,data_shared:[],booking_supported:false,uncertainty:request.uncertainty,created_at:request.created_at,updated_at:request.updated_at,policy_version:request.policy_version};
}

export function antiAgingRoadmapRouter(catalog: AntiAgingCatalog, store?: Store): Router {
  const router = Router();

  const cycleActor = (req: { actor?: unknown; account?: { id?: unknown } }) => {
    const signedIn=account(req as any);
    check(typeof signedIn.id==='string'&&signedIn.id.length>0,401,'authentication_required','Sign in to synchronize your regimen cycle.');
    return signedIn.id;
  };
  const cyclesFor = async (actor:string) => store!.tx(async records => (await records.list<RegimenCycle>('regimen_cycles')).filter(item=>item.actor===actor));
  const checkInsFor = async (actor:string) => store!.tx(async records => (await records.list<RegimenCycleCheckIn>('regimen_cycle_check_ins')).filter(item=>item.actor===actor));

  router.get('/regimen-cycles', wrap(async(req,res)=>{
    missingStore(store);const actor=cycleActor(req);const cycles=(await cyclesFor(actor)).sort((a,b)=>b.starts_at.localeCompare(a.starts_at));const entries=await checkInsFor(actor);
    const summaries=cycles.slice(0,12).map(cycle=>publicRegimenSummary(summarizeRegimenCycle(cycle,entries)));
    res.json({data:{items:summaries,current:summaries.find(item=>item.rotation_state==='in_progress')||null,retention:'user_controlled',sync_scope:'signed_in_account',data_shared:[]}});
  }));

  router.post('/regimen-cycles', wrap(async(req,res)=>{
    missingStore(store);const actor=cycleActor(req);check(req.body?.consent==='regimen_cycle_tracking',400,'consent_required','A two-week regimen cycle requires purpose-specific consent.');check(isRegimenCycleFocus(req.body?.focus)&&typeof req.body?.consent_version==='string'&&/^[a-z0-9._-]{1,80}$/i.test(req.body.consent_version),400,'invalid_regimen_cycle','Choose a supported cycle focus and consent version.');
    const saved=await store.tx(async records=>{await records.lock('regimen-cycle:'+hash(actor));const existing=(await records.list<RegimenCycle>('regimen_cycles')).filter(item=>item.actor===actor).map(cycle=>summarizeRegimenCycle(cycle,[],Date.now())).find(item=>item.rotation_state==='in_progress');check(!existing,409,'regimen_cycle_active','Finish or review the current two-week cycle before starting another.');const id='cycle_'+hash(actor+':'+new Date().toISOString()).slice(0,48);const cycle=createRegimenCycle({focus:req.body.focus,consent_version:req.body.consent_version},actor,id);await records.put('regimen_cycles',id,cycle);return cycle;});
    res.status(201).json({data:publicRegimenSummary(summarizeRegimenCycle(saved,[])),sync_scope:'signed_in_account'});
  }));

  router.post('/regimen-cycles/:id/check-ins', wrap(async(req,res)=>{
    missingStore(store);const actor=cycleActor(req);const cycleId=typeof req.params.id==='string'?req.params.id:'';check(isCanonicalId(cycleId)&&isRegimenCycleCheckInStatus(req.body?.status)&&typeof req.body?.completed_at==='string'&&Number.isFinite(Date.parse(req.body.completed_at)),400,'invalid_regimen_check_in','Choose a supported check-in and timestamp.');
    const saved=await store.tx(async records=>{await records.lock('regimen-cycle:'+hash(actor+':'+cycleId));const cycle=await records.get<RegimenCycle>('regimen_cycles',cycleId);check(cycle?.actor===actor,404,'regimen_cycle_not_found','That regimen cycle is not available.');const day=new Date(Date.parse(req.body.completed_at)).toISOString().slice(0,10);const id='cycle_checkin_'+hash(actor+':'+cycleId+':'+day).slice(0,48);const entry=createRegimenCycleCheckIn({cycle_id:cycleId,status:req.body.status,completed_at:req.body.completed_at},cycle,actor,id);const existing=await records.get<RegimenCycleCheckIn>('regimen_cycle_check_ins',id);if(existing)return existing;await records.put('regimen_cycle_check_ins',id,entry);return entry;});
    res.status(202).json({data:publicRegimenCheckIn(saved),note:'A check-in records your experience only. It does not alter a routine or create a treatment record.'});
  }));

  router.get('/regimen-cycles/:id/summary', wrap(async(req,res)=>{
    missingStore(store);const actor=cycleActor(req);const cycleId=typeof req.params.id==='string'?req.params.id:'';check(isCanonicalId(cycleId),400,'invalid_regimen_cycle','Use a valid regimen cycle reference.');const cycle=await store.tx(records=>records.get<RegimenCycle>('regimen_cycles',cycleId));check(cycle?.actor===actor,404,'regimen_cycle_not_found','That regimen cycle is not available.');res.json({data:publicRegimenSummary(summarizeRegimenCycle(cycle,await checkInsFor(actor))),sync_scope:'signed_in_account'});
  }));

  router.get('/regimen-cycles/export', wrap(async(req,res)=>{
    missingStore(store);const actor=cycleActor(req);const cycles=(await cyclesFor(actor)).sort((a,b)=>b.starts_at.localeCompare(a.starts_at));const entries=await checkInsFor(actor);
    const summaries=cycles.map(cycle=>publicRegimenSummary(summarizeRegimenCycle(cycle,entries)));
    res.set({'Content-Disposition':'attachment; filename="mgt-skin-care-regimen-cycles.json"','Cache-Control':'private, no-store'}).json({data:{cycles:summaries,check_ins:entries.map(publicRegimenCheckIn),manifest:{export_format:'json',retention:'user_controlled',deletion_supported:true,external_delivery:'disabled',data_shared:[]},exported_at:new Date().toISOString(),note:'Portable personal cycle record; it is not a diagnosis or treatment record.'}});
  }));

  router.delete('/regimen-cycles', wrap(async(req,res)=>{
    missingStore(store);const actor=cycleActor(req);check(req.body?.confirm===true,400,'confirmation_required','Confirm removal of regimen cycles and check-ins.');
    const removed=await store.tx(async records=>{await records.lock('regimen-cycle:'+hash(actor));let cycles=0,checkIns=0;for(const cycle of await records.list<RegimenCycle>('regimen_cycles'))if(cycle.actor===actor){await records.remove('regimen_cycles',cycle.id);cycles++;}for(const entry of await records.list<RegimenCycleCheckIn>('regimen_cycle_check_ins'))if(entry.actor===actor){await records.remove('regimen_cycle_check_ins',entry.id);checkIns++;}return{cycles,check_ins:checkIns};});
    res.json({data:{...removed,consent_revoked:true,retention:'user_controlled',data_shared:[]}});
  }));

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
    const projected=publicProgressEntry(saved);check(projected,500,'record_unavailable','The progress record could not be returned safely.');
    res.status(202).json({ data: projected, note: 'Aggregate adherence only; no diagnostic inference is made.' });
  }));

  router.get('/progress', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const entries = await store.tx(async records => (await records.entries<ProgressEntry>('anti_aging_progress')).map(item => item.value).filter(item => item.actor === actor).map(publicProgressEntry).filter(Boolean));
    res.json({ data: { entries, aggregate: aggregateProgress(entries as ProgressEntry[]), consent_scope: 'progress_tracking' } });
  }));

  router.get('/progress/export', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const bundle = await store.tx(async records => ({
      entries: (await records.entries<ProgressEntry>('anti_aging_progress')).map(item => item.value).filter(item => item.actor === actor).map(publicProgressEntry).filter(Boolean),
      reminders: (await records.entries<ProgressReminder>('anti_aging_reminders')).map(item => item.value).filter(item => item.actor === actor).map(publicProgressReminder).filter(Boolean),
    }));
    res.setHeader('Content-Disposition', 'attachment; filename="mgt-skin-care-progress-export.json"');
    res.json({ data: { entries:bundle.entries,reminders:bundle.reminders, summary: summarizeProgressExport(bundle.entries as ProgressEntry[], bundle.reminders as ProgressReminder[]), manifest: buildProgressExportManifest(bundle.entries as ProgressEntry[], bundle.reminders as ProgressReminder[]), export_format: 'json', data_shared: [], note: 'Portable personal copy; not a diagnosis or treatment record.' } });
  }));

  router.get('/progress/export/manifest', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const bundle = await store.tx(async records => ({
      entries: (await records.entries<ProgressEntry>('anti_aging_progress')).map(item => item.value).filter(item => item.actor === actor).map(publicProgressEntry).filter(Boolean),
      reminders: (await records.entries<ProgressReminder>('anti_aging_reminders')).map(item => item.value).filter(item => item.actor === actor).map(publicProgressReminder).filter(Boolean),
    }));
    res.json({ data: buildProgressExportManifest(bundle.entries as ProgressEntry[], bundle.reminders as ProgressReminder[]) });
  }));

  router.get('/progress/export/summary', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const bundle = await store.tx(async records => ({
      entries: (await records.entries<ProgressEntry>('anti_aging_progress')).map(item => item.value).filter(item => item.actor === actor).map(publicProgressEntry).filter(Boolean),
      reminders: (await records.entries<ProgressReminder>('anti_aging_reminders')).map(item => item.value).filter(item => item.actor === actor).map(publicProgressReminder).filter(Boolean),
    }));
    res.json({ data: summarizeProgressExport(bundle.entries as ProgressEntry[], bundle.reminders as ProgressReminder[] ,), consent_scope: ['progress_tracking', 'reminders'] });
  }));

  router.get('/progress/control-summary', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const bundle = await store.tx(async records => ({
      entries: (await records.entries<ProgressEntry>('anti_aging_progress')).map(item => item.value).filter(item => item.actor === actor).map(publicProgressEntry).filter(Boolean),
      reminders: (await records.entries<ProgressReminder>('anti_aging_reminders')).map(item => item.value).filter(item => item.actor === actor).map(publicProgressReminder).filter(Boolean),
    }));
    res.json({ data: buildProgressControlSummary(bundle.entries as ProgressEntry[], bundle.reminders as ProgressReminder[]) });
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
    const reminders = await store.tx(async records => (await records.entries<ProgressReminder>('anti_aging_reminders')).map(item => item.value).filter(item => item.actor === actor).map(publicProgressReminder).filter(Boolean));
    res.json({ data: { reminders, states: reminders.reduce((summary, reminder) => { const state = progressReminderState(reminder as ProgressReminder); summary[state]++; return summary; }, { paused: 0, due: 0, scheduled: 0 } as Record<string, number>), consent_scope: 'reminders' } });
  }));

  router.get('/progress/reminders/preview', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const reminders = await store.tx(async records => (await records.entries<ProgressReminder>('anti_aging_reminders')).map(item => item.value).filter(item => item.actor === actor).map(publicProgressReminder).filter(Boolean));
    res.json({ data: { items: reminders.map(reminder => previewProgressReminder(reminder as ProgressReminder)), delivery: 'in_app_only', data_shared: [], consent_scope: 'reminders' } });
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
    const projected=publicProgressReminder(reminder);check(projected,500,'record_unavailable','The reminder could not be returned safely.');
    res.status(202).json({ data: projected });
  }));

  router.post('/progress/reminders/:id', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const action = req.body?.action;
    check(isCanonicalId(id) && (action === 'pause' || action === 'resume' || action === 'snooze'), 400, 'invalid_reminder', 'Choose pause, resume, or snooze for this reminder.');
    if (action === 'snooze') check(Number.isInteger(Number(req.body?.days)) && Number(req.body.days) >= 1 && Number(req.body.days) <= 30, 400, 'invalid_reminder', 'Choose a snooze window from 1 to 30 days.');
    const saved = await store.tx(async records => { await records.lock('anti-aging-reminder:' + hash(id)); const reminder = await records.get<ProgressReminder>('anti_aging_reminders', id); check(reminder?.actor === actor, 404, 'reminder_not_found', 'Reminder not found.'); const next = action === 'snooze' ? snoozeProgressReminder(reminder, Number(req.body?.days || 1)) : { ...reminder, paused: action === 'pause', updated_at: new Date().toISOString() }; await records.put('anti_aging_reminders', id, next); return next; });
    const projected=publicProgressReminder(saved);check(projected,500,'record_unavailable','The reminder could not be returned safely.');
    res.json({ data: projected });
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
    const projected=publicAppointmentRequest(result);check(projected,500,'record_unavailable','The appointment handoff could not be returned safely.');
    res.status(202).json({ data: projected });
  }));

  router.get('/appointment-requests', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const requests = await store.tx(async records => (await records.entries<any>('anti_aging_appointment_requests')).map(item => item.value).filter(item => item.actor === actor).map(publicAppointmentRequest).filter(Boolean));
    res.json({ data: { items: requests, data_shared: [], booking_supported: false, note: 'These are handoff requests only; no appointment is booked in this portal.' } });
  }));

  router.get('/appointment-requests/:id', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    check(isCanonicalId(id), 400, 'invalid_request', 'Use a valid appointment request reference.');
    const request = await store.tx(records => records.get<any>('anti_aging_appointment_requests', id));
    check(request?.actor === actor, 404, 'request_not_found', 'No appointment handoff request was found.');
    const projected=publicAppointmentRequest(request);check(projected,500,'record_unavailable','The appointment handoff could not be returned safely.');
    res.json({ data: projected });
  }));

  router.delete('/appointment-requests/:id', wrap(async (req, res) => {
    missingStore(store);
    const actor = actorOf(req);
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    check(isCanonicalId(id), 400, 'invalid_request', 'Use a valid appointment request reference.');
    const request = await store.tx(records => records.get<any>('anti_aging_appointment_requests', id));
    check(request?.actor === actor, 404, 'request_not_found', 'No appointment handoff request was found.');
    const withdrawn = withdrawAppointmentRequest(request);
    await store.tx(records => records.put('anti_aging_appointment_requests', id, withdrawn));
    const projected=publicAppointmentRequest(withdrawn);check(projected,500,'record_unavailable','The appointment handoff could not be returned safely.');
    res.json({ data: { ...projected, withdrawn: true } });
  }));

  return router;
}
