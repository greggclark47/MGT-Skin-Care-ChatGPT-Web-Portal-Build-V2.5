const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const app=JSON.parse(read('app.json')).expo;
const eas=JSON.parse(read('eas.json'));
const entry=read('App.tsx');
const screen=read('src/screens/SkinMatchScreen.tsx');
const step=read('src/components/SkinMatchStep.tsx');

test('mobile app has a reproducible Expo identity and API configuration seam',()=>{
 assert.equal(app.name,'MGT Skin Care');
 assert.equal(app.slug,'mgt-skin-care');
 assert.equal(app.scheme,'mgtskincare');
 assert.equal(app.orientation,'portrait');
 assert.match(entry,/process\.env\.EXPO_PUBLIC_API_URL/);
 assert.match(entry,/new ApiClient\(/);
 assert.equal(app.android.versionCode,1);
 assert.deepEqual(app.android.permissions,[]);
 assert.equal(app.android.usesCleartextTraffic,false);
 assert.equal(eas.build.production.android.buildType,'app-bundle');
 assert.equal(eas.build.production.distribution,'store');
 assert.equal(eas.submit.production.android.track,'internal');
});

test('mobile Skin Match consumes shared questionnaire and profile contracts',()=>{
 assert.match(screen,/CORE_STEPS/);
 assert.match(screen,/progress\(answers\)/);
 assert.match(screen,/toProfileInput\(answers\)/);
 assert.match(entry,/completeSkinMatch\(input\)/);
 assert.match(entry,/EXPO_PUBLIC_PRIVACY_URL/);
 assert.match(entry,/EXPO_PUBLIC_TERMS_URL/);
 assert.match(entry,/ACCOUNT_PORTAL_PATHS\.overview/);
 assert.match(entry,/ACCOUNT_PORTAL_PATHS\.billing/);
 assert.match(entry,/ACCOUNT_PORTAL_PATHS\.images/);
 assert.match(entry,/Connected setup checklist/);
 assert.match(entry,/Profile and preferences/);
 assert.match(entry,/missing its API configuration/);
 assert.doesNotMatch(entry,/OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY/);
});

test('mobile controls preserve the shared accessibility and tap-target contract',()=>{
 assert.match(step,/TAP_TARGET_MIN/);
 assert.match(step,/accessibilityRole=\{\(step\.multi \? 'checkbox' : 'radio'\)/);
 assert.match(step,/accessibilityState=\{\{ checked: selected, disabled: blocked \}\}/);
 assert.match(step,/testID=\{`choice-\$\{choice\.value\}`\}/);
 assert.match(screen,/accessibilityRole="progressbar"/);
});

