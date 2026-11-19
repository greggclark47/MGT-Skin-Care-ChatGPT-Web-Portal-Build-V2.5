# Team 47 Studio Android build readiness

Date: 2026-11-13

## Completed

- Added the real Expo SDK 58 mobile toolchain instead of relying on configuration-only contracts.
- Pinned React 19.3.0, React Native 0.88.1, TypeScript 6.0.x, and the SDK-compatible Expo packages.
- Declared the shared Team 47 Studio domain and cross-platform packages as mobile workspace dependencies.
- Added strict mobile TypeScript checking and a repeatable Android JavaScript export command.
- Enforced disabled Android cleartext traffic through the supported `expo-build-properties` native configuration plugin.
- Kept Android permissions empty.
- Pinned EAS CLI 27.9.0 through the supported on-demand `npx` execution path instead of installing the legacy CLI inside the project.
- Isolated the web portal's React 18 types from the mobile application's React 19 types.
- Generated a local Android Hermes bundle export with 633 modules and the Team 47 Studio brand asset.
- Passed all 20 Expo Doctor checks, Expo dependency compatibility, strict mobile TypeScript, mobile contract tests, and the complete repository release verifier.

## Current artifact status

The local output under `work/build/mobile-android-export` is a verified JavaScript/Hermes export. It is not an APK, Android App Bundle, signed store artifact, or Google Play submission.

## External steps still required

1. Sign in to the approved Team 47 Studio Expo account. The current workstation is not authenticated to EAS.
2. Link or create the approved Expo project and record its project ID/owner in the app configuration.
3. Configure the five public production URLs in the EAS environment: API, portal, privacy notice, terms, and AI disclosure.
4. Run the existing production-configuration validator.
5. Create an internal preview APK and complete physical-device accessibility, navigation, network, account handoff, and dark/light brand checks.
6. Create the signed production AAB only after device acceptance.
7. Complete the Google Play Data safety, target audience, content, support, privacy, and account-deletion reviews.
8. Submit only to the draft internal track. Production publication remains a separate human approval.

The Android build scripts do not auto-submit or publish the application.
