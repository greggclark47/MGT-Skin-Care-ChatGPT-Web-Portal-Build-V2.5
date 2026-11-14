import {classify,buildRoutine,buildMatchIntelligence,scoreProduct,compileMatrix,ingredientAllowedByMatrix,SEED_INGREDIENT_RULES,type CandidateProduct,type SkinProfileInput,type RoutineSlot,type ScoreResult} from '@mgt/domain';
import {SEED_CATALOG} from '../modules/catalog/store';
import {check} from './security';
import type {Records,Store} from './store';
export interface Product extends CandidateProduct {name:string;description:string;sample:boolean;stock:number;merchant_id:string;image_url?:string;approved:boolean;approved_by?:string;updated_by?:string}
export const names:Record<string,string>={'cleanser-gentle':'Gentle daily cleanser','cleanser-salicylic':'Clarifying cleanser','treatment-niacinamide':'Niacinamide concentrate','treatment-retinol':'Retinol night treatment','moisturizer-gel':'Lightweight moisture gel','moisturizer-rich':'Rich barrier cream','spf-lightweight':'Daily sun protection','toner-hydrating':'Hydrating toner','eye-cream-basic':'Everyday eye cream'};
export const REQUIRED_CATALOG_SLOTS=['cleanser','treatment','moisturizer','sunscreen'] as const;
const INGREDIENT_KEY=/^[a-z0-9_]{1,80}$/;
export function publicCatalogProduct(product:Product){
 const slots=['cleanser','toner','serum','treatment','moisturizer','sunscreen','eye'];
 if(!product||typeof product!=='object'||Array.isArray(product)||typeof product.id!=='string'||product.id.length<1||product.id.length>120||/[\u0000\u007f]/.test(product.id)||product.name!==undefined&&typeof product.name!=='string'||typeof product.name==='string'&&(product.name.trim().length<1||Buffer.byteLength(product.name,'utf8')>160||/[\u0000\u007f]/.test(product.name))||product.description!==undefined&&typeof product.description!=='string'||typeof product.description==='string'&&(Buffer.byteLength(product.description,'utf8')>1200||/[\u0000\u007f]/.test(product.description))||!slots.includes(product.slot))return null;
 return{id:product.id,name:typeof product.name==='string'&&product.name.trim()?product.name:product.id,description:typeof product.description==='string'?product.description:'',slot:product.slot};
}

export function assessCatalogHealth(products:readonly any[],rules:readonly any[],demo:boolean){
 const active=products.filter(product=>product?.status==='active');
 const approvedRuleRows=rules.filter(rule=>rule?.status==='approved');
 const approvedRules=new Set(approvedRuleRows.filter(rule=>typeof rule?.ingredient_key==='string'&&INGREDIENT_KEY.test(rule.ingredient_key)&&rule?.sme_approved_by&&!rule?.sample).map(rule=>rule.ingredient_key));
 const invalidApprovedRules=approvedRuleRows.filter(rule=>typeof rule?.ingredient_key!=='string'||!INGREDIENT_KEY.test(rule.ingredient_key)||!rule?.sme_approved_by||rule?.sample).length;
 const invalidActive=active.filter(product=>!Array.isArray(product.ingredients)||product.ingredients.length===0||product.ingredients.some((ingredient:unknown)=>typeof ingredient!=='string'||!INGREDIENT_KEY.test(ingredient)));
 const unreviewedIngredientKeys=[...new Set(active.flatMap(product=>Array.isArray(product?.ingredients)?product.ingredients:[]).filter((ingredient:unknown):ingredient is string=>typeof ingredient==='string'&&INGREDIENT_KEY.test(ingredient)&&!approvedRules.has(ingredient)))].sort();
 const eligible=active.filter(product=>product?.approved===true&&!product?.sample&&Number.isInteger(product?.stock)&&product.stock>0&&Array.isArray(product?.ingredients)&&product.ingredients.length>0&&product.ingredients.every((ingredient:unknown)=>typeof ingredient==='string'&&INGREDIENT_KEY.test(ingredient)&&approvedRules.has(ingredient)));
 const slotCoverage=REQUIRED_CATALOG_SLOTS.map(slot=>{const rows=active.filter(product=>product.slot===slot);return{slot,active:rows.length,approved:rows.filter(product=>product.approved&&!product.sample).length,eligible:eligible.filter(product=>product.slot===slot).length,sample:rows.filter(product=>product.sample).length};});
 const warnings:string[]=[];
 if(demo)warnings.push('Demo mode is sample-only; approved production catalog data is still required.');
 if(!products.length)warnings.push('No catalog products are loaded.');
 if(!active.length)warnings.push('No active catalog products are available for matching.');
 if(!demo&&products.some(product=>product.sample))warnings.push('Sample products are present in a production catalog.');
 if(!demo&&active.some(product=>!product.approved||product.sample))warnings.push('Active catalog products must be approved and non-sample.');
 for(const row of slotCoverage){
  if(row.active===0)warnings.push(`Required routine slot has no active products: ${row.slot}.`);
  else if(!demo&&row.eligible===0)warnings.push(`Required routine slot has no eligible approved product: ${row.slot}.`);
 }
 if(invalidActive.length)warnings.push(`${invalidActive.length} active product${invalidActive.length===1?'':'s'} have missing or invalid ingredient data.`);
 if(unreviewedIngredientKeys.length)warnings.push(`${unreviewedIngredientKeys.length} active ingredient key${unreviewedIngredientKeys.length===1?'':'s'} lack an approved SME rule.`);
 if(invalidApprovedRules)warnings.push(`${invalidApprovedRules} approved ingredient rule${invalidApprovedRules===1?'':'s'} lack a valid key, independent SME approval, or production-safe status.`);
 return{mode:demo?'demo':'production',ready:warnings.length===0,products:{total:products.length,active:active.length,approved:products.filter(product=>product.approved&&!product.sample).length,eligible:eligible.length,sample:products.filter(product=>product.sample).length,invalid_active:invalidActive.length},slot_coverage:slotCoverage,rules:{total:rules.length,approved:approvedRules.size,sample:rules.filter(rule=>rule.sample).length,invalid_approved:invalidApprovedRules,unreviewed_ingredient_count:unreviewedIngredientKeys.length,unreviewed_ingredients:unreviewedIngredientKeys.slice(0,50)},warnings,note:'Counts are metadata-only. Product names, customer profiles and vendor details are intentionally excluded.'};
}
export async function initializeCatalog(store:Store,demo:boolean){await store.tx(async db=>{if(demo){
 for(const p of SEED_CATALOG){const existing=await db.get<Product>('products',p.id);if(!existing||existing.sample)await db.put('products',p.id,{...p,name:names[p.id],description:'Sample catalog item from the MGT v2 blueprint. Not available for purchase.',sample:true,stock:100,merchant_id:'sample',approved:false});}
 for(const r of SEED_INGREDIENT_RULES){const existing=await db.get<any>('rules',r.ingredient_key);if(!existing||existing.sample)await db.put('rules',r.ingredient_key,{...r,status:'draft',sample:true});}
}});}
export async function match(db:Records,input:SkinProfileInput,demo:boolean,feedbackExcludedProductIds:readonly string[]=[]){
 const c=classify(input);
 // v2 used conflicting ceiling definitions. The portal applies the user tolerance directly:
 // lower means more reactive. All ingredient eligibility uses the versioned matrix, never the old constant loader.
 c.profile_vector.sensitivity_ceiling={none:.9,mild:.65,moderate:.4,high:.15}[input.sensitivity];
 const allRules=await db.list('rules'),allProducts=await db.list<Product>('products');
 check(demo||assessCatalogHealth(allProducts,allRules,false).ready,503,'catalog_review_pending','Recommendations are awaiting complete catalog and ingredient review.');
 let rules=allRules;rules=rules.filter(r=>demo?r.sample||r.status==='approved':r.status==='approved'&&r.sme_approved_by&&!r.sample);
 check(rules.length,503,'safety_review_pending','Recommendations are awaiting ingredient review.');
 const matrix=compileMatrix(rules.map(r=>({...r,status:'approved'})));
 const products=allProducts.filter(p=>p.status==='active'&&p.stock>0&&(demo||p.approved&&!p.sample));
 const feedbackExclusions=new Set(feedbackExcludedProductIds.filter(id=>typeof id==='string'&&id.length>0));
 const safetyEligible=products.filter(p=>p.ingredients.length>0&&p.ingredients.every(i=>matrix.rules.has(i)&&ingredientAllowedByMatrix(i,matrix,c.profile_vector.sensitivity_ceiling,c.avoid_flags,input.ingredient_avoidances)));
 // Count every saved exclusion that still exists in the reviewed catalog. A later safety
 // filter can independently remove the same product, but that must not erase the person's
 // feedback from the explainability summary.
 const feedbackExcludedProductIdsInCatalog=products.filter(product=>feedbackExclusions.has(product.id)).map(product=>product.id);
 const eligible=safetyEligible.filter(product=>!feedbackExclusions.has(product.id));
 const slots=new Map<RoutineSlot,ScoreResult[]>();const ingredients=new Map<string,string[]>();
 for(const p of eligible){
  // Safety is already applied by the reviewed matrix. The legacy scorer is used for ranking only.
  const scored=scoreProduct({...p,ingredients:[]},c.profile_vector,{fragrance:false,essential_oils:false,alcohol_denat:false,physical_exfoliants:false,high_strength_actives:false},[],input.budget_range);
  if(!scored.excluded){slots.set(p.slot,[...(slots.get(p.slot)||[]),scored].sort((a,b)=>b.score-a.score));ingredients.set(p.id,p.ingredients);}
 }
 let routine=buildRoutine(slots,ingredients);
 if(input.current_routine!=='advanced')routine={...routine,steps:routine.steps.filter(s=>!s.is_optional)};
 const match_intelligence=buildMatchIntelligence({profile_input:input,profile_vector:c.profile_vector,routine,slot_results:slots,products:eligible,safety_matrix_version:matrix.matrix_version,excluded_products:products.length-eligible.length,feedback_excluded_product_ids:feedbackExcludedProductIdsInCatalog});
 // No unreviewed pairing advice or photos in this release. Full label directions remain authoritative.
 return {input,...c,routine,match_intelligence,matrix_version:matrix.matrix_version,results:[...slots.values()].flat(),created_at:new Date().toISOString(),sample:demo};
}
export function quote(cart:{items:{product_id:string,quantity:number}[]},products:Product[],premium:boolean,strict=true){
 const items=cart.items.map(i=>{const p=products.find(p=>p.id===i.product_id);const available=!!p&&p.status==='active'&&p.stock>=i.quantity;if(strict)check(available,409,'product_unavailable','A product is no longer available in that quantity.');return {product_id:i.product_id,name:p?.name||'Unavailable product',quantity:i.quantity,unit_price_cents:p?.price_cents||0,merchant_id:p?.merchant_id||'',sample:p?.sample||false,approved:p?.approved||false,available};});
 const subtotal=items.reduce((s,i)=>s+i.unit_price_cents*i.quantity,0);
 if(premium)for(const item of items)item.unit_price_cents-=Math.round(item.unit_price_cents*.05);
 const total=items.reduce((s,i)=>s+i.unit_price_cents*i.quantity,0);
 return {items,subtotal_cents:subtotal,discount_cents:subtotal-total,total_cents:total,currency:'usd',tax_shipping_at_checkout:true};
}
