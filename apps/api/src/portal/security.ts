import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
import type {Request,Response,NextFunction} from 'express';
import type {Store,Records} from './store';
export const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export const token=()=>randomBytes(32).toString('hex');
export class Fault extends Error{constructor(public status:number,public code:string,message:string){super(message);}}
export function check(ok:unknown,status:number,code:string,message:string):asserts ok{if(!ok)throw new Fault(status,code,message);}
export type HubRequest=Request & {sid:string;actor:string;csrf:string;account?:{id:string,email:string,roles:string[]};requestId:string};
export type Session={id:string;actor:string;csrf:string;expires:number;userId?:string};
export const wrap=(fn:(req:HubRequest,res:Response,next:NextFunction)=>Promise<any>)=>(req:Request,res:Response,next:NextFunction)=>Promise.resolve(fn(req as HubRequest,res,next)).catch(next);
const same=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function hasExactOrigin(value:string|string[]|undefined,expected:string):boolean{return typeof value==='string'&&typeof expected==='string'&&expected.length>0&&Buffer.byteLength(expected,'utf8')<=2048&&value===expected;}
export function sessionCookieValue(header:string|string[]|undefined,name:string):string|undefined{
 if(typeof header!=='string'||typeof name!=='string'||!/^[A-Za-z0-9_-]{1,32}$/.test(name))return undefined;
 const matches=header.split(';').map(value=>value.trim()).filter(value=>value.startsWith(name+'='));
 if(matches.length!==1)return undefined;
 const value=matches[0].slice(name.length+1);
 return /^[a-f0-9]{64}$/.test(value)?value:undefined;
}
export function sessionRateSource(req:Request,production:boolean,edgeToken?:string):string{
 const socketAddress=req.socket.remoteAddress||'unknown';
 const submittedToken=req.headers['x-mgt-edge-token'];
 const submittedAddress=req.headers['x-mgt-client-ip'];
 if(!production||typeof edgeToken!=='string'||edgeToken.length<32||typeof submittedToken!=='string'||typeof submittedAddress!=='string'||!isIP(submittedAddress))return socketAddress;
 const expected=createHash('sha256').update(edgeToken).digest();
 const received=createHash('sha256').update(submittedToken).digest();
 return timingSafeEqual(expected,received)?submittedAddress:socketAddress;
}
export function sessionMiddleware(store:Store,origin:string,production:boolean,edgeToken?:string){
 const cookie=production?'__Host-mgt':'mgt';
 return wrap(async(req,res,next)=>{
  const raw=sessionCookieValue(req.headers.cookie,cookie);
  const session=await store.tx(async db=>{
   const sessionId=raw&&/^[a-f0-9]{64}$/.test(raw)?hash(raw):undefined;
   if(sessionId)await db.lock('session:'+sessionId);
   let s=sessionId?await db.get<Session>('sessions',sessionId):undefined;
   if(s&&s.expires<=Date.now()){await db.remove('sessions',s.id);s=undefined;}
   if(s?.userId){const user=await db.get('accounts',s.userId);if(user)req.account=user;else{await db.remove('sessions',s.id);s=undefined;}}
   if(!s){const edgeSource=sessionRateSource(req,production,edgeToken);
    await rate(db,'session-create:'+hash(edgeSource),120,10*60000);
    const secret=token();s={id:hash(secret),actor:'guest_'+token(),csrf:token(),expires:Date.now()+86400000};
    await db.put('sessions',s.id,s);res.cookie(cookie,secret,{httpOnly:true,secure:production,sameSite:'lax',path:'/',maxAge:86400000});}
   return s;
  });
  req.sid=session.id;req.actor=session.actor;req.csrf=session.csrf;
  if(!['GET','HEAD','OPTIONS'].includes(req.method)){
   check(hasExactOrigin(req.headers.origin,origin),403,'origin_rejected','This request must come from the portal.');
   check(typeof req.headers['x-csrf-token']==='string'&&same(req.headers['x-csrf-token'],session.csrf),403,'csrf_rejected','Refresh this page and try again.');
  }
  next();
 });
}
export async function rate(db:Records,key:string,limit:number,windowMs:number){
 if(typeof key!=='string'||key.length===0||Buffer.byteLength(key,'utf8')>200||/[\u0000-\u001f\u007f]/.test(key)||!/^[A-Za-z0-9:_./-]+$/.test(key)||!Number.isSafeInteger(limit)||limit<1||limit>1_000_000||!Number.isSafeInteger(windowMs)||windowMs<1||windowMs>7*86400000)throw new Error('Rate policy is invalid.');
 await db.lock('rate:'+key);
 const now=Date.now();let r=await db.get('rate',key);if(!r||r.reset<=now)r={id:key,count:0,reset:now+windowMs};r.count++;await db.put('rate',key,r);
 check(r.count<=limit,429,'rate_limited','Too many requests. Please wait and try again.');
}
export function account(req:HubRequest){check(req.account,401,'sign_in_required','Please sign in to continue.');return req.account;}
export function role(req:HubRequest,allowed:string[]){const a=account(req);check(a.roles.some(r=>allowed.includes(r)),403,'forbidden','Your account does not have access to this action.');return a;}
export function text(v:unknown,max=2000){check(Number.isSafeInteger(max)&&max>=1&&max<=1_000_000&&typeof v==='string'&&v.trim().length>0&&Buffer.byteLength(v,'utf8')<=max&&!/[\u0000\u007f]/.test(v),400,'invalid_input','Please enter a valid value.');return (v as string).trim();}
