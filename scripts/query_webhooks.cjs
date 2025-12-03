const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Render external connections
});

(async () => {
  try {
    await client.connect();

    // Query the webhooks table
    const webhooks = await client.query('SELECT * FROM webhooks LIMIT 50');

    fs.writeFileSync('db_webhooks.json', JSON.stringify(webhooks.rows, null, 2));

    console.log('✅ Query complete. File written: db_webhooks.json');
  } catch (err) {
    console.error('❌ Query failed:', err);
  } finally {
    await client.end();
  }
})();
