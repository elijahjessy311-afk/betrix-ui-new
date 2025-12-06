const { Client } = require('pg');
(async ()=>{
  try{
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    await c.connect();
    const res = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='webhooks'");
    console.log('columns:', res.rows);
    await c.end();
  }catch(e){
    console.error('inspect error', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
