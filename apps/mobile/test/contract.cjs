const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=JSON.parse(read('app.json')).expo;
const eas=JSON.parse(read('eas.json'));
const manifest=JSON.parse(read('package.json'));
const entry=read('App.tsx');
const screen=read('src/screens/SkinMatchScreen.tsx');
const step=read('src/components/SkinMatchStep.tsx');
const membership=read('src/components/MembershipPlans.tsx');

test('mobile app has a reproducible Expo identity and API configuration seam',()=>{
 assert.equal(app.name,'Team 47 Studio');
 assert.equal(app.slug,'team-47-studio');
 assert.equal(app.scheme,'team47studio');
 assert.equal(app.icon,'./assets/team47studio-app-icon-1024.png');
 assert.equal(app.ios.bundleIdentifier,'com.team47studio.app');
 assert.equal(app.orientation,'portrait');
 assert.match(entry,/process\.env\.EXPO_PUBLIC_API_URL/);
 assert.match(entry,/new ApiClient\(/);
 assert.match(entry,/\[apiBaseUrl, portalUrl, privacyUrl, termsUrl, aiDisclosureUrl\]\.every\(isHttpsUrl\)/);
 assert.equal(app.android.versionCode,1);
 assert.deepEqual(app.android.permissions,[]);
 assert.equal(app.android.usesCleartextTraffic,false);
 assert.equal(app.android.package,'com.team47studio.app');
 assert.equal(app.android.adaptiveIcon.foregroundImage,'./assets/team47studio-adaptive-icon-foreground.png');
 assert.equal(app.android.adaptiveIcon.backgroundColor,'#090D18');
 assert.equal(eas.build.production.android.buildType,'app-bundle');
 assert.equal(eas.build.production.distribution,'store');
 assert.equal(eas.submit.production.android.track,'internal');
 assert.equal(manifest.scripts['android:production'],'pnpm run validate:production-config && eas build --platform android --profile production');
});

test('mobile Skin Match consumes shared questionnaire and profile contracts',()=>{
 assert.match(screen,/CORE_STEPS/);
 assert.match(screen,/progress\(answers\)/);
 assert.match(screen,/toProfileInput\(answers\)/);
 assert.match(entry,/completeSkinMatch\(input\)/);
 assert.match(entry,/match_intelligence\.coverage\.required_slots_matched/);
 assert.match(entry,/match_intelligence\.data_points\.slice\(0,4\)/);
 assert.match(entry,/retail_discovery\.profile_terms/);
 assert.match(entry,/retail_discovery\.privacy_note/);
 assert.match(entry,/Explore retailer discovery/);
 assert.match(entry,/retailer_query_eligible/);
 assert.match(entry,/AI text does not select or rank products/);
 assert.match(entry,/reversible future-match exclusions are managed in the secure web portal/);
 assert.match(entry,/Removing feedback does not lower saved sensitivity settings/);
 assert.match(entry,/Review full match details/);
 assert.match(entry,/EXPO_PUBLIC_PRIVACY_URL/);
 assert.match(entry,/EXPO_PUBLIC_TERMS_URL/);
 assert.match(entry,/EXPO_PUBLIC_AI_DISCLOSURE_URL/);
 assert.match(entry,/AI disclosure/);
 assert.match(entry,/privacy, terms and AI disclosure links/);
 assert.match(entry,/new URL\(value\)/);
 assert.match(entry,/productionPlaceholder/);
 assert.match(entry,/!url\.username && !url\.password/);
 assert.match(entry,/!url\.search && !url\.hash/);
 assert.match(entry,/ACCOUNT_PORTAL_PATHS\.overview/);
 assert.match(entry,/ACCOUNT_PORTAL_PATHS\.billing/);
 assert.match(entry,/ACCOUNT_PORTAL_PATHS\.images/);
 assert.match(entry,/ACCOUNT_PORTAL_PATHS\.regimen/);
 assert.match(entry,/ACCOUNT_PORTAL_PATHS\.privacy/);
 assert.match(entry,/Connected setup checklist/);
 assert.match(entry,/Profile and preferences/);
 assert.match(entry,/two-week regimen cycle/);
 assert.match(entry,/Privacy, data export and account deletion/);
 assert.match(entry,/public HTTPS API, portal, privacy, terms and AI disclosure links/);
 assert.match(entry,/needs public HTTPS API, portal, privacy, terms and AI disclosure links/);
 assert.doesNotMatch(entry,/OLLAMA_CLOUD_API_KEY|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY/);
 assert.match(entry,/team47studio-stacked-light-surface\.png/);
 assert.match(entry,/TEAM 47 STUDIO/);
 assert.match(entry,/MembershipPlans/);
 assert.match(entry,/ScrollView contentContainerStyle=\{styles\.home\}/);
});

test('mobile account experience exposes the shared three-tier comparison and safe portal handoff',()=>{
 assert.match(membership,/MEMBERSHIP_TIER_CONTENT\.map/);
 assert.match(membership,/MEMBERSHIP_COMPARISON_ROWS\.map/);
 assert.match(membership,/MEMBERSHIP_CHANGE_POLICY\.period_end/);
 assert.match(membership,/MEMBERSHIP_CHANGE_POLICY\.annual_upgrade/);
 assert.match(membership,/membership-tier-\$\{tier\.id\}/);
 assert.match(membership,/membership-comparison-\$\{row\.id\}/);
 assert.match(membership,/View current plans and pricing/);
 assert.match(membership,/Manage my plan in Account/);
 assert.match(membership,/account#payment-settings/);
 assert.match(membership,/minHeight: 48/);
 assert.doesNotMatch(membership,/STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY/);
});

test('mobile controls preserve the shared accessibility and tap-target contract',()=>{
 assert.match(step,/TAP_TARGET_MIN/);
 assert.match(step,/accessibilityRole=\{\(step\.multi \? 'checkbox' : 'radio'\)/);
 assert.match(step,/accessibilityState=\{\{ checked: selected, disabled: blocked \}\}/);
 assert.match(step,/testID=\{`choice-\$\{choice\.value\}`\}/);
 assert.match(screen,/accessibilityRole="progressbar"/);
});

