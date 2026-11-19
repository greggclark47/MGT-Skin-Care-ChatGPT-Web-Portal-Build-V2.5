# Team 47 Studio — Lifecycle Messages

**Version 1.0 · 2026-11-15 · For the lifecycle agent and anyone sending member email, SMS or push** · Companion to the marketing packet (voice §2, copy bank §3, claims rules §4) and the cost addendum v2.2 §11.5 (what the lifecycle agent carries)

> **Status: PRELIMINARY — pending full release.** Prepared for review ahead of any execution. Decisions, routes, wording and figures are subject to change before work begins; nothing here is final until the owner releases it. The trial messages depend on owner decision O-7.

Every template here is written in the packet voice: warm, plain, specific, one idea per line, "you" not "users". Every message passes the claims rules in marketing §4: fit and method, never outcome; no "accurate"; no timing claims; no before-and-after; invented brands only until clearance. Transactional messages carry no marketing; marketing messages carry a working opt-out and are sent only with recorded consent, per Terms clause 7.

**Variables.** `{first}` first name or "there" · `{plan}` Starter / Guided / Studio · `{price}` `$14.99/mo` or `$149.90/yr` as chosen · `{trial_end}` e.g. Nov 29, 2026 · `{season}` colour season · `{routine_step}` a named step · `{product}` an invented catalogue name · `{manage_url}` account billing page · `{cancel_url}` one-click cancel · `{support_url}` care centre.

**Footer, every email.** Guidance for looking and feeling your best — cosmetic, not medical. Results differ from person to person. · Manage membership · Privacy & Terms · © 2026 Team 47 Studio — MGT Solutions, Inc. Marketing emails add: You are receiving this because you opted in on {date}. Unsubscribe.

---

## 1. Message map

| # | Trigger | Channel | Class | Window | Agent may send without approval? |
|---|---|---|---|---|---|
| L-01 | Starter account created | Email | Transactional | Immediately | Yes |
| L-02 | Trial started (card verified, $0) | Email | Transactional | Immediately | Yes |
| L-03 | Trial day 3, no routine opened | Email + push | Service nudge | Day 3, 10:00 local | Yes |
| L-04 | Trial day 10 | Email | Service nudge | Day 10 | Yes |
| L-05 | Trial ends in 3 days (T−3) | Email + SMS if consented | Transactional, required | T−3 days, 09:00 local | Yes — must send |
| L-06 | Trial converted, first charge | Email | Transactional, receipt | On webhook `invoice.paid` | Yes |
| L-07 | Trial cancelled before charge | Email | Transactional | On cancel | Yes |
| L-08 | Paid member cancelled | Email | Transactional | On cancel | Yes |
| L-09 | Renewal reminder, annual | Email | Transactional, required | 30 days before renewal | Yes — must send |
| L-10 | Payment failed | Email | Transactional | On `invoice.payment_failed`, then day 3, day 7 | Yes |
| L-11 | Replenishment: a step runs low | Push or email | Service nudge, Guided+ | When the routine's estimate reaches ~10 days | Yes |
| L-12 | Win-back, 30 days after cancel | Email | Marketing | Day 30, once | Draft only; owner approves the batch |
| L-13 | Starter, 14 days in, no upgrade | Email | Marketing | Day 14, once | Draft only; owner approves the batch |

Send-time rule: no email before 08:00 or after 20:00 in the member's time zone. Push only between 09:00 and 19:00. SMS only for L-05 and only where SMS consent is recorded separately (Terms 7.2).

---

## 2. Templates

### L-01 · Welcome to Starter

**Subject:** Your profile is saved, {first}.
**Preview:** A season, a starter routine, and nothing to pay.

Hi {first},

Your profile is saved. Here is what is open to you now:

- Your colour season: **{season}**, read from the swatches you chose.
- A starter routine, with the reason for each step.
- Shade-range and ingredient checks on every product we show you.

Starter is free to keep. No card, no clock.

If you want routines that update as your skin and season change, Guided is $14.99 a month, or try it for 14 days first.

**See my routine** → {app_url}

---

### L-02 · Your Guided trial has started

**Subject:** Guided is open. Nothing charged today.
**Preview:** Your trial runs to {trial_end}. Here is what happens then.

Hi {first},

Everything in Guided is open now: personalised routines, your progress journal, the AI Coach, and your colour carried into makeup, hair and wardrobe.

Three things so there are no surprises:

1. Nothing was charged today. Your card was checked, not billed.
2. Your trial ends on **{trial_end}**. We will remind you three days before.
3. If you do nothing, Guided continues at **{price}** from {trial_end}. If you cancel before then, you pay nothing and keep Starter.

Cancel any time, yourself, here: {cancel_url}

**Open my routine** → {app_url}

*You gave separate consent to automatic renewal at checkout on {consent_date}. A copy of that text is in your account.*

---

### L-03 · Day 3, routine not opened

**Subject:** Your routine is waiting, {first}.
**Preview:** Six steps, in order, with the reason for each.

**Push (≤ 90 characters):** Your routine is ready: {routine_step} first, and why. Open when you have two minutes.

Hi {first},

Your routine is built and nothing has been started yet, which is fine. Two minutes is enough to read it.

It starts with **{routine_step}**, and it says why that comes first for your profile.

If something in it does not fit, tell the Coach. It will name what it used and what it left out.

**Open my routine** → {app_url}

*Trial ends {trial_end}. Cancel any time: {cancel_url}*

---

### L-04 · Day 10

**Subject:** Four days left. Here is what you have.
**Preview:** A plain summary of your trial so far.

Hi {first},

Four days of your trial are left. Here is where things stand, in your own numbers:

- Routine opened **{opens}** times; **{steps_done}** steps logged.
- Coach answered **{coach_turns}** questions.
- Colour carried into **{verticals_used}**.

If Guided is earning its place, there is nothing to do; it continues at {price} on {trial_end}.
If it is not, cancel here and keep Starter: {cancel_url}

Either answer is fine with us.

---

### L-05 · Three days before the first charge (required)

**Subject:** Your Guided trial ends {trial_end}. {price} after that.
**Preview:** This is the reminder we promised. Cancel in one tap if you want to.

**SMS (if consented, ≤ 160 characters):** Team 47 Studio: your Guided trial ends {trial_end}. After that it is {price} until you cancel. Cancel any time: {cancel_url}. Reply STOP to opt out of texts.

Hi {first},

Your 14-day Guided trial ends on **{trial_end}**.

If you keep it, your card ending {last4} will be charged **{price}** on that date, and Guided renews {cycle_word} until you cancel.

If you would rather not, cancel here before {trial_end} and you will not be charged: {cancel_url}
You keep Starter either way, and nothing you built is lost.

Questions about billing: {support_url}

---

### L-06 · First charge receipt

**Subject:** Receipt: Guided, {price}
**Preview:** Paid {amount} on {date}. Next renewal {next_date}.

Hi {first},

Thank you. Your Guided membership is active.

| | |
|---|---|
| Plan | Guided, {cycle_word} |
| Charged | {amount} on {date} to card ending {last4} |
| Next renewal | {next_date} |
| Reference | {ref} |

Change or cancel your plan any time: {manage_url}

---

### L-07 · Trial cancelled, nothing charged

**Subject:** Cancelled. Nothing was charged.
**Preview:** You are on Starter, and it is yours to keep.

Hi {first},

Your Guided trial is cancelled and your card was not charged.

You are on Starter: your profile, your season and your starter routine stay exactly as they were.

If Guided suits you later, it is $14.99 a month. The trial was once per person, so it will not be offered again, and we will not keep asking.

---

### L-08 · Paid membership cancelled

**Subject:** Cancelled. Access runs to {period_end}.
**Preview:** No further charges. Here is what stays.

Hi {first},

Your {plan} membership is cancelled. There will be no further charges.

You keep {plan} until **{period_end}**, the end of the period you already paid for. After that you move to Starter, and your profile, season and routine history stay with you.

If this was a mistake, you can restore the plan before {period_end}: {manage_url}

---

### L-09 · Annual renewal, 30 days out (required)

**Subject:** Your annual {plan} renews {next_date}
**Preview:** {price} on {next_date} unless you change it before then.

Hi {first},

Your annual {plan} membership renews on **{next_date}** at **{price}**, charged to card ending {last4}.

Nothing to do if you want it to continue. To change the plan or cancel before then: {manage_url}

---

### L-10 · Payment failed

**Subject:** We could not take your {plan} payment
**Preview:** Update your card and nothing is interrupted.

Hi {first},

The {price} payment for {plan} did not go through on card ending {last4}.

We will try again on {retry_date}. To fix it sooner, update your card here: {manage_url}

If we cannot collect by {grace_end}, {plan} features pause and you move to Starter. Nothing is deleted.

---

### L-11 · Replenishment nudge (Guided and Studio)

**Push (≤ 90 characters):** {product} in your {routine_step} step runs low in about 10 days. Shop it, or snooze.

**Email subject:** {product} runs low in about ten days.

Hi {first},

Based on the pace you logged, **{product}** in your {routine_step} step runs out in about ten days.

Reorder from the retailer you chose, or swap it for something else that passes your checks: {shop_url}

Not using it any more? Mark it done and we stop reminding you: {routine_url}

*The estimate comes from your own logged use. It is a nudge, not a rule.*

---

### L-12 · Win-back, 30 days after cancelling (marketing, owner approves)

**Subject:** Your profile is still here, {first}.
**Preview:** Nothing was lost. Come back when it suits you.

Hi {first},

It has been a month since you left {plan}. Your profile, your season and your routine history are still here; Starter kept them.

If what you wanted was a routine that keeps up with you, Guided is $14.99 a month, or $149.90 a year with two months free.

No pressure from us either way.

**See what is new** → {app_url}

*Unsubscribe from messages like this: {unsub_url}*

---

### L-13 · Starter, day 14, no upgrade (marketing, owner approves)

**Subject:** Two weeks in. Here is what Guided would add.
**Preview:** Routines that update, a journal, and the Coach, from $12.49 a month on annual.

Hi {first},

Two weeks on Starter. Here is the honest difference Guided makes for a profile like yours:

- Your routine refreshes every two weeks instead of staying fixed.
- Progress history and a photo journal, so change is something you can see.
- The AI Coach, which names what it used and what it left out.

$14.99 a month, or try 14 days first with nothing charged today.

**Try Guided for 14 days** → {trial_url}

*Unsubscribe from messages like this: {unsub_url}*

---

## 3. Agent instruction (paste into the lifecycle agent's system prompt)

You draft and send Team 47 Studio member messages from the templates in LIFECYCLE-MESSAGES-v1.0.md. Rules you cannot override:

1. Transactional messages (L-01, L-02, L-05 to L-11) send on their trigger without approval. L-05 and L-09 are required by the Terms and must never be skipped or delayed past their window.
2. Marketing messages (L-12, L-13) are drafted into the approval queue. Never send one yourself. Never send a marketing message to anyone without a recorded marketing consent for that channel.
3. Fill variables only from the member record and the billing webhook. If a variable is missing, do not guess; hold the message and raise it.
4. Do not alter template wording except to fill variables. If a template does not fit the situation, raise it; do not improvise copy.
5. Every outgoing message is checked against the claims rules: no outcome words (clears, repairs, reduces, heals, treats), no "accurate" or "precise", no timing claims, no before-and-after, no real brand names. If a product name in the catalogue fails the check, hold the message.
6. Never mention a skin condition, a diagnosis or a medical term. If a member's reply does, route it to a person and send only the care centre link.
7. Quiet hours and channel rules in §1 apply in the member's own time zone.
8. Log every send with template id, variables used, consent reference and timestamp.

---

## 4. Open before these go live

| Item | Needs |
|---|---|
| O-7 | Owner approval of the trial; L-02 to L-07 depend on it |
| C-5 / N-6 | Production consent ledger that L-02 and L-05 read `{consent_date}` from |
| Counsel | Confirm L-05's T−3 reminder and L-09's 30-day notice meet the auto-renewal notice rules in each launch state, and FTC click-to-cancel; the cancel link is one click with no retention screen |
| SMS | Separate SMS consent capture and STOP handling before L-05 SMS is enabled |
| Email provider | None selected; send-time and quiet-hour logic assumes one that supports member time zones |
