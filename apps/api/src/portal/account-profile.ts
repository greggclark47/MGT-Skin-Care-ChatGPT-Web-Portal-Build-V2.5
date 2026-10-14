import {randomUUID} from 'node:crypto';
import type {Records} from './store';
import {check,hash} from './security';

export const ACCOUNT_LOCALES=['en-US','es-US'] as const;
export const MEASUREMENT_SYSTEMS=['us','metric'] as const;
export const ACCOUNT_SERVICE_INTERESTS=['skin_match','routine_care','anti_aging','beauty_style','retailer_discovery','premium_guidance'] as const;
export const IMAGE_STORAGE_PREFERENCES=['device','test-drive'] as const;

type AccountProfileInput={
 preferred_name:string;
 locale:typeof ACCOUNT_LOCALES[number];
 timezone:string;
 measurement_system:typeof MEASUREMENT_SYSTEMS[number];
 service_interests:typeof ACCOUNT_SERVICE_INTERESTS[number][];
 communication_preferences:{routine_reminders:boolean;service_announcements:boolean};
 accessibility:{reduced_motion:boolean;high_contrast:boolean};
 default_image_storage:typeof IMAGE_STORAGE_PREFERENCES[number];
};

function validTimezone(value:string){
 try{new Intl.DateTimeFormat('en-US',{timeZone:value}).format();return true;}catch{return false;}
}
function exactBooleans(value:any,keys:string[]){
 return value&&typeof value==='object'&&!Array.isArray(value)&&keys.every(key=>typeof value[key]==='boolean')&&Object.keys(value).every(key=>keys.includes(key));
}

export function accountProfileInput(body:any,testDriveEnabled:boolean):AccountProfileInput{
 const preferred_name=typeof body.preferred_name==='string'?body.preferred_name.trim():'';
 check(preferred_name.length>=1&&preferred_name.length<=80&&!/[\u0000-\u001f\u007f]/.test(preferred_name),400,'account_profile_name_invalid','Enter the name you would like MGT to use, up to 80 characters.');
 check(ACCOUNT_LOCALES.includes(body.locale),400,'account_profile_locale_invalid','Choose an available language and region.');
 const timezone=typeof body.timezone==='string'?body.timezone.trim():'';
 check(timezone.length>=1&&timezone.length<=64&&validTimezone(timezone),400,'account_profile_timezone_invalid','Choose a valid time zone.');
 check(MEASUREMENT_SYSTEMS.includes(body.measurement_system),400,'account_profile_measurement_invalid','Choose US or metric measurements.');
 check(Array.isArray(body.service_interests)&&body.service_interests.length>=1&&body.service_interests.length<=ACCOUNT_SERVICE_INTERESTS.length&&body.service_interests.every((value:unknown)=>ACCOUNT_SERVICE_INTERESTS.includes(value as any))&&new Set(body.service_interests).size===body.service_interests.length,400,'account_profile_interests_invalid','Choose one or more available service interests.');
 check(exactBooleans(body.communication_preferences,['routine_reminders','service_announcements']),400,'account_profile_communications_invalid','Review both communication preferences.');
 check(exactBooleans(body.accessibility,['reduced_motion','high_contrast']),400,'account_profile_accessibility_invalid','Review both display preferences.');
 check(IMAGE_STORAGE_PREFERENCES.includes(body.default_image_storage),400,'account_profile_image_storage_invalid','Choose an available image storage preference.');
 check(body.default_image_storage!=='test-drive'||testDriveEnabled,409,'test_drive_unavailable','Test Google Drive image storage is not available in this environment.');
 return{
  preferred_name,
  locale:body.locale,
  timezone,
  measurement_system:body.measurement_system,
  service_interests:[...body.service_interests],
  communication_preferences:{routine_reminders:body.communication_preferences.routine_reminders,service_announcements:body.communication_preferences.service_announcements},
  accessibility:{reduced_motion:body.accessibility.reduced_motion,high_contrast:body.accessibility.high_contrast},
  default_image_storage:body.default_image_storage
 };
}

export async function readAccountProfile(records:Records,actor:string){
 const profile=await records.get<any>('account_profiles',actor)||null;
 return{profile,revision:profile?.revision||null};
}

export async function saveAccountProfile(records:Records,actor:string,expected:unknown,input:AccountProfileInput){
 await records.lock('account-profile:'+hash(actor));
 const current=await records.get<any>('account_profiles',actor)||null;
 check(expected===null||expected===undefined||typeof expected==='string'&&expected.length<=80,400,'account_profile_revision_invalid','Use the account profile reference returned by the portal.');
 check((expected??null)===(current?.revision||null),409,'account_profile_changed','Your account profile changed in another session. Reload it before saving again.');
 const changed_at=new Date().toISOString(),revision=randomUUID();
 const profile={...input,profile_version:1,created_at:current?.created_at||changed_at,updated_at:changed_at,revision};
 await records.put('account_profiles',actor,profile);
 const id=randomUUID();await records.put('audit',id,{id,actor,action:'account_profile.saved',target:'self',at:changed_at});
 return{profile,revision};
}
