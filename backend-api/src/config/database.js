const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'fb_api_user',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || 'fb_api_password',
  database: process.env.DB_NAME || 'fb_api_db',
  max: 20, // max connection count
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

/**
 * Initializes database schemas automatically on startup
 */
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('[DATABASE] Verifying database tables...');

    // 1. Create Idempotency keys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        command_id UUID PRIMARY KEY,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create Comments logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        page_id VARCHAR(255) NOT NULL,
        post_id VARCHAR(255),
        comment_id VARCHAR(255) UNIQUE NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        message TEXT,
        sentiment VARCHAR(50),
        intent VARCHAR(50),
        status VARCHAR(50) DEFAULT 'PENDING',
        reply_text TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('[DATABASE] Tables verified successfully.');
  } catch (error) {
    console.error('[DATABASE] Schema initialization failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initializeDatabase
};
