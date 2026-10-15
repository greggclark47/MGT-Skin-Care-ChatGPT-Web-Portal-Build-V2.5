'use client';
import React,{useState} from 'react';
import Link from 'next/link';
import type {MatchIntelligence} from '@mgt/domain';
import {ProductExplanationCard} from './ProductExplanation';

export function MatchIntelligencePanel({intelligence,productName}:{intelligence:MatchIntelligence;productName:(id:string)=>string}){
 const [details,setDetails]=useState(false);const coverage=intelligence.coverage;
 const confidence={strong:'Strong catalog coverage',balanced:'Balanced catalog coverage',limited:'Limited catalog coverage'}[coverage.confidence];
 const query=intelligence.retail_discovery.query_terms.slice(0,3).join(' ');
 return <section className="match-intelligence panel" aria-labelledby="match-intelligence-heading">
  <div className="row"><div><span className="eyebrow">EXPLAINABLE MATCH INTELLIGENCE</span><h2 id="match-intelligence-heading">Why these products are in your routine</h2></div><span className={'pill match-confidence '+coverage.confidence}>{confidence}</span></div>
  <p>This result is selected by reviewed safety rules and versioned scoring. AI-written text does not select or rank products.</p>
  <div className="match-coverage" role="group" aria-label="Match coverage">
   <div><strong>{coverage.required_slots_matched}/{coverage.required_slots_total}</strong><span>core steps matched</span></div>
   <div><strong>{coverage.eligible_products_considered}</strong><span>eligible products considered</span></div>
   <div><strong>{coverage.excluded_products}</strong><span>products excluded</span></div>
  </div>
  <button className="text-button" type="button" aria-expanded={details} aria-controls="match-data-points" onClick={()=>setDetails(value=>!value)}>{details?'Hide':'Review'} datapoints and method</button>
  {details&&<div id="match-data-points" className="match-data-points">
   <dl>{intelligence.data_points.map(point=><div key={point.id}><dt>{point.label}</dt><dd><strong>{point.value}</strong><span>{point.effect}</span></dd></div>)}</dl>
   <p className="muted">Engine {intelligence.version} · scoring {intelligence.scoring_engine_version} · routine {intelligence.routine_engine_version} · safety matrix {intelligence.safety_matrix_version}</p>
  </div>}
  <div className="match-product-grid">{intelligence.product_matches.map(explanation=><ProductExplanationCard key={explanation.product_id} explanation={explanation} productName={productName(explanation.product_id)}/>)}</div>
  <div className="notice"><strong>{intelligence.retail_discovery.label}</strong><p>{intelligence.retail_discovery.disclosure}</p><Link className="button" href={'/shop?segment=skincare&q='+encodeURIComponent(query)}>Explore external retailers ↗</Link></div>
  <details className="match-limitations"><summary>Important limitations</summary><ul>{intelligence.limitations.map(item=><li key={item}>{item}</li>)}</ul></details>
 </section>;
}
