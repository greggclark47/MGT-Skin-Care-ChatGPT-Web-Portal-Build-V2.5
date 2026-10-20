import type {Express} from 'express';
import {randomUUID} from 'node:crypto';
import {STYLE_OPTIONS,DEFAULT_STYLE,normalizeStyle,STYLE_PALETTES,preferredStylePalette,type StyleProfile,type StyleOptionKey} from '@mgt/domain';
import type {Store} from './store';
import {check,wrap,hash,rate,type HubRequest} from './security';
import type {AiGateway} from '@mgt/ai-gateway';
const WARDROBE_CATEGORIES=['top','bottom','dress or jumpsuit','outer layer','headwear','accessory','shoes','other'] as const;
type WardrobeItem={id:string;name:string;category:typeof WARDROBE_CATEGORIES[number];color:string;notes:string;created_at:string};
type WardrobeState={items:WardrobeItem[];revision:string;updated_at:string};
export function wardrobeItems(value:unknown):WardrobeItem[]{return Array.isArray(value)?value:Array.isArray((value as any)?.items)?(value as any).items:[];}
function wardrobeState(value:unknown):{items:WardrobeItem[];revision:string|null;updated_at:string|null}{
 const record=value&&typeof value==='object'&&!Array.isArray(value)?value as Partial<WardrobeState>:null;
 return{items:wardrobeItems(value),revision:typeof record?.revision==='string'?record.revision:Array.isArray(value)?'legacy':null,updated_at:typeof record?.updated_at==='string'?record.updated_at:null};
}
function validateWardrobe(value:unknown):WardrobeItem[]{
 check(Array.isArray(value)&&value.length<=50,400,'wardrobe_limit','Keep up to 50 wardrobe pieces.');
 const seen=new Set<string>();
 return value.map((entry:any)=>{
  check(entry&&typeof entry==='object'&&!Array.isArray(entry),400,'invalid_wardrobe_item','Check the wardrobe details and try again.');
  const id=typeof entry.id==='string'&&/^[a-f0-9-]{1,64}$/i.test(entry.id)?entry.id:undefined;
  const name=typeof entry.name==='string'?entry.name.trim():'';
  const category=entry.category;
  const color=typeof entry.color==='string'?entry.color.trim():'';
  const notes=typeof entry.notes==='string'?entry.notes.trim():'';
  check(id&&!seen.has(id)&&name.length>0&&name.length<=80&&(WARDROBE_CATEGORIES as readonly string[]).includes(category)&&color.length<=40&&notes.length<=160,400,'invalid_wardrobe_item','Enter a name, choose a category, and keep color and notes within the shown limits.');
  seen.add(id);
  return{id,name,category,color,notes,created_at:typeof entry.created_at==='string'&&Number.isFinite(Date.parse(entry.created_at))?entry.created_at:new Date().toISOString()};
 });
}
function validMatch(value:any){
 return value&&typeof value==='object'&&['warm','cool','balanced'].includes(value.palette)&&typeof value.reason==='string'&&value.reason.length<=360&&Array.isArray(value.wardrobe_ideas)&&value.wardrobe_ideas.length===3&&value.wardrobe_ideas.every((x:unknown)=>typeof x==='string'&&x.trim().length>0&&x.length<=180);
}
export function installStyle(app:Express,db:Store,gateway?:AiGateway){
 app.get('/api/hub/style-profile',wrap(async(req,res)=>{const profile=await db.tx(r=>r.get('style_profiles',req.actor));res.json({profile:profile?{...profile,input:normalizeStyle(profile.input)}:null});}));
 app.post('/api/hub/style-profile',wrap(async(req,res)=>{
  check(req.body?.consent===true,400,'consent_required','Please agree to save your beauty and style preferences.');
  const input={} as StyleProfile;
  for(const key of Object.keys(STYLE_OPTIONS) as StyleOptionKey[]){
   const value=req.body[key]===undefined?DEFAULT_STYLE[key]:req.body[key];check((STYLE_OPTIONS[key] as readonly string[]).includes(value),400,'invalid_style','Choose a listed option for each style preference.');
   (input as any)[key]=value;
  }
  const notes=req.body.personalNotes===undefined?'':req.body.personalNotes;
  check(typeof notes==='string'&&notes.length<=500,400,'invalid_style_notes','Keep your styling brief to 500 characters.');
  input.personalNotes=notes.trim();
  const previous=await db.tx(r=>r.get<any>('style_profiles',req.actor));
  const profile={...previous,input,updated_at:new Date().toISOString(),consent_version:'2026-09-07'};
  await db.tx(r=>r.put('style_profiles',req.actor,profile));res.json({profile});
 }));
 app.get('/api/hub/wardrobe',wrap(async(req,res)=>{const state=wardrobeState(await db.tx(r=>r.get('wardrobes',req.actor)));res.set('Cache-Control','private, no-store').json({...state,limit:50});}));
 app.post('/api/hub/wardrobe',wrap(async(req,res)=>{
  check(req.body?.consent===true,400,'consent_required','Please agree to save your wardrobe pieces.');
  check(Object.prototype.hasOwnProperty.call(req.body||{},'expected_revision')&&(req.body.expected_revision===null||(typeof req.body.expected_revision==='string'&&req.body.expected_revision.length<=64)),400,'wardrobe_revision_required','Refresh your wardrobe before saving.');
  const items=validateWardrobe(req.body.items),saved=await db.tx(async r=>{await r.lock('wardrobe:'+req.actor);const current=wardrobeState(await r.get('wardrobes',req.actor));check(current.revision===req.body.expected_revision,409,'wardrobe_changed','Your wardrobe changed since you opened it. Load the latest version before saving.');const next:WardrobeState={items,revision:randomUUID(),updated_at:new Date().toISOString()};await r.put('wardrobes',req.actor,next);return next;});
  res.set('Cache-Control','private, no-store').json({...saved,limit:50});
 }));
 app.post('/api/hub/style-match',wrap(async(req:HubRequest,res)=>{
  check(req.body?.ai_consent===true,400,'ai_consent_required','Please choose whether to send your selected style details for an AI color suggestion.');
  const profile=await db.tx(r=>r.get<any>('style_profiles',req.actor));check(profile,409,'style_profile_required','Save your style profile before requesting a color suggestion.');
  const input=normalizeStyle(profile.input),fallback=preferredStylePalette(input),allowedColors=Object.fromEntries(Object.entries(STYLE_PALETTES).map(([key,colors])=>[key,colors.map(c=>c.name)]));
  const local={palette:fallback,reason:`Your selected ${input.skinUndertone==='not specified'?'color direction':input.skinUndertone+' undertone'} and color preferences suggest trying this palette first. Compare it with colors you already enjoy; this is personal styling inspiration.`,wardrobe_ideas:[`Try ${STYLE_PALETTES[fallback][0].name} as a base in a piece you already own.`,`Use ${STYLE_PALETTES[fallback][2].name} as one optional accent.`,`Compare ${STYLE_PALETTES[fallback][1].name} with your favorite neutral.`]};
  await db.tx(r=>rate(r,'style-match:'+hash(req.actor),12,60*60*1000));
  if(!gateway?.configured){res.set('Cache-Control','no-store').json({...local,source:'profile_rules',message:'AI matching is not connected right now. Here is a profile based starting point.'});return;}
  let generated:any=local;
  try{const result=await gateway.execute({task_type:'style_color_match',user_id:req.account?.id||hash(req.actor),system_prompt:'You provide optional creative wardrobe color inspiration. Use only the user-selected appearance and style descriptors and the supplied candidate palette names. Choose warm/cool/balanced color direction from selected skin undertone, hair color, eye color, and color preference. Skin depth may inform optional light/dark contrast and shade-depth ideas, but never determines undertone or worth. Face shape is not evidence for color and may only inform optional accessory placement. Never infer identity, ethnicity, health, skin condition, attractiveness, or exact product shades. Never analyze photographs. Do not select retailers, claim fit, promise results, or instruct chemical hair changes. Return only JSON with palette (warm, cool, or balanced), reason (one cautious sentence, max 360 characters), and exactly three wardrobe_ideas (each max 180 characters). Keep the user in control; describe suggestions as options to compare.',user_prompt:JSON.stringify({selected_descriptors:{face_shape:input.faceShape,skin_depth:input.skinDepth,skin_undertone:input.skinUndertone,hair_color:input.hairColor,eye_color:input.eyeColor,preferred_color_direction:input.palette,contrast:input.contrast,style_expression:input.expression,occasion:input.occasion},candidate_palette_colors:allowedColors}),output_validator:(raw:string)=>{try{return validMatch(JSON.parse(raw))?{ok:true}:{ok:false,reason:'style_match_contract_failed'};}catch{return{ok:false,reason:'style_match_json_invalid'};}}});if(result.ok&&validMatch(result.parsed))generated=result.parsed;}catch{/* Local profile rules remain available when inference is unavailable. */}
  res.set('Cache-Control','no-store').json({...generated,source:generated===local?'profile_rules':'ai',message:generated===local?'AI matching is temporarily unavailable. Here is a profile based starting point.':'AI used only the style details you selected to draft these options. Review and edit them to your taste.'});
 }));
}
