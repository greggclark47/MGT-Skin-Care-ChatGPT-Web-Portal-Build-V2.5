'use client';

import React, { useEffect, useState } from 'react';

type ProgressStatus = 'completed' | 'skipped' | 'irritation' | 'no_change';
type Reminder = { id: string; cadence: 'daily' | 'weekly'; next_at: string; paused: boolean };
type ProgressData = { entries: Array<{ entry_id: string; status: ProgressStatus; completed_at: string }>; aggregate: { entries: number; completed: number; completion_rate: number; note: string } };

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
  const [status, setStatus] = useState<ProgressStatus>('completed');
  const [cadence, setCadence] = useState<'daily' | 'weekly'>('weekly');
  const [reminderConsent, setReminderConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const result = await json<{ csrf?: string }>('/api/hub/session');
    setCsrf(result.csrf || '');
    const [progress, reminderData] = await Promise.all([json<{ data: ProgressData }>('/api/v1/progress'), json<{ data: { reminders: Reminder[] } }>('/api/v1/progress/reminders')]);
    setData(progress.data);
    setReminders(reminderData.data.reminders);
  };

  const toggleReminder = async (reminder: Reminder) => {
    setBusy(true); setMessage('');
    try { await json(`/api/v1/progress/reminders/${encodeURIComponent(reminder.id)}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ action: reminder.paused ? 'resume' : 'pause' }) }); await refresh(); setMessage(reminder.paused ? 'Reminder resumed.' : 'Reminder paused.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Reminder is temporarily unavailable.'); }
    finally { setBusy(false); }
  };

  const exportProgress = async () => {
    setBusy(true); setMessage('');
    try { await json('/api/v1/progress/export'); setMessage('A portable copy is ready to be downloaded from your account.'); }
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
    {data && <p className="anti-aging-progress-summary" role="status"><strong>{data.aggregate.completed}</strong> completed check-ins · {Math.round(data.aggregate.completion_rate * 100)}% completion rate</p>}
    {reminders.length > 0 && <div className="anti-aging-progress-reminders" aria-label="Your reminder settings"><strong>Reminder settings</strong>{reminders.map(reminder => <div key={reminder.id}><span>{reminder.cadence === 'daily' ? 'Daily' : 'Weekly'} · next {new Date(reminder.next_at).toLocaleDateString()}</span><button className="button" type="button" disabled={busy || !csrf} onClick={() => void toggleReminder(reminder)}>{reminder.paused ? 'Resume' : 'Pause'}</button></div>)}</div>}
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
