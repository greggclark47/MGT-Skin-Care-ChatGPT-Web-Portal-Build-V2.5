'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { hub, useHub } from '../lib/hub';
import { AppFrame, CharacterCount, LoadState, NoProfile } from './HubFrames';

type Factor = {
  id: string;
  label: string;
  selected: boolean;
  profile_signals: string[];
  education_focus: string;
};

type ComplexionOutput = {
  active_factor_ids: string[];
  factors: Factor[];
  input_fields_used: string[];
  limitations: string[];
};

type Overview = {
  complexion: ComplexionOutput;
  analysis_permission_required: boolean;
  analysis_configured: boolean;
};

type Analysis = Overview & {
  ai_summary: {
    summary: string;
    focus_ids: string[];
    next_step: 'review_profile' | 'review_routine' | 'learn_more';
  };
  output_trace: { generated_at: string };
};

const nextStepLabel: Record<Analysis['ai_summary']['next_step'], string> = {
  review_profile: 'Review my Skin Match',
  review_routine: 'Review my routine',
  learn_more: 'Explore the learning library',
};

export function ComplexionIntelligence() {
  const overview = useHub('/complexion/overview');
  const [question, setQuestion] = useState('');
  const [permission, setPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const profileMissing = overview.error.toLowerCase().includes('complete your skin match');
  const data = overview.data as Overview | null;
  const complexion = data?.complexion;

  async function createSummary(event: React.FormEvent) {
    event.preventDefault();
    if (!permission || !data?.analysis_configured || busy) return;
    setBusy(true);
    setAnalysisError('');
    try {
      await hub('/account/consents', { consent_type: 'ai_disclosure', granted: true });
      const result = await hub('/complexion/analysis', { question: question.trim() || undefined }) as Analysis;
      setAnalysis(result);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'The private summary could not be prepared. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <AppFrame title="Complexion Intelligence">
    <p className="lead">A private way to organize complexion priorities from the Skin Match information you chose to save.</p>
    <p className="notice">Cosmetic education only. This does not identify a condition, assess severity, diagnose, prescribe, analyze photos, or promise a result.</p>

    {profileMissing ? <NoProfile /> : <LoadState {...overview} retry={overview.reload} />}

    {!overview.loading && !overview.error && complexion && <>
      <section className="panel complexion-summary" aria-labelledby="complexion-profile-output">
        <div className="section-heading">
          <div><span className="eyebrow">PRIVATE PROFILE OUTPUT</span><h2 id="complexion-profile-output">Your five complexion priorities</h2></div>
          <Link className="text-link" href="/my-skin">Update Skin Match →</Link>
        </div>
        <p>The starting point is deterministic: only your saved Skin Match fields organize the output below. A priority appears when its matching concern is in your saved profile.</p>
        <div className="complexion-factor-grid">
          {complexion.factors.map(factor => <article className={factor.selected ? 'complexion-factor is-selected' : 'complexion-factor'} key={factor.id}>
            <div className="row"><h3>{factor.label}</h3><span className="pill">{factor.selected ? 'Profile priority' : 'Available'}</span></div>
            <p>{factor.education_focus}</p>
            <ul className="list-clean">{factor.profile_signals.map(signal => <li key={signal}>{signal}</li>)}</ul>
          </article>)}
        </div>
        <div className="complexion-data-boundary">
          <strong>What this profile output uses</strong>
          <p>{complexion.input_fields_used.join(' · ')}.</p>
          <strong>What it does not use</strong>
          <p>Photos, the image journal, account name, location, payment details, and retailer activity.</p>
        </div>
      </section>

      <section className="panel complexion-ai-panel" aria-labelledby="complexion-ai-title">
        <span className="eyebrow">OPTIONAL AI EXPLANATION</span>
        <h2 id="complexion-ai-title">Ask for a bounded private summary.</h2>
        <p>The analysis service receives the deterministic profile output and your optional cosmetic question. It cannot change your routine, select products, contact a retailer, or book care.</p>
        {!data.analysis_configured && <p className="notice">The private analysis service is awaiting configuration. Your deterministic profile output remains available above.</p>}
        <form className="stack" onSubmit={createSummary} aria-busy={busy}>
          <label className="field">Optional cosmetic skincare question
            <textarea maxLength={500} value={question} disabled={busy || !data.analysis_configured} aria-describedby="complexion-question-count" placeholder="For example: Which saved priorities should I review first?" onChange={event => { setQuestion(event.target.value); setAnalysisError(''); }} />
          </label>
          <CharacterCount id="complexion-question-count" current={question.length} max={500} />
          <label className="check-label"><input type="checkbox" checked={permission} disabled={busy || !data.analysis_configured} onChange={event => { setPermission(event.target.checked); setAnalysisError(''); }} />Allow the platform analysis service to process this private profile output and optional question.</label>
          {analysisError && <p className="notice error" role="alert">{analysisError}</p>}
          <button className="button primary" type="submit" disabled={busy || !permission || !data.analysis_configured}>{busy ? 'Preparing and verifying…' : 'Create private AI summary'}</button>
        </form>
      </section>

      {analysis && <section className="panel complexion-ai-result" aria-labelledby="complexion-summary-title" tabIndex={-1}>
        <span className="eyebrow">VERIFIED AI SUMMARY</span>
        <h2 id="complexion-summary-title">Your review context</h2>
        <p>{analysis.ai_summary.summary}</p>
        <div className="mini-tags">{analysis.ai_summary.focus_ids.map(id => {
          const factor = analysis.complexion.factors.find(item => item.id === id);
          return <span key={id}>{factor?.label || id}</span>;
        })}</div>
        <p className="notice">Suggested next step: {nextStepLabel[analysis.ai_summary.next_step]}. This is an explanation only; no changes were made to your account, routine, or retailer activity.</p>
        <small>Generated {new Date(analysis.output_trace.generated_at).toLocaleString()} · private profile context used</small>
      </section>}

      <section className="complexion-limits" aria-labelledby="complexion-limits-title">
        <span className="eyebrow">SAFETY BOUNDARIES</span>
        <h2 id="complexion-limits-title">Always within clear limits.</h2>
        <ul>{complexion.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
      </section>
    </>}
  </AppFrame>;
}
