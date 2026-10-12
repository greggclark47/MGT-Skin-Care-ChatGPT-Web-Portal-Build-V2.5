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
export function serializeRecord(value:unknown):string{
 try{const encoded=JSON.stringify(value,(_key,item)=>{if(typeof item==='number'&&!Number.isFinite(item))throw new Error();return item;});if(encoded===undefined)throw new Error();return encoded;}catch{throw new Error('Stored record is invalid.');}
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
 async tx<T>(fn:(r:Records)=>Promise<T>):Promise<T>{const c=await this.pool.connect();try{await c.query('BEGIN');const r:Records={
 get:async(s,i)=>{const q=await c.query('SELECT body FROM hub_records WHERE scope=$1 AND id=$2',[s,i]);return q.rows[0]?JSON.parse(q.rows[0].body):undefined;},
 put:async(s,i,v)=>{await c.query('INSERT INTO hub_records(scope,id,body) VALUES($1,$2,$3) ON CONFLICT(scope,id) DO UPDATE SET body=excluded.body',[s,i,serializeRecord(v)]);},
 list:async(s)=>{const q=await c.query('SELECT body FROM hub_records WHERE scope=$1 ORDER BY id',[s]);return q.rows.map(x=>JSON.parse(x.body));},
 entries:async(s)=>{const q=await c.query('SELECT id,body FROM hub_records WHERE scope=$1 ORDER BY id',[s]);return q.rows.map(x=>({id:x.id,value:JSON.parse(x.body)}));},
 remove:async(s,i)=>{await c.query('DELETE FROM hub_records WHERE scope=$1 AND id=$2',[s,i]);},
 lock:async(key)=>{if(!/^[a-zA-Z0-9:_-]{1,240}$/.test(key))throw new Error('Invalid transaction lock key.');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[key]);}
 };const result=await fn(r);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
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
 constructor(file:string){if(file!==':memory:')fs.mkdirSync(path.dirname(file),{recursive:true});const {DatabaseSync}=require('node:sqlite');this.db=new DatabaseSync(file);this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');this.db.exec(schema);}
 tx<T>(fn:(r:Records)=>Promise<T>):Promise<T>{const run=async()=>{this.db.exec('BEGIN IMMEDIATE');const r:Records={
 get:async(s,i)=>{const v=this.db.prepare('SELECT body FROM hub_records WHERE scope=? AND id=?').get(s,i);return v?JSON.parse(v.body):undefined;},
 put:async(s,i,v)=>{this.db.prepare('INSERT INTO hub_records(scope,id,body) VALUES(?,?,?) ON CONFLICT(scope,id) DO UPDATE SET body=excluded.body').run(s,i,serializeRecord(v));},
 list:async(s)=>this.db.prepare('SELECT body FROM hub_records WHERE scope=? ORDER BY id').all(s).map((x:any)=>JSON.parse(x.body)),
 entries:async(s)=>this.db.prepare('SELECT id,body FROM hub_records WHERE scope=? ORDER BY id').all(s).map((x:any)=>({id:x.id,value:JSON.parse(x.body)})),
 remove:async(s,i)=>{this.db.prepare('DELETE FROM hub_records WHERE scope=? AND id=?').run(s,i);},
 lock:async()=>{}
 };try{const result=await fn(r);this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}};
 const pending=this.tail.then(run);this.tail=pending.catch(()=>{});return pending;}
 async close(){await this.tail;this.db.close();}
}
