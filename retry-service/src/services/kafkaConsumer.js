const kafka = require('../config/kafka');
const { publishSendRetry, publishDeadLetter } = require('./kafkaProducer');
require('dotenv').config();

const MAX_RETRY = parseInt(process.env.MAX_RETRY) || 3;

const consumer = kafka.consumer({
  groupId: 'retry-service-group'
});

/**
 * Connect consumer and start listening to send_failed topic
 */
async function startConsumer() {
  const maxRetries = 10;
  let attempt = 0;
  let connected = false;

  while (!connected && attempt < maxRetries) {
    try {
      attempt++;
      console.log(`[KAFKA-CONSUMER] Connecting consumer... (Attempt ${attempt}/${maxRetries})`);
      await consumer.connect();
      connected = true;
      console.log('[KAFKA-CONSUMER] Consumer connected successfully.');
    } catch (error) {
      console.error(`[KAFKA-CONSUMER] Connection attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        throw error;
      }
    }
  }

  await consumer.subscribe({ topic: 'send_failed', fromBeginning: true });
  console.log('[KAFKA-CONSUMER] Subscribed to topic "send_failed"');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      let failedEvent;
      try {
        const rawString = message.value.toString();
        failedEvent = JSON.parse(rawString);
      } catch (error) {
        console.error('[KAFKA-CONSUMER] Failed to deserialize JSON error payload:', error.message);
        return;
      }

      const commandId = failedEvent.command_id;
      const retryCount = failedEvent.retry_count !== undefined ? failedEvent.retry_count : 0;

      // 1. Calculate Backoff Delay
      const delayMs = 1000 * Math.pow(2, retryCount);
      console.log(`[RETRY] attempt: ${retryCount}, delay: ${delayMs / 1000}s, command_id: ${commandId}`);

      // 2. Perform backoff delay waiting
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      try {
        // 3. Evaluate attempt bounds against threshold
        if (retryCount < MAX_RETRY) {
          await publishSendRetry(failedEvent);
        } else {
          await publishDeadLetter(failedEvent);
          console.warn(`[DLQ] command_id: ${commandId} moved to dead_letter. Retries exceeded limit (${retryCount}/${MAX_RETRY})`);
        }
      } catch (error) {
        console.error(`[KAFKA-CONSUMER] Error processing retry routing for command_id: ${commandId}:`, error.message);
      }
    }
  });
}

/**
 * Shuts down consumer connection gracefully
 */
async function stopConsumer() {
  try {
    console.log('[KAFKA-CONSUMER] Stopping consumer...');
    await consumer.disconnect();
    console.log('[KAFKA-CONSUMER] Consumer stopped gracefully.');
  } catch (error) {
    console.error('[KAFKA-CONSUMER] Error during consumer disconnect:', error.message);
  }
}

module.exports = {
  startConsumer,
  stopConsumer
};
