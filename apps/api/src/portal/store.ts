import { Pool, type PoolConfig } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { applyPortalMigrations } from './migrations';
export type Stored<T=any>={id:string;value:T};
export interface Records {
 get<T=any>(scope:string,id:string):Promise<T|undefined>;
 put(scope:string,id:string,value:unknown):Promise<void>;
 list<T=any>(scope:string):Promise<T[]>;
 entries<T=any>(scope:string):Promise<Stored<T>[]>;
 remove(scope:string,id:string):Promise<void>;
 /** Serializes only the business record being changed, not every portal request. */
 lock(key:string):Promise<void>;
}
export interface Store { tx<T>(fn:(r:Records)=>Promise<T>):Promise<T>; close():Promise<void>; kind:string }
const schema='CREATE TABLE IF NOT EXISTS hub_records (scope TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(scope,id))';
export const portalTransactionBegin='BEGIN ISOLATION LEVEL READ COMMITTED';
type ReleasableQueryClient={query:(statement:string,...args:any[])=>Promise<any>;release:(error?:Error|boolean)=>void};
export async function rollbackPgTransaction(client:ReleasableQueryClient,original:unknown):Promise<never>{
 try{await client.query('ROLLBACK');client.release();}catch(rollback){client.release(rollback instanceof Error?rollback:new Error('Database rollback failed.'));}throw original;
}
export function destroyPgClientAfterCommitFailure(client:ReleasableQueryClient,original:unknown):never{
 client.release(original instanceof Error?original:new Error('Database commit failed.'));throw original;
}
function validateRecordGraph(value:unknown,ancestors:Set<object>=new Set(),depth=0):void{
 if(!value||typeof value!=='object')return;
 if(depth>32)throw new Error('Stored record is invalid.');
 if(ancestors.has(value))throw new Error('Stored record is invalid.');
 const items=Object.values(value);if(items.length>1000)throw new Error('Stored record is invalid.');
 ancestors.add(value);for(const item of items)validateRecordGraph(item,ancestors,depth+1);ancestors.delete(value);
}
export function serializeRecord(value:unknown):string{
 try{validateRecordGraph(value);const encoded=JSON.stringify(value,function(this:unknown,_key,item){if(typeof item==='number'&&!Number.isFinite(item))throw new Error();if(typeof item==='undefined'){if(Array.isArray(this)||_key==='')throw new Error();return item;}if(['function','symbol','bigint'].includes(typeof item))throw new Error();return item;});if(encoded===undefined||Buffer.byteLength(encoded,'utf8')>262144)throw new Error();return encoded;}catch{throw new Error('Stored record is invalid.');}
}
export function deserializeRecord<T=unknown>(encoded:unknown):T{
 try{if(typeof encoded!=='string'||Buffer.byteLength(encoded,'utf8')>262144)throw new Error();const value=JSON.parse(encoded);serializeRecord(value);return value as T;}catch{throw new Error('Stored record is invalid.');}
}
export function validateRecordAddress(scope:string,id?:string):void{
 if(!/^[a-z][a-z0-9_]{0,63}$/.test(scope)||(id!==undefined&&(Buffer.byteLength(id,'utf8')>512||id.length===0||/[\u0000-\u001f\u007f]/.test(id))))throw new Error('Stored record address is invalid.');
}
export function validateProductionDatabaseUrl(url:string,env:NodeJS.ProcessEnv=process.env):void{
 if(env.NODE_ENV!=='production')return;
 try{
  const parsed=new URL(url);
  const validProtocol=['postgres:','postgresql:'].includes(parsed.protocol);
  const singleTlsMode=parsed.searchParams.getAll('sslmode').length===1&&parsed.searchParams.get('sslmode')==='verify-full';
  const overriddenTarget=['host','hostaddr','port','user','password','database'].some(key=>parsed.searchParams.has(key));
  if(validProtocol&&parsed.hostname&&!parsed.hostname.includes('%')&&singleTlsMode&&!overriddenTarget)return;
 }catch{ /* Only a bounded diagnostic is emitted; the URL may contain credentials. */ }
 throw new Error('Production DATABASE_URL requires one host and verified TLS without query target overrides.');
}
export function portalPoolConfig(url:string):PoolConfig{
 return {connectionString:url,application_name:'mgt_skin_care_portal',max:10,connectionTimeoutMillis:5000,statement_timeout:10000,query_timeout:12000,lock_timeout:5000,idle_in_transaction_session_timeout:15000,idleTimeoutMillis:30000,maxLifetimeSeconds:300,keepAlive:true,keepAliveInitialDelayMillis:10000};
}
type PoolErrorSource={on:(event:'error',listener:(error:Error&{code?:string})=>void)=>unknown};
export function installDatabasePoolErrorBoundary(pool:PoolErrorSource,log:(record:{event:string;code:string})=>void=(record)=>console.error(JSON.stringify(record))):void{
 pool.on('error',error=>{
  const code=typeof error.code==='string'&&/^[A-Z0-9_]{1,16}$/.test(error.code)?error.code:'database_pool_error';
  log({event:'database_pool_error',code});
 });
}
export class PgStore implements Store{
 kind='postgres'; private pool:Pool;
 constructor(url:string,env:NodeJS.ProcessEnv=process.env){validateProductionDatabaseUrl(url,env);this.pool=new Pool(portalPoolConfig(url));installDatabasePoolErrorBoundary(this.pool);}
 async init(migrate=false){
  try{
   if(migrate)await applyPortalMigrations(this.pool);
   // Connecting an imported database must not implicitly choose a migration lineage.
   await this.pool.query('SELECT scope,id,body FROM hub_records LIMIT 0');
   return this;
  }catch(error){await this.pool.end();throw error;}
 }
 async tx<T>(fn:(r:Records)=>Promise<T>):Promise<T>{const c=await this.pool.connect();let committing=false;try{await c.query(portalTransactionBegin);const r:Records={
 get:async(s,i)=>{validateRecordAddress(s,i);const q=await c.query('SELECT body FROM hub_records WHERE scope=$1 AND id=$2',[s,i]);return q.rows[0]?deserializeRecord(q.rows[0].body):undefined;},
 put:async(s,i,v)=>{validateRecordAddress(s,i);await c.query('INSERT INTO hub_records(scope,id,body) VALUES($1,$2,$3) ON CONFLICT(scope,id) DO UPDATE SET body=excluded.body',[s,i,serializeRecord(v)]);},
 list:async(s)=>{validateRecordAddress(s);const q=await c.query('SELECT body FROM hub_records WHERE scope=$1 ORDER BY id',[s]);return q.rows.map(x=>deserializeRecord(x.body));},
 entries:async(s)=>{validateRecordAddress(s);const q=await c.query('SELECT id,body FROM hub_records WHERE scope=$1 ORDER BY id',[s]);return q.rows.map(x=>({id:x.id,value:deserializeRecord(x.body)}));},
 remove:async(s,i)=>{validateRecordAddress(s,i);await c.query('DELETE FROM hub_records WHERE scope=$1 AND id=$2',[s,i]);},
 lock:async(key)=>{if(!/^[a-zA-Z0-9:_-]{1,240}$/.test(key))throw new Error('Invalid transaction lock key.');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[key]);}
 };const result=await fn(r);committing=true;await c.query('COMMIT');c.release();return result;}catch(e){if(committing)return destroyPgClientAfterCommitFailure(c,e);return rollbackPgTransaction(c,e);}}
 async close(){await this.pool.end();}
}
export function startupMigrations(env:NodeJS.ProcessEnv){
 if(env.NODE_ENV==='production'&&env.PORTAL_AUTO_MIGRATE!=='false')throw new Error('Production database changes require an explicit no-auto-migration declaration.');
 return env.PORTAL_AUTO_MIGRATE==='true';
}
// SQLite is a persistent local development adapter. Production requires PostgreSQL.
// Only this queue accesses the connection; asynchronous callbacks cannot overlap transactions.
export class LocalStore implements Store{
 kind='sqlite';private db:any;private tail:Promise<any>=Promise.resolve();
 constructor(file:string){if(file!==':memory:')fs.mkdirSync(path.dirname(file),{recursive:true});const {DatabaseSync}=require('node:sqlite');this.db=new DatabaseSync(file);this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;');this.db.exec(schema);}
 tx<T>(fn:(r:Records)=>Promise<T>):Promise<T>{const run=async()=>{this.db.exec('BEGIN IMMEDIATE');const r:Records={
 get:async(s,i)=>{validateRecordAddress(s,i);const v=this.db.prepare('SELECT body FROM hub_records WHERE scope=? AND id=?').get(s,i);return v?deserializeRecord(v.body):undefined;},
 put:async(s,i,v)=>{validateRecordAddress(s,i);this.db.prepare('INSERT INTO hub_records(scope,id,body) VALUES(?,?,?) ON CONFLICT(scope,id) DO UPDATE SET body=excluded.body').run(s,i,serializeRecord(v));},
 list:async(s)=>{validateRecordAddress(s);return this.db.prepare('SELECT body FROM hub_records WHERE scope=? ORDER BY id').all(s).map((x:any)=>deserializeRecord(x.body));},
 entries:async(s)=>{validateRecordAddress(s);return this.db.prepare('SELECT id,body FROM hub_records WHERE scope=? ORDER BY id').all(s).map((x:any)=>({id:x.id,value:deserializeRecord(x.body)}));},
 remove:async(s,i)=>{validateRecordAddress(s,i);this.db.prepare('DELETE FROM hub_records WHERE scope=? AND id=?').run(s,i);},
 lock:async()=>{}
 };try{const result=await fn(r);this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}};
 const pending=this.tail.then(run);this.tail=pending.catch(()=>{});return pending;}
 async close(){await this.tail;this.db.close();}
}
