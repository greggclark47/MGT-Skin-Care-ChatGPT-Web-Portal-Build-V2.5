// Profile persistence v1.2: one transaction for preferences, revision, and audit.
import {randomUUID} from 'node:crypto';
import type {Records} from './store';
import {check,hash} from './security';
const SKIN_TYPES=['normal','dry','oily','combination'] as const;
const SKIN_CONCERNS=['acne','anti_aging','brightening','hydration','hyperpigmentation','pore_minimizing','redness_relief','texture_smoothing','dark_circles','firmness'] as const;
const SENSITIVITY=['none','mild','moderate','high'] as const;
const AGE_BANDS=['18_25','26_35','36_45','46_55','56_plus'] as const;
const ROUTINE_LEVELS=['none','basic','advanced'] as const;
const OUTCOMES=['clearer','calmer','glow','smoother','even_tone','firmer','maintain'] as const;
const BUDGETS=['under_25','between_25_50','between_50_100','over_100'] as const;
const ROUTINE_SLOTS=['cleanser','toner','serum','treatment','moisturizer','sunscreen','eye','exfoliant','mask','spot','face_oil','mist','body'] as const;
const ROUTINE_TIMES=['am','pm','am_pm','weekly','cycle'] as const;
const FREQUENCIES=['daily','twice_daily','every_other_day','2_3_weekly','weekly'] as const;
const VECTOR_KEYS=['hydration_need','oil_control_need','sensitivity_ceiling','acne_focus','aging_focus','brightening_focus','texture_focus','redness_focus','eye_area_focus','firmness_focus'] as const;
const AVOID_KEYS=['fragrance','essential_oils','alcohol_denat','physical_exfoliants','high_strength_actives'] as const;
const FEEDBACK=['comfortable','not_right','irritation'] as const;
const GENERAL_FEEDBACK=['comfortable','irritation','no_change'] as const;
type PublicProfile=Record<string,unknown>;
const isRecord=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const isString=(value:unknown,max=500)=>typeof value==='string'&&value.length<=max;
const isStringArray=(value:unknown,maxItems=80,maxLength=160):value is string[]=>Array.isArray(value)&&value.length<=maxItems&&value.every(item=>isString(item,maxLength));
const isEnum=(value:unknown,values:readonly string[]):value is string=>typeof value==='string'&&values.includes(value);
function publicInput(value:unknown){
 const input=isRecord(value)?value:null;
 if(!input||!isEnum(input.skin_type,SKIN_TYPES)||!Array.isArray(input.concerns)||input.concerns.length<1||input.concerns.length>3||!input.concerns.every((item:unknown)=>isEnum(item,SKIN_CONCERNS))||!isEnum(input.sensitivity,SENSITIVITY)||!isEnum(input.age_band,AGE_BANDS)||!isEnum(input.current_routine,ROUTINE_LEVELS)||!isEnum(input.desired_outcome,OUTCOMES)||!isEnum(input.budget_range,BUDGETS)||!isStringArray(input.ingredient_avoidances,40,80))return null;
 return {skin_type:input.skin_type,concerns:[...input.concerns],sensitivity:input.sensitivity,age_band:input.age_band,current_routine:input.current_routine,desired_outcome:input.desired_outcome,budget_range:input.budget_range,ingredient_avoidances:[...input.ingredient_avoidances]};
}
function publicVector(value:unknown){
 const vector=isRecord(value)?value:null;if(!vector||VECTOR_KEYS.some(key=>typeof vector[key]!=='number'||!Number.isFinite(vector[key])||vector[key]<0||vector[key]>1))return null;
 return Object.fromEntries(VECTOR_KEYS.map(key=>[key,vector[key]]));
}
function publicAvoidFlags(value:unknown){
 const flags=isRecord(value)?value:null;if(!flags||AVOID_KEYS.some(key=>typeof flags[key]!=='boolean'))return null;
 return Object.fromEntries(AVOID_KEYS.map(key=>[key,flags[key]]));
}
function publicRoutine(value:unknown){
 const routine=isRecord(value)?value:null;if(!routine||!isString(routine.rules_version,80)||!Array.isArray(routine.steps)||routine.steps.length>30)return null;
 const steps=routine.steps.map((value:unknown)=>{
  const step=isRecord(value)?value:null;
  if(!step||!isEnum(step.slot,ROUTINE_SLOTS)||!isEnum(step.time,ROUTINE_TIMES)||!isString(step.product_id,100)||!step.product_id.trim()||!Number.isInteger(step.order)||step.order<0||step.order>100||typeof step.is_optional!=='boolean'||!isEnum(step.frequency,FREQUENCIES)||!isStringArray(step.conflict_notes,10,360))return null;
  return{slot:step.slot,time:step.time,product_id:step.product_id,order:step.order,is_optional:step.is_optional,frequency:step.frequency,conflict_notes:[...step.conflict_notes]};
 }).filter(Boolean) as Record<string,unknown>[];
 if(steps.length!==routine.steps.length)return null;
 return{steps,rules_version:routine.rules_version};
}
function publicScoreResults(value:unknown){
 if(!Array.isArray(value)||value.length>500)return null;
 const results=value.map((item:unknown)=>{
  if(!isRecord(item)||!isString(item.product_id,100)||!item.product_id.trim()||typeof item.excluded!=='boolean')return null;
  if(item.excluded===true)return{product_id:item.product_id,excluded:true,reason:isString(item.reason,160)?item.reason:'not_available'};
  return Number.isFinite(item.score)&&item.score>=0&&item.score<=100&&isStringArray(item.reasons,20,120)?{product_id:item.product_id,score:item.score,reasons:[...item.reasons],excluded:false}:null;
 }).filter(Boolean) as Record<string,unknown>[];
 return results.length===value.length?results:null;
}
function publicMatchIntelligence(value:unknown){
 const intelligence=isRecord(value)?value:null;if(!intelligence||!isString(intelligence.version,80)||intelligence.generated_by!=='deterministic_rules'||intelligence.ai_narrative_status!=='not_requested'||!isString(intelligence.scoring_engine_version,80)||!isString(intelligence.routine_engine_version,80)||!isString(intelligence.safety_matrix_version,80))return null;
 const points=Array.isArray(intelligence.data_points)?intelligence.data_points.map((item:unknown)=>{const point=isRecord(item)?item:null;return point&&isEnum(point.id,['skin_type','concerns','sensitivity','age_band','current_routine','desired_outcome','budget_range','ingredient_avoidances'])&&isString(point.label,120)&&isString(point.value,500)&&isString(point.effect,500)&&(point.visibility==='account_only'||point.visibility==='portal_discovery_context')&&typeof point.retailer_query_eligible==='boolean'?{id:point.id,label:point.label,value:point.value,effect:point.effect,visibility:point.visibility,retailer_query_eligible:point.retailer_query_eligible}:null;}).filter(Boolean) as Record<string,unknown>[]:null;
 const coverage=isRecord(intelligence.coverage)&&Number.isInteger(intelligence.coverage.required_slots_matched)&&Number.isInteger(intelligence.coverage.required_slots_total)&&Number.isInteger(intelligence.coverage.optional_slots_matched)&&Number.isInteger(intelligence.coverage.eligible_products_considered)&&Number.isInteger(intelligence.coverage.excluded_products)&&Number.isInteger(intelligence.coverage.feedback_excluded_products)&&(intelligence.coverage.confidence==='strong'||intelligence.coverage.confidence==='balanced'||intelligence.coverage.confidence==='limited')?{required_slots_matched:intelligence.coverage.required_slots_matched,required_slots_total:intelligence.coverage.required_slots_total,optional_slots_matched:intelligence.coverage.optional_slots_matched,eligible_products_considered:intelligence.coverage.eligible_products_considered,excluded_products:intelligence.coverage.excluded_products,feedback_excluded_products:intelligence.coverage.feedback_excluded_products,confidence:intelligence.coverage.confidence}:null;
 const matches=Array.isArray(intelligence.product_matches)?intelligence.product_matches.map((item:unknown)=>{const match=isRecord(item)?item:null;if(!match||!isString(match.product_id,100)||!Number.isFinite(match.match_score)||!isStringArray(match.why_matched,20,120)||!Array.isArray(match.ingredients)||!Array.isArray(match.cautions)||!Array.isArray(match.alternatives)||!isString(match.blurb,360)&&match.blurb!==null)return null;const ingredients=match.ingredients.map((ingredient:unknown)=>isRecord(ingredient)&&isString(ingredient.name,120)&&isString(ingredient.role,120)?{name:ingredient.name,role:ingredient.role}:null);const alternatives=match.alternatives.map((alternative:unknown)=>isRecord(alternative)&&isString(alternative.product_id,100)&&['cheaper','premium','cleaner','gentler'].includes(alternative.reason as string)?{product_id:alternative.product_id,reason:alternative.reason}:null);const placement=isRecord(match.routine_placement)&&isString(match.routine_placement.slot,40)&&isString(match.routine_placement.time,40)&&isString(match.routine_placement.frequency,40)?{slot:match.routine_placement.slot,time:match.routine_placement.time,frequency:match.routine_placement.frequency}:null;const compatibility=match.sensitivity_compatibility==='safe'||match.sensitivity_compatibility==='caution'||match.sensitivity_compatibility==='excluded'?match.sensitivity_compatibility:null;if(!ingredients.every(Boolean)||!alternatives.every(Boolean)||!placement||!compatibility||!isStringArray(match.cautions,20,360))return null;return{product_id:match.product_id,match_score:match.match_score,why_matched:[...match.why_matched],ingredients, sensitivity_compatibility:compatibility,routine_placement:placement,cautions:[...match.cautions],alternatives,blurb:match.blurb};}).filter(Boolean) as Record<string,unknown>[]:null;
 const retail=isRecord(intelligence.retail_discovery)&&intelligence.retail_discovery.segment==='skincare'&&isString(intelligence.retail_discovery.label,180)&&isStringArray(intelligence.retail_discovery.profile_terms,20,100)&&isStringArray(intelligence.retail_discovery.query_terms,20,100)&&isString(intelligence.retail_discovery.privacy_note,500)&&isString(intelligence.retail_discovery.disclosure,500)?{segment:'skincare',label:intelligence.retail_discovery.label,profile_terms:[...intelligence.retail_discovery.profile_terms],query_terms:[...intelligence.retail_discovery.query_terms],privacy_note:intelligence.retail_discovery.privacy_note,disclosure:intelligence.retail_discovery.disclosure}:null;
 if(!points||!coverage||!matches||matches.length!==intelligence.product_matches.length||!retail||!isStringArray(intelligence.limitations,20,500))return null;
 return{version:intelligence.version,generated_by:'deterministic_rules',ai_narrative_status:'not_requested',scoring_engine_version:intelligence.scoring_engine_version,routine_engine_version:intelligence.routine_engine_version,safety_matrix_version:intelligence.safety_matrix_version,data_points:points,coverage,product_matches:matches,retail_discovery:retail,limitations:[...intelligence.limitations]};
}
function publicFeedback(value:unknown){
 const item=isRecord(value)?value:null;if(!item||!isString(item.product_id,100)||!isEnum(item.feedback,FEEDBACK)||!isString(item.at,80))return null;
 return{product_id:item.product_id,feedback:item.feedback,at:item.at};
}
export function publicProfile(value:unknown):PublicProfile|null{
 const profile=isRecord(value)?value:null;if(!profile)return null;
 const input=publicInput(profile.input),vector=publicVector(profile.profile_vector),flags=publicAvoidFlags(profile.avoid_flags),routine=publicRoutine(profile.routine),intelligence=publicMatchIntelligence(profile.match_intelligence),results=publicScoreResults(profile.results);
 if(!input||!vector||!flags||!routine||!intelligence||!results||!isString(profile.rules_version,80)||!isString(profile.matrix_version,80)||!isString(profile.created_at,80)||typeof profile.sample!=='boolean')return null;
 const output:PublicProfile={input,profile_vector:vector,avoid_flags:flags,rules_version:profile.rules_version,routine,match_intelligence:intelligence,matrix_version:profile.matrix_version,results,created_at:profile.created_at,sample:profile.sample};
 for(const key of ['revision','consent_version','consented_at','updated_at','feedback_at'] as const)if(isString(profile[key],160))output[key]=profile[key];
 if(Array.isArray(profile.feedback_excluded_product_ids))output.feedback_excluded_product_ids=(profile.feedback_excluded_product_ids.filter((id:unknown)=>isString(id,100)&&(id as string).trim().length>0) as string[]).slice(-30);
 if(Array.isArray(profile.product_feedback)){const feedback=profile.product_feedback.map(publicFeedback).filter(Boolean) as Record<string,unknown>[];if(feedback.length===profile.product_feedback.length)output.product_feedback=feedback.slice(-20);}
 if(profile.last_product_feedback===null)output.last_product_feedback=null;else if(profile.last_product_feedback!==undefined){const feedback=publicFeedback(profile.last_product_feedback);if(feedback)output.last_product_feedback=feedback;}
 if(isEnum(profile.last_feedback,GENERAL_FEEDBACK))output.last_feedback=profile.last_feedback;
 return output;
}
async function readStoredProfile(records:Records,actor:string){
 const profile=await records.get('profiles',actor)||null;
 const version=await records.get<{revision:string}>('profile_revisions',actor);
 return {profile,revision:version?.revision||profile?.revision||(profile?'legacy':null)};
}
export async function readProfile(records:Records,actor:string){
 const current=await readStoredProfile(records,actor);
 return {profile:publicProfile(current.profile),revision:current.revision};
}
export async function lockProfile(records:Records,actor:string,expected:unknown){
 await records.lock('profile:'+hash(actor));
 const current=await readStoredProfile(records,actor);
 check(expected===undefined||expected===null||typeof expected==='string'&&expected.length<=80,400,'invalid_revision','Use the profile reference returned by the portal.');
 check((expected??null)===current.revision,409,'profile_changed','Your profile changed in another session. Reload it before saving again.');
 return current.profile;
}
export async function saveProfile(records:Records,actor:string,value:any,action='profile.saved'){
 const revision=randomUUID(),profile=value?{...value,revision}:null;
 if(profile)await records.put('profiles',actor,profile);else await records.remove('profiles',actor);
 // Preserve a revision after removal so a stale client cannot resurrect deleted preferences.
 await records.put('profile_revisions',actor,{revision});
 const stale_at=new Date().toISOString();
 for(const item of await records.entries<any>('ai_output_events'))if(item.value?.actor===actor&&item.value?.stale!==true){
  const stale_reasons=Array.isArray(item.value.stale_reasons)?item.value.stale_reasons.filter((reason:unknown)=>typeof reason==='string'):[];
  await records.put('ai_output_events',item.id,{...item.value,stale:true,stale_at,stale_reasons:[...new Set([...stale_reasons,'profile_revision_changed'])]});
 }
 const id=randomUUID();await records.put('audit',id,{id,actor,action,target:'self',at:new Date().toISOString()});
 return {profile:publicProfile(profile),revision};
}
