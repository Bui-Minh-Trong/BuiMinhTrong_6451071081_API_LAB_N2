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
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Publishes retry request event back to send_retry topic
 * @param {Object} message - Original failed message event
 * @returns {Promise<Object>} The published payload
 */
async function publishSendRetry(message) {
  const nextAttemptCount = message.retry_count + 1;
  const nextDelay = 1000 * Math.pow(2, nextAttemptCount);
  const nextRetryTime = new Date(Date.now() + nextDelay).toISOString();

  // Preserves original structure, increments count and sets next date
  const sendRetryEvent = {
    ...message,
    retry_count: nextAttemptCount,
    next_retry_at: nextRetryTime
  };

  const key = message.payload && message.payload.target ? message.payload.target.page_id : 'default-key';

  try {
    await producer.send({
      topic: 'send_retry',
      messages: [
        {
          key,
          value: JSON.stringify(sendRetryEvent)
        }
      ]
    });
    console.log(`[KAFKA] Published command_id: ${message.command_id} to topic "send_retry". Retry count set to: ${nextAttemptCount}`);
    return sendRetryEvent;
  } catch (error) {
    console.error(`[KAFKA-PRODUCER] Failed to publish message to topic "send_retry":`, error.message);
    throw error;
  }
}

/**
 * Migrates dead commands to Dead Letter Queue (dead_letter topic)
 * @param {Object} message - Original failed message event
 * @returns {Promise<Object>} The published payload
 */
async function publishDeadLetter(message) {
  // Preserves original structure, shifts last_error to final_error and marks failed timestamp
  const deadLetterEvent = {
    ...message,
    failed_at: new Date().toISOString(),
    final_error: message.last_error || 'Execution threshold exceeded',
    original_topic: 'send_failed'
  };

  // Strip temporary transient fields
  delete deadLetterEvent.last_error;

  const key = message.payload && message.payload.target ? message.payload.target.page_id : 'default-key';

  try {
    await producer.send({
      topic: 'dead_letter',
      messages: [
        {
          key,
          value: JSON.stringify(deadLetterEvent)
        }
      ]
    });
    console.log(`[KAFKA] [DLQ] Published command_id: ${message.command_id} to topic "dead_letter"`);
    return deadLetterEvent;
  } catch (error) {
    console.error(`[KAFKA-PRODUCER] Failed to publish message to topic "dead_letter":`, error.message);
    throw error;
  }
}

/**
 * Gracefully disconnects producer
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
  publishSendRetry,
  publishDeadLetter,
  disconnectProducer
};
