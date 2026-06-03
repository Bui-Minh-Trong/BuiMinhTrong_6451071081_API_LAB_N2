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
      console.log(`[KAFKA] Connecting producer... (Attempt ${attempt}/${maxRetries})`);
      await producer.connect();
      connected = true;
      console.log('[KAFKA] Producer connected successfully.');
    } catch (error) {
      console.error(`[KAFKA] Connection attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        const waitTime = 5000;
        console.log(`[KAFKA] Retrying in ${waitTime / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        console.error('[KAFKA] Max retries reached. Could not connect to Kafka.');
        throw error;
      }
    }
  }
}

/**
 * Publish raw events to raw_events topic
 * @param {Object} event - Standardized raw_events schema object
 */
async function publishRawEvent(event) {
  try {
    await producer.send({
      topic: 'raw_events',
      messages: [
        {
          key: event.page_id,
          value: JSON.stringify(event)
        }
      ]
    });
    console.log(`[KAFKA] Published event_id: ${event.event_id} to raw_events`);
  } catch (error) {
    console.error(`[KAFKA] Failed to publish event_id: ${event.event_id}. Error:`, error.message);
    throw error;
  }
}

/**
 * Gracefully disconnect producer from Kafka broker
 */
async function disconnectProducer() {
  try {
    console.log('[KAFKA] Disconnecting producer...');
    await producer.disconnect();
    console.log('[KAFKA] Producer disconnected gracefully.');
  } catch (error) {
    console.error('[KAFKA] Error during producer disconnect:', error.message);
  }
}

module.exports = {
  connectProducer,
  publishRawEvent,
  disconnectProducer
};
