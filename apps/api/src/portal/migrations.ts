import fs from 'node:fs';
import path from 'node:path';
import type { Pool } from 'pg';

const migrationsDirectory=()=>process.env.PORTAL_MIGRATIONS_DIR||path.resolve(__dirname,'../../../../infra/portal/migrations');
export function portalMigrationIds(directory=migrationsDirectory()):string[]{
 if(!fs.existsSync(directory))throw new Error('Production portal migration lineage is invalid.');
 return fs.readdirSync(directory).filter(file=>/^\d+_.+\.sql$/.test(file)).sort();
}

/** Verifies the target ledger without changing the database. Production migrations are manual. */
export async function verifyPortalMigrations(pool:Pick<Pool,'query'>,directory=migrationsDirectory()):Promise<void>{
 const expected=portalMigrationIds(directory);
 let rows:any[];
 try{rows=(await pool.query('SELECT id FROM portal_schema_migrations ORDER BY id')).rows||[];}catch{throw new Error('Production portal migration lineage is invalid.');}
 const applied=rows.map(row=>typeof row?.id==='string'?row.id:'');
 if(applied.length!==expected.length||applied.some((id,index)=>id!==expected[index]))throw new Error('Production portal migration lineage is invalid.');
}

/** Confirms the server-side store keeps its RLS boundary and has the reviewed role authority. */
export async function verifyPortalDatabaseSecurity(pool:Pick<Pool,'query'>):Promise<void>{
 try{
  const rls=await pool.query("SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('hub_records','portal_schema_migrations') ORDER BY c.relname");
  const authority=await pool.query("SELECT coalesce(bool_or(r.rolsuper OR r.rolbypassrls OR c.relowner=r.oid), false) AS can_bypass_rls FROM pg_roles r JOIN pg_class c ON c.oid=to_regclass('public.hub_records') WHERE r.rolname=current_user");
  const names=(rls.rows||[]).map(row=>row?.relname);
  const enabled=(rls.rows||[]).length===2&&names[0]==='hub_records'&&names[1]==='portal_schema_migrations'&&(rls.rows||[]).every(row=>row?.relrowsecurity===true);
  if(!enabled||authority.rows?.[0]?.can_bypass_rls!==true)throw new Error();
 }catch{throw new Error('Production portal database security is invalid.');}
}

/** Applies immutable, checked-in portal migrations before serving traffic. */
export async function applyPortalMigrations(pool:Pool){
 const directory=migrationsDirectory();
 if(!fs.existsSync(directory))throw new Error(`Portal migration directory is missing: ${directory}`);
 const files=portalMigrationIds(directory);
 const client=await pool.connect();
 try{
  // API and worker can start together. This startup-only lock prevents both from applying the same migration.
  await client.query("SELECT pg_advisory_lock(hashtext('portal:migrations'))");
  await client.query('CREATE TABLE IF NOT EXISTS portal_schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  for(const id of files){
   const applied=await client.query('SELECT 1 FROM portal_schema_migrations WHERE id=$1',[id]);
   if(applied.rowCount)continue;
   try{await client.query('BEGIN');await client.query(fs.readFileSync(path.join(directory,id),'utf8'));await client.query('INSERT INTO portal_schema_migrations(id) VALUES($1)',[id]);await client.query('COMMIT');}
   catch(error){await client.query('ROLLBACK');throw error;}
  }
 }finally{try{await client.query("SELECT pg_advisory_unlock(hashtext('portal:migrations'))");}finally{client.release();}}
}
