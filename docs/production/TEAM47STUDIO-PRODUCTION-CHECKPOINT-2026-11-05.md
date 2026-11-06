# Team 47 Studio production checkpoint

Date: 2026-11-05  
Primary public origin: `https://team47studio.com`  
Public product name: **Team 47 Studio**

## Implemented in this checkpoint

- Standardized customer-facing portal, Android, accessibility, policy, support, retail and AI copy on **Team 47 Studio**.
- Wired the approved light-surface and dark-surface Team 47 Studio logo variants into the responsive web shell.
- Added the approved 1024px app icon and Android adaptive-icon foreground to the Expo configuration.
- Set the candidate mobile identity to `team-47-studio`, URL scheme `team47studio`, and application identifier `com.team47studio.app`.
- Made `https://team47studio.com` the canonical portal origin in production configuration examples.
- Added canonical metadata, Open Graph site identity, `robots.txt` generation and a production sitemap.
- Added exact Android public URL examples for the portal, API, Privacy, Terms and AI disclosure.
- Updated the interactive HTML demo to v4.416 and created `team-47-studio-end-to-end-demo.html`.

## Deliberately preserved

- Internal `@mgt/*` workspace package names, database names, event names and security header names remain unchanged. Renaming those identifiers does not improve the customer-facing release and would create avoidable migration risk.
- Existing historical evidence remains historical and is not rewritten to imply that it was produced under the new brand.
- Disabled production features remain disabled until their corresponding evidence gates pass.

## External production gates

These steps require an authorized owner or third-party system and are not represented as complete by this checkpoint:

1. Confirm ownership of `team47studio.com`, create production DNS records and approve the hosting target.
2. Issue and validate TLS for `team47studio.com`; decide whether `www.team47studio.com` redirects to the primary host.
3. Add the exact production origin and callback paths to Supabase and the Google identity provider.
4. Register `com.team47studio.app` in Google Play Console and, later, Apple Developer/App Store Connect before the identifiers become immutable.
5. Create the approved EAS project and production environment using the five values documented in `apps/mobile/.env.example`.
6. Supply production secret-manager paths and immutable container image digests; do not store secrets in GitHub or Google Drive.
7. Complete Stripe business verification, live product/price creation, webhook registration and signed-event validation before enabling subscriptions.
8. Approve and publish the Privacy notice, Terms, AI disclosure, support contact, retention schedule and account-deletion process at the canonical URLs.
9. Complete accessibility validation, isolated backup restore proof, monitoring/alert ownership and release authorization.
10. Run staging acceptance and Google Play internal-track review before any public release.

## Release rule

The portal may be built and backed up from this checkpoint, but production traffic and store submission remain fail-closed until all applicable external gates have current evidence bound to the exact release commit.
