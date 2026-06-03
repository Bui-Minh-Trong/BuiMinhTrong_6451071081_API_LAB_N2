const { pool } = require('../config/database');

/**
 * Checks if a command has already been evaluated/processed
 * @param {string} commandId - UUID command ID
 * @returns {Promise<boolean>} True if processed, false otherwise
 */
async function exists(commandId) {
  if (!commandId) return false;

  try {
    const result = await pool.query(
      "SELECT status FROM idempotency_keys WHERE command_id = $1 AND status = 'SUCCESS'",
      [commandId]
    );

    if (result.rows.length > 0) {
      console.log(`[IDEMPOTENCY] Duplicate command detected for commandId: ${commandId}. Status is already SUCCESS.`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[IDEMPOTENCY] Failed to check key existence for commandId: ${commandId}`, error.message);
    // Safe default to avoid re-execution in case of query failures, or throw?
    // Let's throw so the consumer handles it by crashing/retrying connection
    throw error;
  }
}

/**
 * Saves or updates a command ID execution state
 * @param {string} commandId - UUID command ID
 * @param {string} status - 'SUCCESS' or 'FAILED' or 'PROCESSING'
 */
async function save(commandId, status) {
  if (!commandId) return;

  try {
    await pool.query(
      `INSERT INTO idempotency_keys (command_id, status)
       VALUES ($1, $2)
       ON CONFLICT (command_id) DO UPDATE SET status = EXCLUDED.status`,
      [commandId, status]
    );
    console.log(`[IDEMPOTENCY] Saved execution state for commandId: ${commandId} as: ${status}`);
  } catch (error) {
    console.error(`[IDEMPOTENCY] Failed to save execution status for commandId: ${commandId}`, error.message);
    throw error;
  }
}

module.exports = {
  exists,
  save
};
