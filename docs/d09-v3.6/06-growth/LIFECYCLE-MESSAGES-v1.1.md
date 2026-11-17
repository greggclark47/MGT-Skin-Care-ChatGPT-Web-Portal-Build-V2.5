# Team 47 Studio — Lifecycle Messages

**Version 1.1 · 2026-11-16 · For the lifecycle agent and anyone sending member email, SMS or push** · Companion to the marketing packet (voice §2, copy bank §3, claims rules §4) and cost addendum v2.3 §11.5 · v1.1: two plans since 2026-11-16; the sequence now follows the 14-day trial on Guided or Studio (day 0, 3, 7, 11, 14); renewal reminder two days before every charge; cancel and payment-failure paths end in "no plan", not a free tier

> **Status: PRELIMINARY — pending full release.** Prepared for review ahead of any execution. Decisions, routes, wording and figures are subject to change before work begins; nothing here is final until the owner releases it. The trial messages depend on owner decision O-7; notice timing depends on counsel item C-10.

Every template is written in the packet voice: warm, plain, specific, one idea per line, "you" not "users". Every message passes the claims rules in marketing §4: fit and method, never outcome; no "accurate"; no timing claims; no before-and-after; invented brands only until clearance. Transactional messages carry no marketing. Marketing messages carry a working opt-out and are sent only with recorded consent (Terms clause 7).

**Variables.** `{first}` first name or "there" · `{plan}` Guided or Studio · `{price}` e.g. `$29.99/mo`, `$89.97/qtr`, `$299.90/yr` · `{cycle_word}` monthly / quarterly / yearly · `{trial_end}` e.g. Dec 1, 2026 · `{season}` colour season from the intake · `{routine_step}` a named step · `{product}` an invented catalogue name · `{trial_url}` Your trial page · `{manage_url}` account billing · `{cancel_url}` one-step cancel · `{support_url}` care centre · `{last4}` card ending.

**Footer, every email.** Guidance for looking and feeling your best — cosmetic, not medical. Results differ from person to person. · Manage membership · Privacy & Terms · © 2026 Team 47 Studio — MGT Solutions, Inc. Marketing emails add: You are receiving this because you opted in on {date}. Unsubscribe.

---

## 1. Message map

| # | Trigger | Channel | Class | Window | Agent may send without approval? |
|---|---|---|---|---|---|
| L-01 | Account created, trial not yet started | Email | Transactional | Immediately | Yes |
| L-02 | Trial started (card verified, $0) — acknowledgment | Email + in-app | Transactional, required | Immediately | Yes — must send |
| L-03 | Trial day 3 check-in | Email + push | Service nudge | Day 3, 10:00 local | Yes |
| L-04 | Trial day 7, halfway review | Email | Service nudge | Day 7, 10:00 local | Yes |
| L-05 | Trial ends in 3 days (day 11) | Email + in-app + web banner; SMS if consented | Transactional, required, cannot be switched off | Day 11, 09:00 local | Yes — must send |
| L-06 | Trial converted, first charge (day 14) | Email | Transactional, receipt | On webhook `invoice.paid` | Yes |
| L-07 | Trial cancelled before the charge | Email | Transactional | On cancel | Yes |
| L-08 | Paid membership cancelled | Email | Transactional | On cancel | Yes |
| L-09 | Annual renewal notice | Email | Transactional, required | 30 days before an annual renewal | Yes — must send |
| L-10 | Renewal in two days (every paid cycle) | In-app + web banner; email if the member chose it | Service, on by default, member can switch off | Two days before each charge | Yes |
| L-11 | Payment failed | Email | Transactional | On `invoice.payment_failed`, then day 3, day 7 | Yes |
| L-12 | Replenishment: a step runs low | Push or email | Service nudge | When the routine's estimate reaches ~10 days | Yes |
| L-13 | Win-back, 30 days after cancel | Email | Marketing | Day 30, once | Draft only; owner approves the batch |
| L-14 | Preview saved, trial not started, 24 hours on | Email | Marketing | Once, 24 h after L-01 | Draft only; owner approves the batch |

Send-time rule: no email before 08:00 or after 20:00 in the member's time zone. Push only between 09:00 and 19:00. SMS only for L-05 and only where SMS consent is recorded separately (Terms 7.2).

---

## 2. Templates

### L-01 · Account created, preview saved

**Subject:** Your studio preview is saved, {first}.
**Preview:** Your answers, your season and your first Coach note are kept.

Hi {first},

Your account is set up and your studio preview is saved:

- Colour season, as a starting point: **{season}**.
- A {steps}-step routine sized to the time you gave us.
- Your ingredient ceiling, which every product we show you is checked against.

Your trial starts when you add a card. Nothing is charged for 14 days, and you can cancel in one step.

**Continue to my trial** → {trial_url}

---

### L-02 · Your trial has started (acknowledgment, required)

**Subject:** {plan} is open. Nothing charged today.
**Preview:** Your trial runs to {trial_end}. Here is exactly what happens.

Hi {first},

Everything in {plan} is open now.

So there are no surprises:

1. **Today:** nothing was charged. Your card was checked, not billed.
2. **Day 3 and day 7:** short check-ins on your routine and season.
3. **Day 11:** a reminder that your trial ends in three days.
4. **{trial_end}:** {plan} starts at **{price}** and renews {cycle_word} until you cancel.

**How to cancel:** open Your trial and choose Cancel my trial, any time before {trial_end}. One step, nothing charged: {cancel_url}

**Open my studio** → {app_url}

*You agreed to automatic renewal separately at checkout on {consent_date}. A copy of that text is in your account.*

---

### L-03 · Day 3 check-in

**Subject:** Day 3: your routine, refined.
**Preview:** What we adjusted from how your first days went.

**Push (≤ 90 characters):** Day 3: {routine_step} comes first for you, and here is why. Two minutes.

Hi {first},

Three days in. Your routine starts with **{routine_step}**, and the routine says why that comes first for your profile.

If you have not opened it yet, two minutes is enough. If something does not fit, tell the Coach; it names what it used and what it left out.

**Open my routine** → {app_url}

*Trial ends {trial_end}. Cancel any time: {cancel_url}*

---

### L-04 · Day 7, halfway review

**Subject:** Halfway. Here is what you have used.
**Preview:** A plain summary in your own numbers.

Hi {first},

You are halfway through your trial. Here is where things stand:

- Routine opened **{opens}** times; **{steps_done}** steps logged.
- Coach answered **{coach_turns}** questions.
- Checklist: **{checklist_done} of 5** done.

{plan_fit_line}

Want a different plan after the trial? You can switch between Guided and Studio, or change the billing cycle, in Your trial before {trial_end}: {trial_url}

*Trial ends {trial_end}. Cancel any time: {cancel_url}*

`{plan_fit_line}` is filled from a fixed pair only. Guided member who used three or more areas: "You used three areas this week. Studio reasons across them together, if that would help." Everyone else: "Nothing to change; your plan fits how you are using it."

---

### L-05 · Three days before the first charge (required, cannot be switched off)

**Subject:** Your {plan} trial ends {trial_end}. {price} after that.
**Preview:** This is the reminder we promised. Cancel in one step if you want to.

**SMS (if consented, ≤ 160 characters):** Team 47 Studio: your {plan} trial ends {trial_end}. Then {price} until you cancel. Cancel any time: {cancel_url}. Reply STOP to opt out of texts.

**In-app and web banner:** Your {plan} trial ends on {trial_end}. {plan} starts at {price} unless you cancel, which takes one step.

Hi {first},

Your 14-day {plan} trial ends on **{trial_end}**.

If you keep it, your card ending {last4} will be charged **{price}** on that date, and {plan} renews {cycle_word} until you cancel.

If you would rather not, cancel here before {trial_end} and you will not be charged: {cancel_url}

Your account, your answers and your preview stay either way.

Questions about billing: {support_url}

---

### L-06 · First charge receipt (day 14)

**Subject:** Receipt: {plan}, {price}
**Preview:** Paid {amount} on {date}. Next renewal {next_date}.

Hi {first},

Thank you. Your {plan} membership is active.

| | |
|---|---|
| Plan | {plan}, {cycle_word} |
| Charged | {amount} on {date} to card ending {last4} |
| Next renewal | {next_date} |
| Renewal reminder | Two days before, in the app and your account (switch it off in Notifications) |
| Reference | {ref} |

Change the plan, the billing cycle or cancel any time: {manage_url}

---

### L-07 · Trial cancelled, nothing charged

**Subject:** Cancelled. Nothing will be charged.
**Preview:** {plan} stays open until {trial_end}.

Hi {first},

Your {plan} trial is cancelled and your card will not be charged.

{plan} stays open until **{trial_end}**. After that your account stays, with your answers and your preview, and member features pause. Nothing is deleted unless you ask us to.

The trial was once per person, so it will not be offered again, and we will not keep asking. If you want Guided or Studio later, it is in Membership.

---

### L-08 · Paid membership cancelled

**Subject:** Cancelled. Access runs to {period_end}.
**Preview:** No further charges. Here is what stays.

Hi {first},

Your {plan} membership is cancelled. There will be no further charges.

You keep {plan} until **{period_end}**, the end of the period you already paid for. After that your account and profile stay, your routine history is kept, and member features pause.

If this was a mistake, restore the plan before {period_end}: {manage_url}

---

### L-09 · Annual renewal, 30 days out (required)

**Subject:** Your annual {plan} renews {next_date}
**Preview:** {price} on {next_date} unless you change it before then.

Hi {first},

Your annual {plan} membership renews on **{next_date}** at **{price}**, charged to card ending {last4}.

Nothing to do if you want it to continue. To change the plan or cancel before then: {manage_url}

---

### L-10 · Renewal in two days (every paid cycle; on by default)

**In-app and web banner:** Your {plan} membership renews on {next_date} at {price}. Nothing to do if that suits you. · Manage · Dismiss

**Email (only if the member turned on email for this):**
**Subject:** {plan} renews in two days
Hi {first}, your {plan} membership renews on **{next_date}** at **{price}**. To change the plan or cycle, or to cancel, use {manage_url}.

*Switch these reminders off in Notifications, on the web or in the app. One switch covers both. This does not affect L-05 or L-09.*

---

### L-11 · Payment failed

**Subject:** We could not take your {plan} payment
**Preview:** Update your card and nothing is interrupted.

Hi {first},

The {price} payment for {plan} did not go through on card ending {last4}.

We will try again on {retry_date}. To fix it sooner, update your card here: {manage_url}

If we cannot collect by {grace_end}, {plan} features pause. Your account and profile stay, and nothing is deleted.

---

### L-12 · Replenishment nudge (Guided and Studio)

**Push (≤ 90 characters):** {product} in your {routine_step} step runs low in about 10 days. Shop it, or snooze.

**Email subject:** {product} runs low in about ten days.

Hi {first},

Based on the pace you logged, **{product}** in your {routine_step} step runs out in about ten days.

Reorder from the retailer you chose, or swap it for something else that passes your checks: {shop_url}

Not using it any more? Mark it done and we stop reminding you: {routine_url}

*The estimate comes from your own logged use. It is a nudge, not a rule.*

---

### L-13 · Win-back, 30 days after cancelling (marketing, owner approves)

**Subject:** Your profile is still here, {first}.
**Preview:** Nothing was lost. Come back when it suits you.

Hi {first},

It has been a month since you left {plan}. Your profile, your season and your routine history are still here.

Guided is $14.99 a month and Studio $29.99, or annual with two months free. Your trial has been used, so either one starts from the first charge.

No pressure from us either way.

**See plans** → {plans_url}

*Unsubscribe from messages like this: {unsub_url}*

---

### L-14 · Preview saved, trial not started (marketing, owner approves)

**Subject:** Your studio preview is still saved.
**Preview:** 14 days free on Guided or Studio, when you are ready.

Hi {first},

Your preview is still here: **{season}**, a {steps}-step routine and your first Coach note.

If you want to try it, 14 days of {recommended_plan} costs nothing today. The reminder comes on day 11, and you can cancel in one step.

**Start my 14-day trial** → {trial_url}

*Unsubscribe from messages like this: {unsub_url}*

---

## 3. Agent instruction (paste into the lifecycle agent's system prompt)

You draft and send Team 47 Studio member messages from the templates in LIFECYCLE-MESSAGES-v1.1.md. Rules you cannot override:

1. Transactional and service messages (L-01 to L-12) send on their trigger without approval. L-02, L-05 and L-09 are required and must never be skipped, delayed past their window, or suppressed by a notification setting. L-10 respects the member's renewal-reminder switch.
2. Marketing messages (L-13, L-14) are drafted into the approval queue. Never send one yourself. Never send a marketing message without a recorded marketing consent for that channel.
3. Fill variables only from the member record and the billing webhook. If a variable is missing, do not guess; hold the message and raise it.
4. Do not alter template wording except to fill variables and to choose `{plan_fit_line}` from its fixed pair. If a template does not fit the situation, raise it; do not improvise copy.
5. Every outgoing message is checked against the claims rules: no outcome words (clears, repairs, reduces, heals, treats), no "accurate" or "precise", no timing claims, no before-and-after, no real brand names. If a product name in the catalogue fails the check, hold the message.
6. Never mention a skin condition, a diagnosis or a medical term. If a member's reply does, route it to a person and send only the care centre link.
7. Never describe a free plan. There is none. The only $0 offer is the 14-day trial, always named with the price it becomes.
8. Quiet hours and channel rules in §1 apply in the member's own time zone.
9. Log every send with template id, variables used, consent reference and timestamp.

---

## 4. Open before these go live

| Item | Needs |
|---|---|
| O-7 | Owner approval of the 14-day trial as the only way in |
| C-5 / N-6 | Production consent ledger that L-02 and L-05 read `{consent_date}` from |
| C-10 | Counsel confirms the day-11 trial reminder, L-09's 30-day annual notice and L-10's two-day reminder meet each launch state's automatic-renewal rules. California's law covers free-to-pay conversions from July 1, 2025. The cancel link is one step with no retention screen |
| SMS | Separate SMS consent capture and STOP handling before L-05 SMS is enabled |
| Email provider | None selected; send-time and quiet-hour logic assumes one that supports member time zones |
