import type {AccountProfile,AccountServiceId,AccountServiceInterest,AccountServiceOverview,AccountServiceState,AccountServiceStatus,AccountSetupStep} from '@mgt/shared';
import type {Records} from './store';
import {hash} from './security';

type OverviewOptions={
 billingConfigured:boolean;
 testDriveEnabled:boolean;
 aiDisclosureVersion:string;
 generatedAt?:string;
};

function status(id:AccountServiceStatus['id'],label:string,state:AccountServiceState,detail:string,href:string,count?:number):Omit<AccountServiceStatus,'selected'>{
 return{id,label,state,detail,href,...(count===undefined?{}:{count})};
}

const INTEREST_SERVICES:Record<AccountServiceInterest,AccountServiceId>={skin_match:'skin_routine',routine_care:'skin_routine',anti_aging:'anti_aging',beauty_style:'beauty_style',retailer_discovery:'retail_discovery',premium_guidance:'billing'};
const STEP_LABELS:Record<AccountServiceId,string>={account_profile:'Complete account profile',skin_routine:'Complete Skin Match',anti_aging:'Set up anti-aging progress',beauty_style:'Start beauty & style',retail_discovery:'Save a retailer',images:'Add an optional photo',billing:'Review Premium membership',support:'Review support requests',analysis_permission:'Review analysis permission',privacy_controls:'Review privacy status'};

export async function buildAccountServiceOverview(records:Records,actor:string,options:OverviewOptions):Promise<AccountServiceOverview>{
 const accountProfile=await records.get<AccountProfile>('account_profiles',actor);
 const skinProfile=await records.get<any>('profiles',actor);
 const styleProfile=await records.get<any>('style_profiles',actor);
 const routineReminders=await records.get<any[]>('reminders',actor)||[];
 const savedRetailers=await records.get<string[]>('saved_retailers',actor)||[];
 const progress=(await records.list<any>('anti_aging_progress')).filter(item=>item.actor===actor);
 const progressReminders=(await records.list<any>('anti_aging_reminders')).filter(item=>item.actor===actor);
 const images=(await records.list<any>('client_image_drive')).filter(item=>item.actor===hash(actor)&&item.status==='ready');
 const openSupport=(await records.list<any>('tickets')).filter(item=>item.actor===actor&&['open','in_review','waiting_customer'].includes(item.status));
 const subscription=await records.get<any>('subscriptions',actor+':consumer');
 const disclosure=await records.get<any>('consents',actor+':ai_disclosure');
 const deletion=await records.get<any>('deletion_requests',actor);
 const routineSteps=Array.isArray(skinProfile?.routine?.steps)?skinProfile.routine.steps.length:0;
 const antiAgingCount=progress.length+progressReminders.length;
 const billingState:AccountServiceState=subscription&&['past_due','unpaid','incomplete'].includes(subscription.status)?'attention':subscription?.active===true||subscription?.status==='trialing'?'ready':options.billingConfigured?'setup':'unavailable';
 const baseServices:Omit<AccountServiceStatus,'selected'>[]=[
  status('account_profile','Account profile',accountProfile?'ready':'setup',accountProfile?'Identity and service preferences are saved.':'Add identity, regional, service and accessibility preferences.','/account#profile-settings'),
  status('skin_routine','Skin profile & routine',skinProfile?'ready':'setup',skinProfile?`${routineSteps} routine step${routineSteps===1?'':'s'} connected.`:'Complete Skin Match to connect a routine.','/my-skin',routineSteps),
  status('anti_aging','Anti-aging progress',antiAgingCount?'ready':'setup',antiAgingCount?`${progress.length} progress entr${progress.length===1?'y':'ies'} and ${progressReminders.length} reminder${progressReminders.length===1?'':'s'}.`:'Optional progress and reminders are not set up.','/anti-aging',antiAgingCount),
  status('beauty_style','Beauty & style',styleProfile?'ready':'setup',styleProfile?'A style profile is saved.':'Start the optional beauty and style profile.','/studio'),
  status('retail_discovery','Retail discovery',savedRetailers.length?'ready':'setup',savedRetailers.length?`${savedRetailers.length} retailer${savedRetailers.length===1?'':'s'} saved.`:'Save retailers for quicker external purchase handoffs.','/shop',savedRetailers.length),
  status('images','Image library',!options.testDriveEnabled?'unavailable':images.length?'ready':'setup',!options.testDriveEnabled?'Test Drive storage is not enabled in this environment.':images.length?`${images.length} optional photo${images.length===1?'':'s'} saved in test storage.`:'No photos are saved in test storage.','/account#image-library',options.testDriveEnabled?images.length:undefined),
  status('billing','Payment & membership',billingState,billingState==='attention'?'Payment attention is required.':billingState==='ready'?'Premium membership status is confirmed.':billingState==='unavailable'?'Production billing setup is not enabled.':'Premium setup is available; no subscription is linked.','/account#payment-settings'),
  status('support','Support',openSupport.length?'attention':'ready',openSupport.length?`${openSupport.length} open request${openSupport.length===1?'':'s'} need follow-up.`:'No open support requests.','/support',openSupport.length),
  status('analysis_permission','Analysis permission',disclosure?.version===options.aiDisclosureVersion&&disclosure?.granted===true&&!disclosure?.revoked_at?'ready':'setup',disclosure?.version===options.aiDisclosureVersion&&disclosure?.granted===true&&!disclosure?.revoked_at?'Current platform analysis permission is recorded.':'Platform analysis permission is not active.','/account#analysis-permission'),
  status('privacy_controls','Privacy controls',deletion&&['pending','processing'].includes(deletion.status)?'attention':'ready',deletion&&['pending','processing'].includes(deletion.status)?'Account deletion is scheduled or processing.':'Data export and account deletion controls are available.','/account#privacy-controls')
 ];
 const selectedIds=new Set<AccountServiceId>(['account_profile']);
 if(accountProfile){
  const interests=Array.isArray(accountProfile.service_interests)?accountProfile.service_interests:[];
  for(const interest of interests){const id=typeof interest==='string'&&Object.prototype.hasOwnProperty.call(INTEREST_SERVICES,interest)?INTEREST_SERVICES[interest as AccountServiceInterest]:undefined;if(id)selectedIds.add(id);}
  if(accountProfile.default_image_storage==='test-drive')selectedIds.add('images');
 }
 for(const service of baseServices)if(service.state==='attention')selectedIds.add(service.id);
 const services:AccountServiceStatus[]=baseServices.map(service=>({...service,selected:selectedIds.has(service.id)}));
 const summary={ready:0,attention:0,setup:0,unavailable:0,total:services.length};
 for(const service of services)summary[service.state]++;
 const focusServices=services.filter(service=>service.selected),focus={ready:0,attention:0,setup:0,unavailable:0,total:focusServices.length,percent:0,service_ids:focusServices.map(service=>service.id)};
 for(const service of focusServices)focus[service.state]++;
 focus.percent=focus.total?Math.round(focus.ready/focus.total*100):0;
 const actionable=focusServices.filter(service=>service.state==='attention'||service.state==='setup').sort((a,b)=>a.state===b.state?services.indexOf(a)-services.indexOf(b):a.state==='attention'?-1:1).slice(0,4);
 const next_steps:AccountSetupStep[]=actionable.map(service=>({id:service.id,label:STEP_LABELS[service.id],detail:service.detail,href:service.href,priority:service.state as 'attention'|'setup'}));
 return{generated_at:options.generatedAt||new Date().toISOString(),summary,focus,next_steps,services,privacy_note:'This overview contains readiness states and counts only. It excludes profile answers, support messages, image identifiers, billing-provider references and payment details. Service choices organize this checklist; they do not change access or payment.'};
}
