const kafka = require('../config/kafka');
const { isSpam, isRateLimit } = require('../utils/spamDetector');
const { analyzeMessage } = require('./aiService');
const { applyAutomationRule } = require('../rules/automationRule');
const { publishReplyCommand } = require('./kafkaProducer');

const consumer = kafka.consumer({
  groupId: 'core-service-group'
});

/**
 * Initializes and starts consumer listening on raw_events topic
 */
async function startConsumer() {
  const maxRetries = 10;
  let attempt = 0;
  let connected = false;

  // 1. Establish connection with broker
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
        const waitTime = 5000;
        console.log(`[KAFKA-CONSUMER] Retrying in ${waitTime / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        console.error('[KAFKA-CONSUMER] Max retries reached. Could not start Kafka consumer.');
        throw error;
      }
    }
  }

  // 2. Subscribe and run consumer loop
  await consumer.subscribe({
    topic: 'raw_events',
    fromBeginning: true
  });
  console.log('[KAFKA-CONSUMER] Subscribed to topic "raw_events"');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      let event;
      try {
        const rawString = message.value.toString();
        event = JSON.parse(rawString);
      } catch (error) {
        console.error('[KAFKA-CONSUMER] Failed to deserialize JSON event:', error.message);
        return;
      }

      const eventId = event.event_id;
      console.log(`[KAFKA-CONSUMER] [event_id: ${eventId}] Started processing event.`);

      try {
        // Step 1: Detect Spam & Rate Limiting
        const spamFlag = isSpam(event);
        const rateLimitFlag = isRateLimit(event);
        console.log(`[KAFKA-CONSUMER] [event_id: ${eventId}] Evaluation checks - Spam: ${spamFlag}, Rate-Limit: ${rateLimitFlag}`);

        // Default empty AI details
        let aiDetails = {
          intent: 'other',
          sentiment: 'neutral',
          reply_suggestion: null
        };

        // Step 2: Call AI analysis ONLY if the incoming event is clean
        if (!spamFlag && !rateLimitFlag) {
          console.log(`[KAFKA-CONSUMER] [event_id: ${eventId}] Sending content to AI service...`);
          aiDetails = await analyzeMessage(event.message);
        } else if (spamFlag) {
          aiDetails.intent = 'spam';
          aiDetails.sentiment = 'neutral';
        }

        // Step 3: Run Automation Rule
        console.log(`[KAFKA-CONSUMER] [event_id: ${eventId}] Executing automation rules engine...`);
        const ruleOutput = applyAutomationRule({
          event,
          intent: aiDetails.intent,
          sentiment: aiDetails.sentiment,
          isSpam: spamFlag,
          isRateLimit: rateLimitFlag,
          reply_suggestion: aiDetails.reply_suggestion
        });
        console.log(`[KAFKA-CONSUMER] [event_id: ${eventId}] Rule outcome: action=${ruleOutput.action}`);

        // Step 4: Dispatch command
        const commandPayload = {
          schema_version: 1,
          event_id: eventId,
          action: ruleOutput.action,
          target: {
            page_id: event.page_id,
            comment_id: event.comment_id
          },
          reply_text: ruleOutput.reply_text,
          intent: aiDetails.intent,
          sentiment: aiDetails.sentiment,
          created_at: new Date().toISOString()
        };

        await publishReplyCommand(commandPayload);
        console.log(`[KAFKA-CONSUMER] [event_id: ${eventId}] Processing completed successfully.`);
      } catch (error) {
        console.error(`[KAFKA-CONSUMER] [event_id: ${eventId}] Execution error:`, error.message);
      }
    }
  });
}

/**
 * Gracefully shuts down and disconnects Kafka consumer
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
