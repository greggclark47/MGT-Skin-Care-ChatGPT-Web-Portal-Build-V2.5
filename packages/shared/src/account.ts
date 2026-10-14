export const ACCOUNT_LOCALES=['en-US','es-US'] as const;
export const MEASUREMENT_SYSTEMS=['us','metric'] as const;
export const ACCOUNT_SERVICE_INTERESTS=['skin_match','routine_care','anti_aging','beauty_style','retailer_discovery','premium_guidance'] as const;
export const IMAGE_STORAGE_PREFERENCES=['device','test-drive'] as const;

export type AccountLocale=typeof ACCOUNT_LOCALES[number];
export type MeasurementSystem=typeof MEASUREMENT_SYSTEMS[number];
export type AccountServiceInterest=typeof ACCOUNT_SERVICE_INTERESTS[number];
export type ImageStoragePreference=typeof IMAGE_STORAGE_PREFERENCES[number];

export type AccountProfileInput={
 preferred_name:string;
 locale:AccountLocale;
 timezone:string;
 measurement_system:MeasurementSystem;
 service_interests:AccountServiceInterest[];
 communication_preferences:{routine_reminders:boolean;service_announcements:boolean};
 accessibility:{reduced_motion:boolean;high_contrast:boolean};
 default_image_storage:ImageStoragePreference;
};

export type AccountProfile=AccountProfileInput&{
 profile_version:1;
 created_at:string;
 updated_at:string;
 revision:string;
};

export const ACCOUNT_SERVICE_IDS=['account_profile','skin_routine','anti_aging','beauty_style','retail_discovery','images','billing','support','analysis_permission','privacy_controls'] as const;
export type AccountServiceId=typeof ACCOUNT_SERVICE_IDS[number];
export type AccountServiceState='ready'|'setup'|'attention'|'unavailable';
export type AccountServiceStatus={
 id:AccountServiceId;
 label:string;
 state:AccountServiceState;
 detail:string;
 href:string;
 selected:boolean;
 count?:number;
};
export type AccountSetupStep={
 id:AccountServiceId;
 label:string;
 detail:string;
 href:string;
 priority:'attention'|'setup';
};
export type AccountServiceOverview={
 generated_at:string;
 summary:{ready:number;attention:number;setup:number;unavailable:number;total:number};
 focus:{ready:number;attention:number;setup:number;unavailable:number;total:number;percent:number;service_ids:AccountServiceId[]};
 next_steps:AccountSetupStep[];
 services:AccountServiceStatus[];
 privacy_note:string;
};

export const ACCOUNT_PORTAL_PATHS={
 overview:'/account#service-overview',
 profile:'/account#profile-settings',
 billing:'/account#payment-settings',
 images:'/account#image-library',
 privacy:'/account#privacy-controls',
} as const;
