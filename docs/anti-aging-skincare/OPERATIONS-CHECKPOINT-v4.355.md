# Operations checkpoint v4.355

This checkpoint hardens the non-production Google Drive image path while keeping production storage disabled until the production storage and privacy controls are approved.

- Test Drive image uploads now require an explicit, request-scoped consent header on the API boundary.
- The client shows the consent control only for the test Drive destination and resets it after each successful upload batch or destination change.
- Missing consent is rejected before the Drive upload path is reached with a stable `image_consent_required` error.
- Client onboarding documentation now explains the one-upload consent boundary and the test-storage limitation.
- The static demo is updated to v4.355 to make the consent boundary discoverable.

Production boundary: this checkpoint does not enable production Google Drive storage, production credentials, or production image retention. Those remain release prerequisites for the production storage decision.
