const kafka = require('../config/kafka');

const producer = kafka.producer();

/**
 * Connect the Kafka producer with a retry mechanism if the broker is not ready
 */
async function connectProducer() {
  const maxRetries = 10;
  let attempt = 0;
  let connected = false;

  while (!connected && attempt < maxRetries) {
    try {
      attempt++;
      console.log(`[KAFKA-PRODUCER] Connecting producer... (Attempt ${attempt}/${maxRetries})`);
      await producer.connect();
      connected = true;
      console.log('[KAFKA-PRODUCER] Producer connected successfully.');
    } catch (error) {
      console.error(`[KAFKA-PRODUCER] Connection attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        const waitTime = 5000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Publishes failed execution event payload to send_failed topic for rescheduling
 * @param {Object} command - The original consumed command (or send_retry message)
 * @param {Error} error - Execution failure details
 */
async function publishSendFailed(command, error) {
  const retryCount = command.retry_count !== undefined ? command.retry_count : 0;
  const errorCode = error.code || 'EXECUTION_ERROR';
  const retryAfterMs = Number.isFinite(error.retryAfterMs) ? Math.max(0, error.retryAfterMs) : null;
  const backoffMs = 1000 * Math.pow(2, retryCount);
  const nextRetryDelayMs = retryAfterMs !== null ? retryAfterMs + 250 : backoffMs;
  const blockedByCircuitBreaker = errorCode === 'CIRCUIT_BREAKER_OPEN';
  
  // Extract correct fields from either direct command root or nested payload wrapper
  const payloadTarget = command.target || (command.payload && command.payload.target) || { page_id: '', comment_id: '' };
  const payloadReplyText = command.reply_text !== undefined ? command.reply_text : (command.payload && command.payload.reply_text ? command.payload.reply_text : null);
  const payloadAction = command.action || (command.payload && command.payload.action) || 'reply';

  const sendFailedEvent = {
    schema_version: 1,
    command_id: command.command_id,
    event_id: command.event_id,
    retry_count: retryCount,
    retryable: error.retryable !== false,
    error_code: errorCode,
    blocked_by_circuit_breaker: blockedByCircuitBreaker,
    retry_after_ms: retryAfterMs,
    last_error: error.message || 'Unknown execution error',
    next_retry_at: new Date(Date.now() + nextRetryDelayMs).toISOString(),
    payload: {
      action: payloadAction,
      target: payloadTarget,
      reply_text: payloadReplyText,
      intent: command.intent || (command.payload && command.payload.intent) || 'other',
      sentiment: command.sentiment || (command.payload && command.payload.sentiment) || 'neutral'
    }
  };

  try {
    await producer.send({
      topic: 'send_failed',
      messages: [
        {
          key: payloadTarget.page_id,
          value: JSON.stringify(sendFailedEvent)
        }
      ]
    });
    console.log(`[KAFKA] Published command_id: ${command.command_id} to send_failed. Retry attempt was: ${retryCount}.`);
    return sendFailedEvent;
  } catch (err) {
    console.error(`[KAFKA-PRODUCER] Failed to publish event to send_failed:`, err.message);
    throw err;
  }
}

/**
 * Gracefully disconnect producer
 */
async function disconnectProducer() {
  try {
    console.log('[KAFKA-PRODUCER] Disconnecting producer...');
    await producer.disconnect();
    console.log('[KAFKA-PRODUCER] Producer disconnected gracefully.');
  } catch (error) {
    console.error('[KAFKA-PRODUCER] Error during producer disconnect:', error.message);
  }
}

module.exports = {
  connectProducer,
  publishSendFailed,
  disconnectProducer
};
