// Production web -> same-origin proxy -> API -> SQLite journey v1.2.
// Auth is a fixed test double. This never loads .env or connects to production.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const next=require(path.join(root,'apps/web/node_modules/next'));
const {createPortal}=require(path.join(root,'apps/api/dist/portal/server'));
const {LocalStore}=require(path.join(root,'apps/api/dist/portal/store'));
async function listen(server,port=0){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return server.address().port;}
async function close(server){if(!server?.listening)return;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
async function main(){
 const store=new LocalStore(':memory:');let apiServer,webServer,web,reservedWebServer;
 try{
  reservedWebServer=http.createServer((_req,res)=>res.end('reserved'));
  const webPort=await listen(reservedWebServer);
  const webOrigin='http://127.0.0.1:'+webPort;
  const app=await createPortal({store,env:{NODE_ENV:'test',DEMO_MODE:'true',PUBLIC_ORIGIN:webOrigin},verifyOtp:async email=>({id:'journey-user',email})});
  apiServer=http.createServer(app);const apiPort=await listen(apiServer);process.env.PORTAL_API_ORIGIN='http://127.0.0.1:'+apiPort;
  const routesManifest=path.join(root,'apps/web/.next/routes-manifest.json');
  if(fs.existsSync(routesManifest)){
   const manifest=JSON.parse(fs.readFileSync(routesManifest,'utf8'));
   for(const rewrite of manifest.rewrites?.afterFiles||[])if(/^\/api\/(hub|v1)\//.test(rewrite.source))rewrite.destination=rewrite.destination.replace(/^http:\/\/127\.0\.0\.1:\d+/,process.env.PORTAL_API_ORIGIN);
   fs.writeFileSync(routesManifest,JSON.stringify(manifest,null,2));
  }
  web=next({dev:false,dir:path.join(root,'apps/web'),hostname:'127.0.0.1',port:webPort});await web.prepare();
  await close(reservedWebServer);reservedWebServer=null;
  webServer=http.createServer(web.getRequestHandler());await listen(webServer,webPort);
  let cookie='',csrf='';
  async function call(route,body){const response=await fetch(webOrigin+route,{method:body===undefined?'GET':'POST',headers:{cookie,origin:webOrigin,'content-type':'application/json','x-csrf-token':csrf},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const data=await response.json();if(data.csrf)csrf=data.csrf;return{status:response.status,data};}
  const browserRoutes=['/','/account','/skin-match','/skin-match/results','/my-skin','/routine','/coach','/anti-aging','/shop','/saved','/replenishment','/membership','/subscription','/orders','/cart','/support','/learn','/company','/trust','/privacy','/terms','/ai-disclosure','/shipping','/partners','/studio','/studio/personal-color','/studio/makeup','/studio/haircare','/studio/hair-color','/studio/style','/studio/clothing','/wardrobe','/admin','/admin/analysis','/admin/ingredient-rules','/admin/knowledge','/admin/operators'];
  for(const route of browserRoutes){
   const response=await fetch(webOrigin+route);assert.equal(response.status,200,route);const html=await response.text();
   assert.match(html,/<html/,route+' document');
   assert.match(html,/team47studio-horizontal-light-surface\.png/,route+' shared light-surface logo');
   assert.match(html,/team47studio-horizontal-dark-surface\.png/,route+' shared dark-surface logo');
   assert.match(html,/aria-label="Team 47 Studio home"/,route+' accessible brand name');
   // This is a server-rendered accessibility markup contract. It deliberately
   // checks every route, but does not claim a substitute for assistive-tech QA.
   assert.match(html,/class="skip" href="#main"/,route+' skip link');
   assert.match(html,/id="primary-navigation"/,route+' primary navigation');
   assert.match(html,/aria-label="Primary"/,route+' primary navigation label');
   assert.match(html,/id="main"/,route+' main landmark');
   assert.match(html,/aria-label="Company and policies"/,route+' footer navigation label');
   for(const image of html.match(/<img\b[^>]*>/g)||[])assert.match(image,/\balt="[^"]*"/,route+' image alternative text');
   console.log('PASS production page '+route+' accessibility markup');
  }
  assert.equal((await call('/api/hub/session')).status,200);
  assert.equal((await call('/api/v1/subscriptions')).status,401);
  assert.equal((await call('/api/hub/auth/verify',{email:'journey@test.invalid',code:'123456'})).status,200);await call('/api/hub/session');
  const input={skin_type:'dry',concerns:['hydration'],sensitivity:'none',age_band:'26_35',current_routine:'basic',desired_outcome:'glow',budget_range:'between_25_50',ingredient_avoidances:[],consent:true};
  const created=await call('/api/hub/profile',input);assert.equal(created.status,200);
  assert.deepEqual((await call('/api/hub/profile')).data,created.data);
  const updated=await call('/api/hub/profile',{...input,skin_type:'oily',expected_revision:created.data.revision});assert.equal(updated.status,200);
  assert.equal((await call('/api/hub/profile',{...input,expected_revision:created.data.revision})).status,409);
  assert.deepEqual((await call('/api/hub/account/export')).data.profile,updated.data.profile);
  assert.equal((await call('/api/v1/subscriptions')).status,200);
  const antiAging=await call('/api/v1/onboarding/preview?goals=texture,brightening&sensitivity=mild&consent=personalization');
  assert.equal(antiAging.status,200);assert.equal(antiAging.data.data.status,'ready');
  const antiAgingProducts=await call('/api/v1/products?limit=2');
  assert.equal(antiAgingProducts.status,200);assert(antiAgingProducts.data.data.items.length>0);
  const antiAgingPreview=await call('/api/v1/routines/preview?product_ids='+encodeURIComponent(antiAgingProducts.data.data.items[0].id)+'&sensitivity=mild');
  assert.equal(antiAgingPreview.status,200);assert.equal(antiAgingPreview.data.meta.mode,'read_only_referral');
  const accountInput={preferred_name:'Journey member',locale:'en-US',timezone:'America/New_York',measurement_system:'us',service_interests:['skin_match','routine_care','anti_aging'],communication_preferences:{routine_reminders:true,service_announcements:false},accessibility:{reduced_motion:false,high_contrast:false},default_image_storage:'device',expected_revision:null};
  const accountProfile=await call('/api/hub/account/profile',accountInput);assert.equal(accountProfile.status,200);
  assert.equal((await call('/api/hub/account/overview')).status,200);
  const style=await call('/api/hub/style-profile',{consent:true,expected_revision:null});assert.equal(style.status,200);
  const color=await call('/api/hub/style-match',{ai_consent:true});assert.equal(color.status,200);assert(['warm','cool','balanced'].includes(color.data.palette));
  const wardrobeItem={id:'b25258b7-a236-488a-bc6a-f74c95d9232c',name:'Blue jacket',category:'outer layer',color:'blue',notes:'test garment',created_at:'2026-10-25T00:00:00.000Z'};
  const wardrobe=await call('/api/hub/wardrobe',{consent:true,expected_revision:null,items:[wardrobeItem]});assert.equal(wardrobe.status,200);
  assert.equal((await call('/api/hub/wardrobe')).data.items[0].name,'Blue jacket');
  assert.equal((await call('/api/hub/wardrobe',{consent:true,expected_revision:null,items:[]})).status,409);
  const plans=await call('/api/hub/billing/plans');assert.equal(plans.status,200);assert.equal(plans.data.catalog_status,'release_pending');
  assert.equal((await call('/api/hub/billing/checkout',{plan:'premium',cycle:'monthly',recurring_consent:true})).status,503);
  assert.equal((await call('/api/hub/client-images/status')).status,200);
  assert.equal((await call('/api/hub/client-images')).status,404);
  const retailers=(await call('/api/hub/retailers')).data.retailers;assert.equal((await call('/api/hub/saved-retailers',{id:retailers[0].id,saved:true})).status,200);
  assert.equal((await call('/api/hub/retailers/outbound',{id:retailers[0].id,segment:'all'})).status,200);
  assert((await call('/api/hub/saved-retailers')).data.ids.includes(retailers[0].id));
  const exportData=(await call('/api/hub/account/export')).data;
  assert.equal(exportData.account_profile.preferred_name,'Journey member');
  assert.equal(exportData.wardrobe[0].name,'Blue jacket');
  assert.equal((await call('/api/hub/profile/remove',{confirm:true,expected_revision:updated.data.revision})).status,200);
  assert.equal((await call('/api/hub/profile')).data.profile,null);
  console.log('PASS production web proxy: auth, CSRF, skin profile, anti-aging preview, account, style/color, wardrobe, retailer, billing fail-closed, image fail-closed, export and deletion');
 }finally{await close(webServer);await web?.close();await close(apiServer);await close(reservedWebServer);await store.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
