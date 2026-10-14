import type {AccountServiceOverview,AccountServiceState,AccountServiceStatus} from '@mgt/shared';
import type {Records} from './store';
import {hash} from './security';

type OverviewOptions={
 billingConfigured:boolean;
 testDriveEnabled:boolean;
 aiDisclosureVersion:string;
 generatedAt?:string;
};

function status(id:AccountServiceStatus['id'],label:string,state:AccountServiceState,detail:string,href:string,count?:number):AccountServiceStatus{
 return{id,label,state,detail,href,...(count===undefined?{}:{count})};
}

export async function buildAccountServiceOverview(records:Records,actor:string,options:OverviewOptions):Promise<AccountServiceOverview>{
 const accountProfile=await records.get<any>('account_profiles',actor);
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
 const services:AccountServiceStatus[]=[
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
 const summary={ready:0,attention:0,setup:0,unavailable:0,total:services.length};
 for(const service of services)summary[service.state]++;
 return{generated_at:options.generatedAt||new Date().toISOString(),summary,services,privacy_note:'This overview contains readiness states and counts only. It excludes profile answers, support messages, image identifiers, billing-provider references and payment details.'};
}
