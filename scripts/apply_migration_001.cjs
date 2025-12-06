const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
(async ()=>{
  try{
    const databaseUrl = process.env.DATABASE_URL;
    if(!databaseUrl){ console.error('DATABASE_URL required'); process.exit(2); }
    const pool = new Pool({ connectionString: databaseUrl });
    const client = await pool.connect();
    const p = path.join(process.cwd(), 'migrations', '001_create_users_payments.sql');
    const sql = fs.readFileSync(p,'utf8');
    console.log('Running 001 migration');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('001 migration applied');
    client.release();
    await pool.end();
  }catch(e){ console.error('migration001 failed', e && e.message ? e.message : e); process.exit(1); }
})();
