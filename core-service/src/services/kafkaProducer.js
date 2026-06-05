const { v4: uuidv4 } = require('uuid');
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
        console.log(`[KAFKA-PRODUCER] Retrying in ${waitTime / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        console.error('[KAFKA-PRODUCER] Max retries reached. Could not connect to Kafka.');
        throw error;
      }
    }
  }
}

/**
 * Publishes resolved command object to reply_commands topic
 * @param {Object} command - Command payload matching reply_commands schema without command_id
 * @returns {Promise<Object>} The published command payload including generated command_id
 */
async function publishReplyCommand(command) {
  const commandId = uuidv4();
  const fullCommand = {
    ...command,
    command_id: commandId
  };

  try {
    await producer.send({
      topic: 'reply_commands',
      messages: [
        {
          key: fullCommand.target.page_id,
          value: JSON.stringify(fullCommand)
        }
      ]
    });
    console.log(`[KAFKA] Published command_id: ${commandId} to reply_commands`);
    return fullCommand;
  } catch (error) {
    console.error(`[KAFKA-PRODUCER] Failed to publish command_id: ${commandId}. Error:`, error.message);
    throw error;
  }
}

async function publishManualReview(command) {
  const reviewCommand = {
    ...command,
    review_id: uuidv4(),
    reason: command.reason || 'manual_review',
    created_at: command.created_at || new Date().toISOString()
  };

  try {
    await producer.send({
      topic: 'manual_review',
      messages: [
        {
          key: reviewCommand.target.page_id,
          value: JSON.stringify(reviewCommand)
        }
      ]
    });
    console.log(`[KAFKA] Published review_id: ${reviewCommand.review_id} to manual_review`);
    return reviewCommand;
  } catch (error) {
    console.error(`[KAFKA-PRODUCER] Failed to publish review event. Error:`, error.message);
    throw error;
  }
}

/**
 * Gracefully disconnect producer from Kafka broker
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
  publishReplyCommand,
  publishManualReview,
  disconnectProducer
};
