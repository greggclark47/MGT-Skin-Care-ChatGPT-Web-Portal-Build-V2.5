'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { IngredientRecord, ProductRecord, ProviderRecord, TreatmentRecord } from '@mgt/domain';
import { AppFrame, LoadState } from './HubFrames';

type Mode = 'ingredients' | 'products' | 'treatments' | 'providers';
type RecordItem = IngredientRecord | ProductRecord | TreatmentRecord | ProviderRecord;
type ListPayload<T> = { data: { items: T[]; next_cursor: string | null }; meta: { disclaimer: string; mode: string } };

async function read<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'The discovery library is temporarily unavailable.');
  return data as T;
}

export function AntiAgingExplorer() {
  const [mode, setMode] = useState<Mode>('ingredients');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [routinePreview, setRoutinePreview] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any>(null);
  const [goals, setGoals] = useState<string[]>(['visible_signs_of_aging']);
  const [sensitivity, setSensitivity] = useState('mild');
  const [consent, setConsent] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const response = await read<ListPayload<RecordItem>>(`/api/v1/${mode}?limit=20${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ''}`);
      setItems(response.data.items);
    } catch (e) { setItems([]); setError(e instanceof Error ? e.message : 'The discovery library is temporarily unavailable.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const products = useMemo(() => items.filter((item): item is ProductRecord => mode === 'products' && 'ingredient_ids' in item), [items, mode]);
  const toggleProduct = (id: string) => setSelectedProducts(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 6 ? [...current, id] : current);
  const previewRoutine = async () => {
    if (!selectedProducts.length) return;
    try {
      setRoutinePreview(await read(`/api/v1/routines/preview?product_ids=${selectedProducts.join(',')}&avoid_ingredient_ids=&sensitivity=${sensitivity}`));
    } catch (e) { setError(e instanceof Error ? e.message : 'Routine preview unavailable.'); }
  };
  const previewOnboarding = async () => {
    try {
      const consentQuery = consent ? '&consent=personalization' : '';
      setOnboarding(await read(`/api/v1/onboarding/preview?goals=${goals.join(',')}&sensitivity=${sensitivity}${consentQuery}`));
    } catch (e) { setError(e instanceof Error ? e.message : 'Onboarding preview unavailable.'); }
  };

  return <AppFrame title="The Anti-Aging Edit">
    <p className="lead">Explore reviewed education, sample products, and independent provider destinations at your own pace.</p>
    <p className="notice">This is a discovery tool, not a diagnosis or treatment plan. Nothing here is purchased, booked, or saved without a separate, explicit flow.</p>

    <section className="panel anti-aging-onboarding" aria-labelledby="anti-aging-start">
      <span className="eyebrow">START WITH YOUR INTENT</span><h2 id="anti-aging-start">A calmer way to begin.</h2>
      <div className="filters" aria-label="Anti-aging goals">
        {['visible_signs_of_aging', 'texture', 'brightening', 'barrier_support', 'antioxidant_education'].map(goal => <button key={goal} className="button small" type="button" aria-pressed={goals.includes(goal)} onClick={() => setGoals(current => current.includes(goal) ? current.filter(item => item !== goal) : current.length < 3 ? [...current, goal] : current)}>{goal.replace(/_/g, ' ')}</button>)}
      </div>
      <div className="anti-aging-start-grid">
        <label className="field">Skin sensitivity
          <select value={sensitivity} onChange={event => setSensitivity(event.target.value)}><option value="none">No known sensitivity</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="high">High</option></select>
        </label>
        <label className="check-label"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />Allow optional personalization preview</label>
      </div>
      <button className="button primary" type="button" disabled={!goals.length} onClick={() => void previewOnboarding()}>Preview my starting point</button>
      {onboarding && <div className="notice success" role="status"><strong>{onboarding.data.status === 'ready' ? 'Personalization is ready for review.' : 'Browsing stays private by default.'}</strong><p>{onboarding.data.safety_notes[1]} {onboarding.data.safety_notes[2]}</p></div>}
    </section>

    <section aria-labelledby="anti-aging-library">
      <div className="section-heading"><div><span className="eyebrow">REVIEWED DISCOVERY</span><h2 id="anti-aging-library">Browse the library</h2></div><Link className="text-link" href="/learn">Read our approach ↗</Link></div>
      <div className="filters" role="tablist" aria-label="Discovery categories">{(['ingredients', 'products', 'treatments', 'providers'] as Mode[]).map(item => <button key={item} className="button small" type="button" role="tab" aria-selected={mode === item} onClick={() => { setMode(item); setRoutinePreview(null); }}>{item}</button>)}</div>
      <label className="field">Search this category<input type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void load(); }} placeholder="Try retinol, texture, or New York" /></label>
      <LoadState loading={loading} error={error} retry={() => void load()} />
      {!loading && !error && <div className="anti-aging-grid">{items.map(item => <article className="panel anti-aging-card" key={item.id}>
        <div className="row"><span className="eyebrow">{item.evidence_level} evidence</span><span className="pill">{item.provenance.reviewed_status}</span></div>
        <h3>{item.name}</h3>
        {'educational_summary' in item && <><p>{item.educational_summary}</p><ul>{item.compatibility_notes.map(note => <li key={note}>{note}</li>)}</ul></>}
        {'description' in item && <p>{item.description}</p>}
        {'ingredient_ids' in item && <><p>{item.brand} · {item.category} · {item.price_band.replace(/_/g, ' ')}</p><label className="check-label"><input type="checkbox" checked={selectedProducts.includes(item.id)} onChange={() => toggleProduct(item.id)} />Include in routine preview</label><small>Sample metadata only; no purchase or retailer order is created.</small></>}
        {'provider_type' in item && <><p>{item.provider_type.replace(/_/g, ' ')} · {item.city}, {item.region}</p><p className="notice">Independent external destination. No profile data is shared and live booking is unavailable.</p><a className="button small" href={item.website_url} target="_blank" rel="noopener noreferrer">Visit provider destination ↗</a></>}
        <small>Source reviewed {new Date(item.provenance.observed_at).toLocaleDateString()}</small>
      </article>)}</div>}
      {mode === 'products' && selectedProducts.length > 0 && <section className="panel" aria-labelledby="routine-preview"><div className="row"><div><span className="eyebrow">DETERMINISTIC PREVIEW</span><h2 id="routine-preview">See how these steps could fit</h2></div><button className="button primary" type="button" onClick={() => void previewRoutine()}>Preview routine</button></div>{routinePreview && <div className="routine-preview-list">{routinePreview.data.steps.map((step: any) => <div className="bag-row" key={step.product_id}><div><strong>{step.order}. {step.product_name}</strong><p>{step.time.toUpperCase()} · {step.category}{step.cautions.length ? ` · ${step.cautions.join(' ')}` : ''}</p></div></div>)}<p className="notice">{routinePreview.data.safety_notes.join(' ')}</p></div>}</section>}
    </section>
  </AppFrame>;
}
