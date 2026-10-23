# Google Play Data safety draft

Status: engineering draft - not a store declaration and not legal advice.

This draft describes the current Android client scope. Reconcile it against the deployed API,
privacy notice, SDK inventory, analytics configuration, and final release build before submitting
the Google Play Data safety form.

| Data category | Current client behavior | Purpose | Shared with third parties | Retention / user control |
| --- | --- | --- | --- | --- |
| App activity / app interactions | Skin Match answers and completion timing are sent to the MGT API when the user completes the flow | Core app functionality and routine generation | MGT API only in the current client path | Account export and deletion controls must be verified in staging |
| Health and wellness-like information | Skin preferences, sensitivity, age band, routine level, concerns and desired outcome | Cosmetic personalization | MGT API only in the current client path | Purpose-specific consent, export and deletion controls must be verified in staging |
| Diagnostics | No crash-reporting or device-diagnostics SDK is included in the current mobile surface | None | None in the current client path | Re-check the final dependency graph |
| Photos, precise location, contacts, financial data | Not collected by the current Android surface; no optional Android permissions are requested | Not applicable | None | Do not add these without a separate privacy and store review |

Required before declaration:

1. Inventory the final release AAB and every transitive SDK.
2. Confirm the API, database, backups, retention, deletion, and export behavior in staging.
3. Confirm whether any account identifier, IP address, log record, or analytics event changes the table.
4. Confirm encryption in transit and at rest, account deletion availability, target audience, and the published privacy notice.
5. Have counsel or the accountable privacy owner approve the final answers and store listing.
