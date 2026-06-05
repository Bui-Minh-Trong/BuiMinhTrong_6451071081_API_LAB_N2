const kafka = require('../config/kafka');
const { isSpam, isRateLimit } = require('../utils/spamDetector');
const { analyzeMessage } = require('./aiService');
const { applyAutomationRule } = require('../rules/automationRule');
const { publishReplyCommand, publishManualReview } = require('./kafkaProducer');
const { hasCompletedEvent, upsertEvent } = require('./eventStatusStore');

const consumer = kafka.consumer({
  groupId: 'core-service-group'
});

const AUTO_REPLY_MESSAGES = [
  'Ban oi shop se inbox bao gia chi tiet ngay nhe!',
  'Cam on ban da ung ho shop!',
  'Shop rat xin loi vi trai nghiem chua tot. Shop se kiem tra va ho tro ban ngay!',
  'Cam on ban da de lai binh luan. Shop se phan hoi ban som!',
  'Cam on ban da de lai tin nhan. Shop se lien he ho tro ban som nhat!'
];

function normalizeText(message) {
  return String(message || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isPageSelfEvent(event) {
  return Boolean(event && event.page_id && event.user_id && String(event.page_id) === String(event.user_id));
}

function isOwnAutoReplyMessage(message) {
  const text = normalizeText(message);
  return AUTO_REPLY_MESSAGES.some((replyText) => normalizeText(replyText) === text);
}

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
        if (!eventId) {
          console.warn('[KAFKA-CONSUMER] Received raw event without event_id. Ignored.');
          return;
        }

        if (hasCompletedEvent(eventId)) {
          console.log(`[KAFKA-CONSUMER] [event_id: ${eventId}] Duplicate event detected. Skipping.`);
          return;
        }

        upsertEvent(eventId, {
          status: 'received',
          event_type: event.event_type,
          page_id: event.page_id,
          comment_id: event.comment_id,
          user_id: event.user_id,
          message: event.message,
          note: 'Consumed from raw_events'
        });

        if (isPageSelfEvent(event)) {
          upsertEvent(eventId, {
            status: 'ignored',
            note: 'Ignored page self-event to prevent auto-reply loop'
          });
          console.log(`[KAFKA-CONSUMER] [event_id: ${eventId}] Ignored page self-event. page_id=${event.page_id}, user_id=${event.user_id}`);
          return;
        }

        if (isOwnAutoReplyMessage(event.message)) {
          upsertEvent(eventId, {
            status: 'ignored',
            note: 'Ignored own auto-reply message to prevent reply loop'
          });
          console.log(`[KAFKA-CONSUMER] [event_id: ${eventId}] Ignored own auto-reply message. comment_id=${event.comment_id}`);
          return;
        }

        // Step 1: Detect Spam & Rate Limiting
        const spamFlag = isSpam(event);
        const rateLimitFlag = isRateLimit(event);
        console.log(`[KAFKA-CONSUMER] [event_id: ${eventId}] Evaluation checks - Spam: ${spamFlag}, Rate-Limit: ${rateLimitFlag}`);
        upsertEvent(eventId, {
          status: 'classifying',
          is_spam: spamFlag,
          is_rate_limited: rateLimitFlag,
          note: 'Spam and rate-limit checks completed'
        });

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
        upsertEvent(eventId, {
          status: 'classified',
          intent: aiDetails.intent,
          sentiment: aiDetails.sentiment,
          reply_suggestion: aiDetails.reply_suggestion,
          note: 'Intent and sentiment classified'
        });

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
        upsertEvent(eventId, {
          status: 'rule_applied',
          action: ruleOutput.action,
          reply_text: ruleOutput.reply_text,
          note: 'Automation rule selected an action'
        });

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

        let manualReviewEvent = null;
        if (spamFlag || rateLimitFlag || ruleOutput.action === 'manual_review') {
          manualReviewEvent = await publishManualReview({
            ...commandPayload,
            reason: spamFlag ? 'spam_detected' : 'rate_limit_detected',
            original_event: event
          });
        }

        const publishedCommand = ruleOutput.action === 'manual_review'
          ? manualReviewEvent
          : await publishReplyCommand(commandPayload);
        upsertEvent(eventId, {
          status: 'processed',
          command_id: publishedCommand.command_id || publishedCommand.review_id,
          note: manualReviewEvent
            ? 'Published to reply_commands and manual_review'
            : 'Published to reply_commands'
        });
        console.log(`[KAFKA-CONSUMER] [event_id: ${eventId}] Processing completed successfully.`);
      } catch (error) {
        upsertEvent(eventId, {
          status: 'failed',
          last_error: error.message,
          note: 'Core processing failed'
        });
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
  stopConsumer,
  isPageSelfEvent,
  isOwnAutoReplyMessage
};
