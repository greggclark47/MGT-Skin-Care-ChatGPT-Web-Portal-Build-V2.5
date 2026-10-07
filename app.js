const products = [
  { id: 1, brand: "Dieux", name: "Deliverance Serum", type: "Serum", concern: ["Sensitivity", "Texture"], price: 69, retailer: "Credo", tone: "#c5cfc0", pack: "#f2eee3" },
  { id: 2, brand: "Prequel", name: "Gleanser", type: "Cleanser", concern: ["Dryness", "Sensitivity"], price: 18, retailer: "Dermstore", tone: "#d6d2c7", pack: "#efe9da" },
  { id: 3, brand: "Experiment", name: "Super Saturated", type: "Serum", concern: ["Dryness"], price: 28, retailer: "Credo", tone: "#d1c8bc", pack: "#ece7dc" },
  { id: 4, brand: "Tower 28", name: "SOS Daily Rescue", type: "Moisturizer", concern: ["Sensitivity"], price: 28, retailer: "Sephora", tone: "#c8d0c2", pack: "#f5f1e8" },
  { id: 5, brand: "Sofie Pavitt", name: "Mandelic Serum", type: "Serum", concern: ["Texture", "Aging"], price: 56, retailer: "Sephora", tone: "#c9c7be", pack: "#eeeae0" },
  { id: 6, brand: "Dieux", name: "Air Angel", type: "Moisturizer", concern: ["Dryness"], price: 44, retailer: "Credo", tone: "#bbc9bc", pack: "#e8e7dc" },
  { id: 7, brand: "EltaMD", name: "UV Clear SPF 46", type: "SPF", concern: ["Sensitivity", "Aging"], price: 43, retailer: "Dermstore", tone: "#d8cfc1", pack: "#f3eee5" },
  { id: 8, brand: "Skinfix", name: "Barrier+ Triple Lipid", type: "Moisturizer", concern: ["Dryness", "Sensitivity"], price: 54, retailer: "Sephora", tone: "#d0cabb", pack: "#e9e5d9" }
];

const parseSaved = () => {
  try {
    const value = JSON.parse(localStorage.getItem("mgt-saved") || "[]");
    return Array.isArray(value) ? value.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
};

const state = {
  retailer: "All retailers",
  filters: { concern: new Set(), type: new Set() },
  price: 120,
  saved: new Set(parseSaved()),
  compare: new Set(),
  deletionScheduled: false,
  billing: "monthly",
  guestMode: "basic"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function persistSaved() {
  localStorage.setItem("mgt-saved", JSON.stringify([...state.saved]));
  $("#savedCount").textContent = state.saved.size;
  $("#savedTabCount").textContent = state.saved.size;
}

function getFilteredProducts() {
  let result = products.filter((product) => {
    if (state.retailer === "Saved") return state.saved.has(product.id);
    return state.retailer === "All retailers" || product.retailer === state.retailer;
  });

  for (const key of ["concern", "type"]) {
    if (!state.filters[key].size) continue;
    result = result.filter((product) => [...state.filters[key]].some((value) => (
      key === "type" ? product.type === value : product.concern.includes(value)
    )));
  }

  return result.filter((product) => product.price <= state.price);
}

function renderProducts() {
  const grid = $("#productGrid");
  let list = getFilteredProducts();
  const sort = $("#sortSelect").value;

  if (sort === "price-low") list = [...list].sort((a, b) => a.price - b.price);
  if (sort === "price-high") list = [...list].sort((a, b) => b.price - a.price);

  $("#resultCount").textContent = `${list.length} product${list.length === 1 ? "" : "s"}`;
  grid.innerHTML = list.map((product) => `
    <article class="product-card">
      <div class="product-image" style="--tone:${product.tone};--pack:${product.pack}">
        <span class="label">${product.brand}<br>${product.type}</span>
        <button class="save-button ${state.saved.has(product.id) ? "saved" : ""}" data-save="${product.id}" type="button" aria-label="${state.saved.has(product.id) ? "Remove" : "Save"} ${product.name}">
          ${state.saved.has(product.id) ? "♥" : "♡"}
        </button>
        <button class="compare-button ${state.compare.has(product.id) ? "selected" : ""}" data-compare="${product.id}" type="button">
          ${state.compare.has(product.id) ? "✓ Comparing" : "+ Compare"}
        </button>
      </div>
      <div class="product-info">
        <div class="product-brand">${product.brand}</div>
        <div class="product-name">${product.name}</div>
        <div class="product-bottom"><span class="product-retailer">${product.retailer}</span><span>$${product.price}</span></div>
      </div>
    </article>
  `).join("");

  $("#emptyState").hidden = Boolean(list.length);
  $("#activeFilters").innerHTML = [...state.filters.concern, ...state.filters.type].map((value) => `
    <span class="filter-chip">${value}<button data-remove="${value}" type="button" aria-label="Remove ${value} filter">×</button></span>
  `).join("");
  $("#priceValue").textContent = `$${state.price}`;
  $("#compareTray").hidden = !state.compare.size;
  $("#compareCount").textContent = state.compare.size;
  document.body.classList.toggle("has-compare", Boolean(state.compare.size));
  persistSaved();
}

let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function resetFilters() {
  state.filters.concern.clear();
  state.filters.type.clear();
  state.price = 120;
  $("#priceRange").value = 120;
  $$('input[type="checkbox"]').forEach((input) => { input.checked = false; });
  renderProducts();
}

function activateConsolePanel(name) {
  $$(".console-tab").forEach((button) => {
    const isActive = button.dataset.panel === name;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
  $$("[data-console-panel]").forEach((panel) => {
    const isActive = panel.dataset.consolePanel === name;
    panel.hidden = !isActive;
    panel.classList.toggle("active", isActive);
  });
}

function activateEvidenceFilter(filter) {
  $$('[data-evidence-filter]').forEach((button) => {
    const active = button.dataset.evidenceFilter === filter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $$('[data-evidence-status]').forEach((row) => {
    row.hidden = filter !== 'all' && row.dataset.evidenceStatus !== filter;
  });
}

function updateDeletionDemo() {
  state.deletionScheduled = !state.deletionScheduled;
  $("#deletionState").hidden = !state.deletionScheduled;
  $("#deleteActionCopy").firstChild.textContent = state.deletionScheduled ? "Cancel scheduled deletion" : "Schedule account deletion";
  $("#deleteActionDetail").textContent = state.deletionScheduled ? "Keep this demo profile active" : "30-day recovery window";
  $("#deleteActionIcon").textContent = state.deletionScheduled ? "×" : "→";
  showToast(state.deletionScheduled ? "Demo deletion scheduled — no real account was changed" : "Demo deletion cancelled");
}

const membershipPlans = [
  {
    id: "free",
    name: "Free",
    audience: "Core tools for a clear skincare starting point.",
    price: "$0",
    billing: "No recurring charge",
    features: ["Skin Match and saved profile", "Core routine planning", "Reviewed skincare education"],
    action: "Explore Free",
    popular: false
  },
  {
    id: "premium",
    name: "Premium",
    audience: "Connected guidance for an ongoing care routine.",
    price: "Price pending approval",
    billing: "One product · approved monthly or annual rate",
    features: ["Personalized ongoing routine guidance", "Premium Skin Coach guidance with safeguards", "One trusted guest invitation"],
    action: "Preview Premium",
    popular: true
  }
];

function renderPricing() {
  const grid = $("#pricingGrid");
  if (!grid) return;
  grid.innerHTML = membershipPlans.map((plan) => {
    const billingNote = plan.id === "premium"
      ? `${state.billing === "annual" ? "Annual" : "Monthly"} billing · ${plan.billing}`
      : plan.billing;
    return `<article class="pricing-card${plan.popular ? " popular" : ""}">
      ${plan.popular ? '<span class="popular-badge">ONE PAID MEMBERSHIP</span>' : ""}
      <p class="pricing-tier">${plan.name}</p>
      <h3>${plan.audience}</h3>
      <p class="price"><span>${plan.price}</span></p>
      <p class="billing-note">${billingNote}</p>
      <button class="${plan.popular ? "primary-button" : "secondary-button"} plan-button" data-pricing-action="select" data-tier="${plan.id}" type="button">${plan.action} <span>→</span></button>
      <ul class="plan-feature-list">${plan.features.map((feature) => `<li>${feature}</li>`).join("")}</ul>
      <p class="upgrade-note"><b>${plan.id === "premium" ? "Enrollment gate:" : "Access boundary:"}</b> ${plan.id === "premium" ? "Disabled until approved pricing, terms, support, and signed-event verification are complete." : "No billing customer or subscription is created."}</p>
    </article>`;
  }).join("");
}

const demoFlows = {
  "Skin Match": {
    kicker: "SKIN MATCH · SAMPLE FLOW",
    title: "Find a calmer starting point",
    step: "Step 1 of 2 · Choose sample priorities",
    body: `
      <p class="flow-intro">Choose one or more priorities. The production portal combines these with sensitivities, preferences, and approved product data.</p>
      <div class="flow-options">
        <label class="flow-option"><input type="checkbox" name="match-concern" value="Barrier support" checked> Barrier support</label>
        <label class="flow-option"><input type="checkbox" name="match-concern" value="Sensitivity"> Sensitivity</label>
        <label class="flow-option"><input type="checkbox" name="match-concern" value="Texture"> Texture</label>
        <label class="flow-option"><input type="checkbox" name="match-concern" value="Fine lines"> Fine lines</label>
      </div>
      <button class="flow-action" data-flow-action="match" type="button">Create sample match <span>→</span></button>
    `
  },
  "Routine Builder": {
    kicker: "ROUTINE BUILDER · SAMPLE FLOW",
    title: "A simple barrier-first routine",
    step: "Sample routine · Compatibility checked",
    body: `
      <p class="flow-intro">The deterministic routine engine orders products first. Our analysis engine explains the result without changing safety rules.</p>
      <div class="routine-preview">
        <div><b>AM 01</b><span>Prequel Gleanser</span><small>Daily</small></div>
        <div><b>AM 02</b><span>Dieux Deliverance Serum</span><small>Daily</small></div>
        <div><b>AM 03</b><span>EltaMD UV Clear SPF 46</span><small>Daily</small></div>
        <div><b>PM 01</b><span>Skinfix Barrier+ Triple Lipid</span><small>Daily</small></div>
      </div>
      <button class="flow-action" data-flow-action="routine" type="button">Explain this routine <span>→</span></button>
    `
  },
  "Care Coach": {
    kicker: "CARE COACH · SAMPLE FLOW",
    title: "Ask a routine question",
    step: "Private platform routing · Sample only",
    body: `
      <p class="flow-intro">Try a sample question. This demo simulates the guidance flow and does not send your text outside this demonstration.</p>
      <textarea class="coach-input" id="coachQuestion" aria-label="Care Coach question">How should I simplify my routine when my skin feels irritated?</textarea>
      <button class="flow-action" data-flow-action="coach" type="button">Route sample question <span>→</span></button>
    `
  },
  "Data export": {
    kicker: "ACCOUNT DATA · SAMPLE FLOW",
    title: "Review a portable export",
    step: "Preview only · No personal data",
    body: `
      <p class="flow-intro">Production exports require a verified session. This preview contains sample fields only.</p>
      <pre class="export-preview">{
  "profile": { "displayName": "Alex Morgan" },
  "skinGoals": ["barrier support"],
  "savedProducts": ["Deliverance Serum"],
  "routine": { "morning": 3, "evening": 1 },
  "deletionRequest": null
}</pre>
      <button class="flow-action" data-flow-action="export" type="button">Prepare demo export <span>↓</span></button>
    `
  },
  "Release evidence": {
    kicker: "RELEASE EVIDENCE · SAMPLE VIEW",
    title: "A clear handoff, not a guess",
    step: "Verified locally · Live validation remains separate",
    body: `
      <p class="flow-intro">This sample shows the release evidence recorded before a build moves forward. It keeps local verification separate from real production approval.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Portal release gate</span><small>Passed locally</small></div>
        <div><b>02</b><span>Public artifact scan</span><small>Clear</small></div>
        <div><b>03</b><span>Continuous verification</span><small>Configured for reviews and main updates</small></div>
        <div><b>04</b><span>Live environment</span><small>Still requires credentials, service checks, and restore evidence</small></div>
      </div>
      <div class="flow-result"><span>RELEASE STATUS</span><h3>Ready for reviewed integration</h3><p>The source can move through review with recorded local evidence. Deployment stays blocked until the live environment proves its own readiness.</p><div class="flow-meta"><span>LOCAL EVIDENCE</span><span>NO LIVE CLAIMS</span><span>REVIEW REQUIRED</span></div></div>
    `
  },
  "Ship packet": {
    kicker: "SHIP PACKET · SAMPLE FLOW",
    title: "A release handoff with no hidden gaps",
    step: "F111–F120 · Draft packet preview",
    body: `
      <p class="flow-intro">The generator captures the exact candidate and local evidence paths, then leaves owners, approvals, live evidence, rollback, and monitoring for accountable reviewers.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Candidate identity</span><small>Branch + commit captured</small></div>
        <div><b>02</b><span>Evidence map</span><small>Phase-bound references required</small></div>
        <div><b>03</b><span>Approval quorum</span><small>Five launch roles pending</small></div>
        <div><b>04</b><span>Publish decision</span><small>Blocked until readiness passes</small></div>
      </div>
      <div class="flow-result"><span>DEMO PACKET STATUS</span><h3>Drafted, not approved</h3><p>This preview contains sample records only. A completed packet must match the deployment image digests, carry reviewed evidence, name a rollback target, and pass the live readiness gate.</p><div class="flow-meta"><span>SECRET-FREE DRAFT</span><span>FAIL-CLOSED</span><span>HUMAN REVIEW</span></div></div>
    `
  },
  "Launch monitoring": {
    kicker: "LAUNCH WATCH · SAMPLE FLOW",
    title: "Keep the first week observable",
    step: "F106–F108 · Monitoring preview",
    body: `
      <p class="flow-intro">A real launch needs named owners, a staffed incident path, and evidence at each watch point. This preview contains no live alerts or operational credentials.</p>
      <div class="routine-preview">
        <div><b>15M</b><span>Edge + health checks</span><small>Owner pending</small></div>
        <div><b>1H</b><span>Errors + support queue</span><small>Owner pending</small></div>
        <div><b>24H</b><span>Data + billing review</span><small>Owner pending</small></div>
        <div><b>7D</b><span>Closeout + rollback review</span><small>Owner pending</small></div>
      </div>
      <div class="flow-result"><span>DEMO MONITORING STATUS</span><h3>Defined, not staffed</h3><p>The cadence is ready for accountable owners and live incident references. No monitoring subscription, alert, or rollback action was created by this demo.</p><div class="flow-meta"><span>FOUR WATCH POINTS</span><span>NO LIVE ALERTS</span><span>OWNER REQUIRED</span></div></div>
    `
  },
  "Launch plan": {
    kicker: "LAUNCH PLAN · SAMPLE FLOW",
    title: "Make the decision visible",
    step: "F136–F145 · Launch handoff preview",
    body: `
      <p class="flow-intro">A launch plan turns monitoring, incident response, rollback, and closeout into named handoff work. This preview is a sample record and cannot approve a release.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Incident path</span><small>Owner + channel pending</small></div>
        <div><b>02</b><span>Rollback rehearsal</span><small>Previous release pending</small></div>
        <div><b>03</b><span>Known issues</span><small>Customer impact review pending</small></div>
        <div><b>04</b><span>Closeout</span><small>Seven-day owner pending</small></div>
      </div>
      <div class="flow-result"><span>DEMO LAUNCH DECISION</span><h3>Hold publication</h3><p>The sample plan remains incomplete until live configuration, accountable ownership, rollback evidence, and staffed monitoring are reviewed.</p><div class="flow-meta"><span>NO APPROVAL ACTION</span><span>ROLLBACK VISIBLE</span><span>HUMAN DECISION</span></div></div>
    `
  },
  "Release decision": {
    kicker: "RELEASE DECISION · SAMPLE FLOW",
    title: "Record the decision without guessing",
    step: "F146–F160 · Closeout preview",
    body: `
      <p class="flow-intro">A decision record links the candidate, approvals, rollback evidence, and closeout owner. This sample remains a hold and cannot approve or publish a release.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Candidate</span><small>F160 local evidence</small></div>
        <div><b>02</b><span>Approvals</span><small>Five roles pending</small></div>
        <div><b>03</b><span>Rollback</span><small>Rehearsal pending</small></div>
        <div><b>04</b><span>Closeout</span><small>Seven-day owner pending</small></div>
      </div>
      <div class="flow-result"><span>DEMO DECISION STATUS</span><h3>Hold · incomplete</h3><p>The record is ready for human review only. No approval, deployment, notification, or closeout record was created by this demo.</p><div class="flow-meta"><span>LOGGED SAMPLE</span><span>NO LIVE MUTATION</span><span>HUMAN REVIEW</span></div></div>
    `
  },
  "Publish readiness": {
    kicker: "PUBLISH READINESS · SAMPLE FLOW",
    title: "Prepare the package, keep publishing blocked",
    step: "F161–F175 · Publish review preview",
    body: `
      <p class="flow-intro">The publish package gathers local evidence, live blockers, owner signoff, support readiness, and rollback authorization. This sample cannot deploy or notify anyone.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local candidate</span><small>F175 packaged</small></div>
        <div><b>02</b><span>Live evidence</span><small>Missing</small></div>
        <div><b>03</b><span>Owner signoff</span><small>Incomplete</small></div>
        <div><b>04</b><span>Rollback authorization</span><small>Pending</small></div>
      </div>
      <div class="flow-result"><span>DEMO PUBLISH STATUS</span><h3>Blocked · no publish</h3><p>The package is ready to review only. No deployment, customer notification, traffic change, credential action, or release closeout was performed by this demo.</p><div class="flow-meta"><span>REVIEW PACKAGE</span><span>NO DEPLOYMENT</span><span>OWNER SIGNOFF REQUIRED</span></div></div>
    `
  },
  "Staging readiness": {
    kicker: "STAGING READINESS · SAMPLE FLOW",
    title: "Rehearse the release without promoting it",
    step: "F176–F190 · Staging review preview",
    body: `
      <p class="flow-intro">A staging rehearsal needs a real deployment URL, immutable image digests, restore evidence, assistive-technology validation, and operator coverage. This sample creates none of those records.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local source</span><small>F190 verified</small></div>
        <div><b>02</b><span>Deployment proof</span><small>Missing</small></div>
        <div><b>03</b><span>Data restore</span><small>Missing</small></div>
        <div><b>04</b><span>Operator rehearsal</span><small>Pending</small></div>
      </div>
      <div class="flow-result"><span>DEMO STAGING STATUS</span><h3>Blocked · no staging</h3><p>The rehearsal checklist is ready for review only. No staging environment, credential connection, data seed, traffic promotion, alert, or rollback action was created by this demo.</p><div class="flow-meta"><span>REHEARSAL PACKAGE</span><span>NO TRAFFIC CHANGE</span><span>LIVE EVIDENCE REQUIRED</span></div></div>
    `
  },
  "Production handoff": {
    kicker: "PRODUCTION HANDOFF · SAMPLE FLOW",
    title: "Hold cutover until the real evidence exists",
    step: "F191–F205 · Go-live handoff preview",
    body: `
      <p class="flow-intro">A production handoff needs reviewed edge routing, credential ownership, data restoration, observability, support coverage, accessibility proof, and rollback authority. This preview cannot touch live systems.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local package</span><small>F205 verified</small></div>
        <div><b>02</b><span>DNS + edge</span><small>Missing</small></div>
        <div><b>03</b><span>Secrets + data</span><small>Missing</small></div>
        <div><b>04</b><span>Support + rollback</span><small>Pending</small></div>
      </div>
      <div class="flow-result"><span>DEMO PRODUCTION STATUS</span><h3>Blocked · no production</h3><p>The handoff is ready for review only. No DNS change, credential connection, deployment, enrollment, customer traffic, alert, rollback, approval, or production publication was performed by this demo.</p><div class="flow-meta"><span>GO-LIVE PACKAGE</span><span>NO CUSTOMER TRAFFIC</span><span>CUTOVER BLOCKED</span></div></div>
    `
  },
  "Launch exception": {
    kicker: "LAUNCH EXCEPTION · SAMPLE FLOW",
    title: "Make overrides explicit and rare",
    step: "F206–F220 · Exception review preview",
    body: `
      <p class="flow-intro">A launch exception needs named authority, a narrow scope, accepted risk, expiry, mitigation, rollback evidence, and a closeout owner. This sample cannot override a blocked gate.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local package</span><small>F220 verified</small></div>
        <div><b>02</b><span>Authority</span><small>Missing</small></div>
        <div><b>03</b><span>Risk scope</span><small>Pending</small></div>
        <div><b>04</b><span>Rollback + expiry</span><small>Missing</small></div>
      </div>
      <div class="flow-result"><span>DEMO EXCEPTION STATUS</span><h3>Denied · no exception</h3><p>The exception record is ready for review only. No launch block was overridden, no approval was created, no customer traffic changed, and no release was published by this demo.</p><div class="flow-meta"><span>NO OVERRIDE</span><span>OWNER REQUIRED</span><span>TIME-BOXED RISK</span></div></div>
    `
  },
  "Post-launch review": {
    kicker: "POST-LAUNCH REVIEW · SAMPLE FLOW",
    title: "Close the loop only after live evidence exists",
    step: "F221–F235 · Closeout review preview",
    body: `
      <p class="flow-intro">A closeout record needs monitoring, support, data, accessibility, rollback and customer-impact evidence. This sample cannot close a release or claim a launch happened.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local package</span><small>F235 verified</small></div>
        <div><b>02</b><span>Launch evidence</span><small>Missing</small></div>
        <div><b>03</b><span>Customer impact</span><small>Pending</small></div>
        <div><b>04</b><span>Final decision</span><small>Blocked</small></div>
      </div>
      <div class="flow-result"><span>DEMO CLOSEOUT STATUS</span><h3>Blocked · no closeout</h3><p>The closeout record is ready for review only. No live launch was claimed, no incident was resolved, no rollback decision was made, and no release was closed by this demo.</p><div class="flow-meta"><span>NO LIVE CLAIM</span><span>OWNER REVIEW REQUIRED</span><span>CLOSEOUT BLOCKED</span></div></div>
    `
  },
  "Evidence archive": {
    kicker: "EVIDENCE ARCHIVE · SAMPLE FLOW",
    title: "Keep the release record durable",
    step: "F236–F255 · Archive review preview",
    body: `
      <p class="flow-intro">An evidence archive needs reviewed release, exception, closeout, retention, integrity and audit references. This sample cannot mark production evidence complete or create a durable archive.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local package</span><small>F255 verified</small></div>
        <div><b>02</b><span>Retention owner</span><small>Missing</small></div>
        <div><b>03</b><span>Evidence index</span><small>Incomplete</small></div>
        <div><b>04</b><span>Audit freeze</span><small>Blocked</small></div>
      </div>
      <div class="flow-result"><span>DEMO ARCHIVE STATUS</span><h3>Blocked · no archive</h3><p>The archive package is ready for review only. No live evidence was frozen, no immutable archive was created, no retention owner was assigned, and no audit handoff was completed by this demo.</p><div class="flow-meta"><span>NO ARCHIVE CLAIM</span><span>RETENTION OWNER REQUIRED</span><span>AUDIT BLOCKED</span></div></div>
    `
  },
  "Audit remediation": {
    kicker: "AUDIT REMEDIATION · SAMPLE FLOW",
    title: "Turn blockers into accountable follow-up",
    step: "F256–F275 · Remediation review preview",
    body: `
      <p class="flow-intro">A remediation register needs owners, due dates, severity, retest evidence, residual-risk notes and reviewer closure. This sample cannot fix findings or close audit work.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local package</span><small>F275 verified</small></div>
        <div><b>02</b><span>Owner assignment</span><small>Missing</small></div>
        <div><b>03</b><span>Retest evidence</span><small>Pending</small></div>
        <div><b>04</b><span>Reviewer closure</span><small>Blocked</small></div>
      </div>
      <div class="flow-result"><span>DEMO REMEDIATION STATUS</span><h3>Blocked · no closure</h3><p>The remediation register is ready for review only. No finding was fixed, no owner was assigned, no retest evidence was accepted, and no audit item was closed by this demo.</p><div class="flow-meta"><span>NO FIX CLAIM</span><span>OWNER REQUIRED</span><span>CLOSURE BLOCKED</span></div></div>
    `
  },
  "Governance review": {
    kicker: "GOVERNANCE REVIEW · SAMPLE FLOW",
    title: "Hold the final decision until every owner is present",
    step: "F276–F295 · Governance review preview",
    body: `
      <p class="flow-intro">A governance review needs quorum, risk disposition, remediation evidence, customer-impact review and a final go/hold/rollback decision. This sample cannot approve launch or accept risk.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local package</span><small>F295 verified</small></div>
        <div><b>02</b><span>Decision quorum</span><small>Incomplete</small></div>
        <div><b>03</b><span>Risk disposition</span><small>Pending</small></div>
        <div><b>04</b><span>Proceed criteria</span><small>Blocked</small></div>
      </div>
      <div class="flow-result"><span>DEMO GOVERNANCE STATUS</span><h3>Blocked · no decision</h3><p>The governance record is ready for review only. No risk was accepted, no decision quorum was met, no launch was approved, and no release decision was made by this demo.</p><div class="flow-meta"><span>NO APPROVAL CLAIM</span><span>QUORUM REQUIRED</span><span>DECISION BLOCKED</span></div></div>
    `
  },
  "Release council": {
    kicker: "RELEASE COUNCIL · SAMPLE FLOW",
    title: "Record council readiness without forcing an outcome",
    step: "F296–F315 · Council review preview",
    body: `
      <p class="flow-intro">A release council needs required attendance, reviewed evidence, role-level votes, minutes, action owners and a follow-up date. This sample cannot record a release outcome.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local package</span><small>F315 verified</small></div>
        <div><b>02</b><span>Attendance</span><small>Incomplete</small></div>
        <div><b>03</b><span>Decision record</span><small>Missing</small></div>
        <div><b>04</b><span>Minutes + actions</span><small>Blocked</small></div>
      </div>
      <div class="flow-result"><span>DEMO COUNCIL STATUS</span><h3>Blocked · no outcome</h3><p>The council record is ready for review only. No attendance quorum was met, no vote was captured, no minutes were approved, and no release outcome was recorded by this demo.</p><div class="flow-meta"><span>NO OUTCOME CLAIM</span><span>COUNCIL REQUIRED</span><span>FOLLOW-UP BLOCKED</span></div></div>
    `
  },
  "Executive signoff": {
    kicker: "EXECUTIVE SIGNOFF · SAMPLE FLOW",
    title: "Keep final authorization accountable",
    step: "F316–F335 · Executive signoff preview",
    body: `
      <p class="flow-intro">Executive signoff needs sponsor authority, business readiness, rollback ownership, publication controls and a signed decision. This sample cannot authorize launch.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local package</span><small>F335 verified</small></div>
        <div><b>02</b><span>Sponsor authority</span><small>Missing</small></div>
        <div><b>03</b><span>Business readiness</span><small>Pending</small></div>
        <div><b>04</b><span>Authorization record</span><small>Blocked</small></div>
      </div>
      <div class="flow-result"><span>DEMO SIGNOFF STATUS</span><h3>Blocked · no signoff</h3><p>The signoff record is ready for review only. No sponsor was assigned, no business readiness was accepted, no rollback authority was granted, and no executive authorization was recorded by this demo.</p><div class="flow-meta"><span>NO AUTHORIZATION CLAIM</span><span>SPONSOR REQUIRED</span><span>SIGNOFF BLOCKED</span></div></div>
    `
  },
  "Publication authorization": {
    kicker: "PUBLICATION AUTHORIZATION · SAMPLE FLOW",
    title: "Keep publish action explicitly authorized",
    step: "F336–F355 · Publication authorization preview",
    body: `
      <p class="flow-intro">Publication authorization needs a named owner, command path, approved timing, rollback watch and audit capture before any publish action can run. This sample cannot publish the release.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local package</span><small>F355 verified</small></div>
        <div><b>02</b><span>Publish owner</span><small>Missing</small></div>
        <div><b>03</b><span>Release window</span><small>Pending</small></div>
        <div><b>04</b><span>Authorization</span><small>Blocked</small></div>
      </div>
      <div class="flow-result"><span>DEMO PUBLICATION STATUS</span><h3>Blocked · no authorization</h3><p>The publication record is ready for review only. No publish owner was assigned, no command was enabled, no publication timing was approved, and no publication was executed by this demo.</p><div class="flow-meta"><span>NO PUBLICATION CLAIM</span><span>OWNER REQUIRED</span><span>AUTHORIZATION BLOCKED</span></div></div>
    `
  },
  "Production finalization": {
    kicker: "PRODUCTION FINALIZATION · SAMPLE FLOW",
    title: "Finish pre and post-production evidence without claiming release",
    step: "F356–F375 · Production finalization preview",
    body: `
      <p class="flow-intro">Production finalization needs live pre-production evidence, cutover rehearsal, first-hour watch and closeout proof before the release can be considered publishable. This sample cannot finalize production.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local package</span><small>F375 verified</small></div>
        <div><b>02</b><span>Pre-production proof</span><small>Missing</small></div>
        <div><b>03</b><span>Post-production watch</span><small>Pending</small></div>
        <div><b>04</b><span>Final closeout</span><small>Blocked</small></div>
      </div>
      <div class="flow-result"><span>DEMO FINALIZATION STATUS</span><h3>Blocked · no finalization</h3><p>The finalization record is ready for review only. No live preflight was supplied, no cutover was rehearsed, no first-hour watch was completed, and no post-production closeout was recorded by this demo.</p><div class="flow-meta"><span>NO FINALIZATION CLAIM</span><span>LIVE EVIDENCE REQUIRED</span><span>CLOSEOUT BLOCKED</span></div></div>
    `
  },
  "Operational acceptance": {
    kicker: "OPERATIONAL ACCEPTANCE · SAMPLE FLOW",
    title: "Collect owner acceptance without opening production",
    step: "F376–F395 · Operational acceptance preview",
    body: `
      <p class="flow-intro">Operational acceptance needs named owner acceptance, service readiness, risk acceptance and post-release evidence before production operation can be accepted. This sample cannot accept the release.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local package</span><small>F395 verified</small></div>
        <div><b>02</b><span>Owner acceptance</span><small>Missing</small></div>
        <div><b>03</b><span>Service readiness</span><small>Pending</small></div>
        <div><b>04</b><span>Acceptance record</span><small>Blocked</small></div>
      </div>
      <div class="flow-result"><span>DEMO ACCEPTANCE STATUS</span><h3>Blocked · no acceptance</h3><p>The acceptance record is ready for review only. No owner accepted operation, no live SLO baseline was supplied, no residual risk was accepted, and no post-release closeout was recorded by this demo.</p><div class="flow-meta"><span>NO ACCEPTANCE CLAIM</span><span>OWNERS REQUIRED</span><span>OPERATION BLOCKED</span></div></div>
    `
  },
  "Release certification": {
    kicker: "RELEASE CERTIFICATION · SAMPLE FLOW",
    title: "Prepare certification without claiming ship-ready status",
    step: "F396–F415 · Release certification preview",
    body: `
      <p class="flow-intro">Release certification needs live evidence, an approval ledger, exception disposition, archive integrity and a named certifier before any ship-ready claim can be made. This sample cannot certify the release.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local package</span><small>F415 verified</small></div>
        <div><b>02</b><span>Evidence package</span><small>Missing</small></div>
        <div><b>03</b><span>Approval ledger</span><small>Pending</small></div>
        <div><b>04</b><span>Certification</span><small>Blocked</small></div>
      </div>
      <div class="flow-result"><span>DEMO CERTIFICATION STATUS</span><h3>Blocked · no certification</h3><p>The certification package is ready for review only. No live evidence bundle was supplied, no approval ledger was completed, no exception disposition was certified, and no ship-ready record was created by this demo.</p><div class="flow-meta"><span>NO CERTIFICATION CLAIM</span><span>LIVE EVIDENCE REQUIRED</span><span>SHIP-READY BLOCKED</span></div></div>
    `
  },
  "Ship authorization": {
    kicker: "SHIP AUTHORIZATION · SAMPLE FLOW",
    title: "Prepare command authority without enabling release",
    step: "F416–F435 · Ship authorization preview",
    body: `
      <p class="flow-intro">Ship authorization needs a named owner, command approver, go-live controls, rollback command and post-ship watch before any release command can be enabled. This sample cannot authorize shipment.</p>
      <div class="routine-preview">
        <div><b>01</b><span>Local package</span><small>F435 verified</small></div>
        <div><b>02</b><span>Command authority</span><small>Missing</small></div>
        <div><b>03</b><span>Go-live controls</span><small>Pending</small></div>
        <div><b>04</b><span>Ship command</span><small>Blocked</small></div>
      </div>
      <div class="flow-result"><span>DEMO SHIP STATUS</span><h3>Blocked · no ship authorization</h3><p>The ship record is ready for review only. No ship owner was assigned, no command was enabled, no release window was approved, and no shipment was authorized by this demo.</p><div class="flow-meta"><span>NO SHIP CLAIM</span><span>COMMAND OWNER REQUIRED</span><span>RELEASE COMMAND BLOCKED</span></div></div>
    `
  }
};

function openDemoFlow(name) {
  const flow = demoFlows[name];
  if (!flow) return;
  $("#demoDialogKicker").textContent = flow.kicker;
  $("#demoDialogTitle").textContent = flow.title;
  $("#demoDialogStep").textContent = flow.step;
  $("#demoDialogBody").innerHTML = flow.body;
  const dialog = $("#demoDialog");
  if (!dialog.open) dialog.showModal();
}

function renderFlowResult(action) {
  const body = $("#demoDialogBody");
  if (action === "match") {
    const choices = $$('input[name="match-concern"]:checked').map((input) => input.value);
    if (!choices.length) {
      showToast("Choose at least one sample priority");
      return;
    }
    $("#demoDialogStep").textContent = "Step 2 of 2 · Explainable sample result";
    body.innerHTML = `<div class="flow-result"><span>TOP SAMPLE MATCH · 92% FIT</span><h3>Deliverance Serum</h3><p>Selected for ${choices.join(", ").toLowerCase()} with a low-friction place in the current routine. Production results require approved catalog evidence.</p><div class="flow-meta"><span>SCORING FIRST</span><span>PLATFORM EXPLANATION</span><span>INCLUDED GUIDANCE</span></div></div>`;
    return;
  }
  if (action === "routine") {
    $("#demoDialogStep").textContent = "Routine explanation complete";
    body.innerHTML = '<div class="flow-result"><span>ROUTINE EXPLANATION</span><h3>Keep the routine steady</h3><p>The routine separates treatment from recovery, protects the morning with SPF, and avoids adding another active while irritation is present.</p><div class="flow-meta"><span>PROPRIETARY SCORING</span><span>SAFETY RULES PRESERVED</span><span>INCLUDED GUIDANCE</span></div></div>';
    return;
  }
  if (action === "coach") {
    const question = $("#coachQuestion")?.value.trim();
    if (!question) {
      showToast("Enter a sample question first");
      return;
    }
    $("#demoDialogStep").textContent = "Guidance prepared · Sample only";
    body.innerHTML = '<div class="flow-result"><span>GUIDANCE REVIEW · SAMPLE OUTPUT</span><h3>Reduce variables for several days</h3><p>Pause optional actives, keep a gentle cleanser and familiar moisturizer, and continue sunscreen if tolerated. Seek professional guidance for persistent pain, swelling, or a severe reaction.</p><div class="flow-meta"><span>CONTEXT REVIEWED</span><span>SAFETY-AWARE</span><span>INCLUDED GUIDANCE</span></div></div>';
    return;
  }
  if (action === "export") {
    $("#demoDialogStep").textContent = "Demo export prepared";
    body.insertAdjacentHTML("beforeend", '<div class="flow-result"><span>EXPORT READY</span><h3>Sample package prepared</h3><p>No file was downloaded and no live account data was accessed in this demonstration.</p></div>');
    const button = body.querySelector('[data-flow-action="export"]');
    if (button) button.disabled = true;
  }
}

document.addEventListener("click", (event) => {
  const billingToggle = event.target.closest("[data-billing]");
  if (billingToggle) {
    state.billing = billingToggle.dataset.billing;
    $$("[data-billing]").forEach((button) => {
      const active = button === billingToggle;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderPricing();
    return;
  }

  const planChoice = event.target.closest("[data-pricing-action='select']");
  if (planChoice) {
    const plan = membershipPlans.find((item) => item.id === planChoice.dataset.tier);
    if (plan) showToast(plan.id === "premium" ? "Premium preview selected. Enrollment remains disabled until production readiness is approved." : "Free access preview selected. No billing record was created.");
    return;
  }

  const guestMode = event.target.closest("[data-guest-mode]");
  if (guestMode) {
    state.guestMode = guestMode.dataset.guestMode;
    $$(".guest-mode").forEach((button) => {
      const active = button === guestMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    $("#guestInviteState").hidden = true;
    showToast(state.guestMode === "match" ? "Shared access selected for this demo" : "Basic guest access selected for this demo");
    return;
  }

  if (event.target.closest("#guestInviteButton")) {
    const label = state.guestMode === "match" ? "Shared access" : "Basic guest";
    $("#guestInviteMode").textContent = label;
    $("#guestInviteState").hidden = false;
    showToast(`${label} invite prepared for 30 days in this demo`);
    return;
  }

  const saveButton = event.target.closest("[data-save]");
  if (saveButton) {
    const id = Number(saveButton.dataset.save);
    state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
    renderProducts();
    showToast(state.saved.has(id) ? "Saved to your edit" : "Removed from Saved");
    return;
  }

  const compareButton = event.target.closest("[data-compare]");
  if (compareButton) {
    const id = Number(compareButton.dataset.compare);
    state.compare.has(id) ? state.compare.delete(id) : state.compare.add(id);
    renderProducts();
    return;
  }

  const removeFilter = event.target.closest("[data-remove]");
  if (removeFilter) {
    for (const key of ["concern", "type"]) state.filters[key].delete(removeFilter.dataset.remove);
    $$('input[type="checkbox"]').forEach((input) => {
      if (input.value === removeFilter.dataset.remove) input.checked = false;
    });
    renderProducts();
    return;
  }

  const retailer = event.target.closest(".retailer-tab");
  if (retailer) {
    state.retailer = retailer.dataset.retailer;
    $$(".retailer-tab").forEach((button) => button.classList.toggle("active", button === retailer));
    renderProducts();
    return;
  }

  const consoleTab = event.target.closest(".console-tab");
  if (consoleTab) {
    activateConsolePanel(consoleTab.dataset.panel);
    return;
  }

  const evidenceFilter = event.target.closest('[data-evidence-filter]');
  if (evidenceFilter) {
    activateEvidenceFilter(evidenceFilter.dataset.evidenceFilter);
    return;
  }

  const demoAction = event.target.closest(".demo-action");
  if (demoAction) {
    openDemoFlow(demoAction.dataset.demo);
    return;
  }

  const flowAction = event.target.closest("[data-flow-action]");
  if (flowAction) {
    renderFlowResult(flowAction.dataset.flowAction);
    return;
  }

  if (event.target.closest("#closeDemoDialog")) {
    $("#demoDialog").close();
    return;
  }

  if (event.target.closest("#deleteAccountButton")) {
    updateDeletionDemo();
    return;
  }

  if (event.target.closest("#clearAll") || event.target.closest("#resetEmpty")) {
    resetFilters();
    return;
  }

  if (event.target.closest("#clearCompare")) {
    state.compare.clear();
    renderProducts();
    return;
  }

  if (event.target.closest("#compareButton")) {
    showToast("Comparison preview is ready for your selected products");
    return;
  }

  if (event.target.closest("#savedHeader")) {
    state.retailer = "Saved";
    $$(".retailer-tab").forEach((button) => button.classList.toggle("active", button.dataset.retailer === "Saved"));
    renderProducts();
    $("#shop").scrollIntoView({ behavior: "smooth" });
    return;
  }

  if (event.target.closest("#menuButton")) {
    const menu = $(".main-nav");
    const open = menu.classList.toggle("open");
    $("#menuButton").setAttribute("aria-expanded", String(open));
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches('input[type="checkbox"]')) {
    const set = state.filters[event.target.name];
    event.target.checked ? set.add(event.target.value) : set.delete(event.target.value);
    renderProducts();
  }
  if (event.target.id === "priceRange") {
    state.price = Number(event.target.value);
    renderProducts();
  }
  if (event.target.id === "sortSelect") renderProducts();
});

const navLinks = $$(".main-nav a");
navLinks.forEach((link) => link.addEventListener("click", () => {
  $(".main-nav").classList.remove("open");
  $("#menuButton").setAttribute("aria-expanded", "false");
}));

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`));
  }, { rootMargin: "-30% 0px -60% 0px", threshold: [0, .2, .6] });
  ["home", "applications", "flows", "plans", "shop", "operations", "account"].forEach((id) => observer.observe(document.getElementById(id)));
}

activateConsolePanel("privacy");
renderProducts();
renderPricing();
