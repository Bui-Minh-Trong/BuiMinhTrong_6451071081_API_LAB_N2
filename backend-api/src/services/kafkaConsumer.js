const kafka = require('../config/kafka');
const idempotency = require('./idempotency');
const facebookApi = require('./facebookApi');
const { publishSendFailed } = require('./kafkaProducer');
const { pool } = require('../config/database');

const consumer = kafka.consumer({
  groupId: 'backend-api-group'
});

/**
 * Persists processed comment data to database
 */
async function saveCommentToDb(command) {
  const target = command.target || (command.payload && command.payload.target) || {};
  const pageId = target.page_id || 'UNKNOWN';
  const commentId = target.comment_id || 'UNKNOWN';
  const replyText = command.reply_text !== undefined ? command.reply_text : (command.payload ? command.payload.reply_text : null);
  const action = command.action || (command.payload && command.payload.action) || 'reply';
  const sentiment = command.sentiment || (command.payload && command.payload.sentiment) || 'neutral';
  const intent = command.intent || (command.payload && command.payload.intent) || 'other';

  // Extract post_id from comment_id if format matches pageid_postid_commentid
  let postId = null;
  if (commentId && commentId.includes('_')) {
    const parts = commentId.split('_');
    postId = parts.length >= 2 ? parts[1] : parts[0];
  }

  try {
    await pool.query(
      `INSERT INTO comments (page_id, post_id, comment_id, user_id, message, sentiment, intent, status, reply_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (comment_id) DO UPDATE SET
         status = EXCLUDED.status,
         reply_text = EXCLUDED.reply_text,
         updated_at = CURRENT_TIMESTAMP`,
      [
        pageId,
        postId,
        commentId,
        'UNKNOWN', // user_id is not present in command message payload
        'Processed event', // default message placeholder
        sentiment,
        intent,
        action.toUpperCase(),
        replyText
      ]
    );
    console.log(`[DATABASE] Saved comment event to database. comment_id: ${commentId}`);
  } catch (error) {
    console.error(`[DATABASE] Failed to write comment log for comment_id: ${commentId}. Error:`, error.message);
  }
}

/**
 * Starts consuming messages from reply_commands and send_retry topics
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

  // Subscribe to reply_commands and send_retry
  await consumer.subscribe({ topic: 'reply_commands', fromBeginning: true });
  await consumer.subscribe({ topic: 'send_retry', fromBeginning: true });
  console.log('[KAFKA-CONSUMER] Subscribed to "reply_commands" and "send_retry" topics.');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      let command;
      try {
        const rawString = message.value.toString();
        command = JSON.parse(rawString);
      } catch (error) {
        console.error('[KAFKA-CONSUMER] Failed to deserialize JSON command:', error.message);
        return;
      }

      const commandId = command.command_id;
      if (!commandId) {
        console.warn(`[KAFKA-CONSUMER] Received message without command_id on topic ${topic}. Ignored.`);
        return;
      }

      console.log(`[KAFKA-CONSUMER] [command_id: ${commandId}] Processing command from topic "${topic}"...`);

      try {
        // Step 2: Check Idempotency (skip if already successfully executed)
        const alreadyDone = await idempotency.exists(commandId);
        if (alreadyDone) {
          console.log(`[KAFKA-CONSUMER] [command_id: ${commandId}] Command already processed successfully. Skipping.`);
          return;
        }

        // Extract payload parameters
        const target = command.target || (command.payload && command.payload.target) || {};
        const replyText = command.reply_text !== undefined ? command.reply_text : (command.payload ? command.payload.reply_text : null);
        const action = command.action || (command.payload && command.payload.action) || 'reply';
        const commentId = target.comment_id;

        if (!commentId) {
          throw new Error('Missing target comment_id in payload');
        }

        // Step 3: Trigger Facebook API based on action
        if (action === 'reply') {
          if (!replyText) {
            console.warn(`[KAFKA-CONSUMER] [command_id: ${commandId}] Reply action requested but reply_text is empty. Skipping API call.`);
          } else {
            console.log(`[KAFKA-CONSUMER] [command_id: ${commandId}] Calling Facebook Graph API to reply comment: ${commentId}`);
            await facebookApi.replyComment(commentId, replyText);
          }
        } else if (action === 'hide') {
          console.log(`[KAFKA-CONSUMER] [command_id: ${commandId}] Calling Facebook Graph API to hide comment: ${commentId}`);
          await facebookApi.hideComment(commentId);
        } else if (action === 'manual_review' || action === 'pending_review') {
          console.log(`[KAFKA-CONSUMER] [command_id: ${commandId}] Action is "${action}". Stored for admin review without Graph API call.`);
        } else {
          console.log(`[KAFKA-CONSUMER] [command_id: ${commandId}] Action is "${action}". No Facebook Graph API call needed.`);
        }

        // Step 4: Success - Save comment and idempotency
        await saveCommentToDb(command);
        await idempotency.save(commandId, 'SUCCESS');
        console.log(`[KAFKA-CONSUMER] [command_id: ${commandId}] Command execution finalized as SUCCESS.`);
      } catch (error) {
        console.error(`[KAFKA-CONSUMER] [command_id: ${commandId}] Action execution failed:`, error.message);
        
        // Save status as FAILED so it can be retried later
        try {
          await idempotency.save(commandId, 'FAILED');
          await publishSendFailed(command, error);
        } catch (producerError) {
          console.error(`[KAFKA-CONSUMER] [command_id: ${commandId}] Critical fallback failed:`, producerError.message);
        }
      }
    }
  });
}

/**
 * Stops consuming
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
