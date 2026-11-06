'use client';

import React, { useEffect, useState } from 'react';

type ProgressStatus = 'completed' | 'skipped' | 'irritation' | 'no_change';
type Reminder = { id: string; cadence: 'daily' | 'weekly'; next_at: string; paused: boolean; state?: 'paused' | 'due' | 'scheduled' };
type ProgressData = { entries: Array<{ entry_id: string; status: ProgressStatus; completed_at: string }>; aggregate: { entries: number; completed: number; completion_rate: number; note: string } };
type ExportSummary = { entries: number; reminders: number; completed: number; paused_reminders: number; next_reminder_at: string | null; data_shared: []; note: string };
type ControlSummary = { manifest: { retention: 'user_controlled'; deletion_supported: true; external_delivery: 'disabled' }; reminders: Array<{ delivery: 'in_app_only'; next_action: string }>; deletion_supported: true; data_shared: [] };

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Progress is temporarily unavailable.');
  return data as T;
}
export function AntiAgingProgressPanel() {
  const [csrf, setCsrf] = useState('');
  const [data, setData] = useState<ProgressData | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [exportSummary, setExportSummary] = useState<ExportSummary | null>(null);
  const [controlSummary, setControlSummary] = useState<ControlSummary | null>(null);
  const [status, setStatus] = useState<ProgressStatus>('completed');
  const [cadence, setCadence] = useState<'daily' | 'weekly'>('weekly');
  const [reminderConsent, setReminderConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const result = await json<{ csrf?: string }>('/api/hub/session');
    setCsrf(result.csrf || '');
    const [progress, reminderData, summary, controls] = await Promise.all([json<{ data: ProgressData }>('/api/v1/progress'), json<{ data: { reminders: Reminder[] } }>('/api/v1/progress/reminders'), json<{ data: ExportSummary }>('/api/v1/progress/export/summary'), json<{ data: ControlSummary }>('/api/v1/progress/control-summary')]);
    setData(progress.data);
    setReminders(reminderData.data.reminders);
    setExportSummary(summary.data);
    setControlSummary(controls.data);
  };

  const snoozeReminder = async (reminder: Reminder) => {
    setBusy(true); setMessage('');
    try { await json(`/api/v1/progress/reminders/${encodeURIComponent(reminder.id)}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ action: 'snooze', days: 1 }) }); await refresh(); setMessage('Reminder snoozed for one day.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Reminder is temporarily unavailable.'); }
    finally { setBusy(false); }
  };

  const toggleReminder = async (reminder: Reminder) => {
    setBusy(true); setMessage('');
    try { await json(`/api/v1/progress/reminders/${encodeURIComponent(reminder.id)}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ action: reminder.paused ? 'resume' : 'pause' }) }); await refresh(); setMessage(reminder.paused ? 'Reminder resumed.' : 'Reminder paused.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Reminder is temporarily unavailable.'); }
    finally { setBusy(false); }
  };

  const exportProgress = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/v1/progress/export', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) { const data = await response.json(); throw new Error(data?.error?.message || 'Export is temporarily unavailable.'); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'mgt-skin-care-progress-export.json'; link.click(); URL.revokeObjectURL(url);
      setMessage('Your portable copy was downloaded.');
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Export is temporarily unavailable.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh().catch(error => setMessage(error instanceof Error ? error.message : 'Progress is temporarily unavailable.')); }, []);

  const save = async () => {
    setBusy(true); setMessage('');
    try {
      await json('/api/v1/progress', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ consent: 'progress_tracking', entry_id: 'anti-aging-check-in', status, completed_at: new Date().toISOString(), consent_version: 'anti-aging-progress-1' }) });
      if (reminderConsent) await json('/api/v1/progress/reminders', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ consent: 'reminders', entry_id: 'anti-aging-check-in', cadence, days_from_now: cadence === 'daily' ? 1 : 7, consent_version: 'anti-aging-reminders-1' }) });
      await refresh(); setMessage(reminderConsent ? 'Your check-in and optional reminder were saved.' : 'Your check-in was saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Progress is temporarily unavailable.'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm('Remove your anti-aging progress records and reminders?')) return;
    setBusy(true); setMessage('');
    try { await json('/api/v1/progress', { method: 'DELETE', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ confirm: true }) }); await refresh(); setMessage('Progress records and reminders were removed.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Progress is temporarily unavailable.'); }
    finally { setBusy(false); }
  };

  return <section className="panel anti-aging-progress" aria-labelledby="anti-aging-progress-heading" aria-busy={busy}>
    <div className="section-heading"><div><span className="eyebrow">OPTIONAL CHECK-IN</span><h2 id="anti-aging-progress-heading">Keep a gentle record</h2></div><span className="pill">Private by default</span></div>
    <p>Track whether a routine step felt comfortable. This is an adherence note, not a measure of health or treatment response.</p>
    <p className="anti-aging-progress-summary"><strong>Personal controls:</strong> Your export stays actor-scoped; nothing shared. You can pause or snooze reminders at any time.</p>
    {data && <p className="anti-aging-progress-summary" role="status"><strong>{data.aggregate.completed}</strong> completed check-ins · {Math.round(data.aggregate.completion_rate * 100)}% completion rate</p>}
    {exportSummary && <p className="anti-aging-progress-summary" role="status"><strong>Current export:</strong> {exportSummary.entries} entries · {exportSummary.reminders} reminders · {exportSummary.paused_reminders} paused</p>}
    {controlSummary && <p className="anti-aging-progress-summary" role="status"><strong>Control summary:</strong> user-controlled retention · deletion available · in-app delivery only</p>}
    {reminders.length > 0 && <div className="anti-aging-progress-reminders" aria-label="Your reminder settings"><strong>Reminder settings</strong>{reminders.map(reminder => <div key={reminder.id}><span>{reminder.cadence === 'daily' ? 'Daily' : 'Weekly'} · {reminder.state === 'due' ? 'due now' : `next ${new Date(reminder.next_at).toLocaleDateString()}`}</span><button className="button" type="button" disabled={busy || !csrf} onClick={() => void toggleReminder(reminder)}>{reminder.paused ? 'Resume' : 'Pause'}</button>{!reminder.paused && <button className="button" type="button" disabled={busy || !csrf} onClick={() => void snoozeReminder(reminder)}>Snooze 1 day</button>}</div>)}</div>}
    <div className="anti-aging-progress-controls">
      <label className="field">Today felt
        <select value={status} onChange={event => setStatus(event.target.value as ProgressStatus)}><option value="completed">Comfortable</option><option value="no_change">No change</option><option value="irritation">Irritated</option><option value="skipped">Skipped</option></select>
      </label>
      <label className="check-label"><input type="checkbox" checked={reminderConsent} onChange={event => setReminderConsent(event.target.checked)} />Also remind me {cadence === 'daily' ? 'daily' : 'weekly'}</label>
      {reminderConsent && <label className="field">Reminder cadence<select value={cadence} onChange={event => setCadence(event.target.value as 'daily' | 'weekly')}><option value="weekly">Weekly</option><option value="daily">Daily</option></select></label>}
    </div>
    <div className="actions"><button className="button primary" type="button" disabled={busy || !csrf} onClick={() => void save()}>Save check-in</button><button className="button" type="button" disabled={busy || !csrf} onClick={() => void exportProgress()}>Prepare my export</button><button className="button" type="button" disabled={busy || !csrf} onClick={() => void remove()}>Remove my records</button></div>
    {message && <p className="notice" role="status">{message}</p>}
  </section>;
}
