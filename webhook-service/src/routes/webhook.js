const express = require('express');
const router = express.Router();
const verifySignature = require('../middleware/verifySignature');
const { normalizeFacebookPayload } = require('../utils/normalizer');
const { publishRawEvent } = require('../services/kafkaProducer');

// GET /webhook - Facebook Webhook Subscription Verification
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = process.env.VERIFY_TOKEN || process.env.FACEBOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WEBHOOK] Webhook successfully verified.');
    return res.status(200).send(challenge);
  } else {
    console.warn('[WEBHOOK] Verification failed. Mode or Token mismatch.');
    return res.status(403).json({
      success: false,
      data: null,
      error: {
        code: 'FORBIDDEN',
        message: 'Verification token mismatch or invalid hub mode'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// POST /webhook - Receive Facebook events (comments, messages)
router.post('/webhook', verifySignature, (req, res) => {
  console.log('[WEBHOOK] Received Facebook webhook payload.');

  // Enforce immediate response to Facebook before heavy processing
  res.status(200).json({
    success: true,
    data: {
      status: 'received'
    },
    error: null,
    timestamp: new Date().toISOString()
  });

  // Asynchronous processing (non-blocking)
  processPayloadAsync(req.body).catch((error) => {
    console.error('[WEBHOOK] Async payload processing failed:', error.message);
  });
});

/**
 * Normalizes webhook payload and publishes to Kafka topic raw_events
 * @param {Object} body - Webhook raw JSON body
 */
async function processPayloadAsync(body) {
  try {
    console.log('[WEBHOOK] Starting asynchronous payload normalization...');
    const normalizedEvents = normalizeFacebookPayload(body);
    console.log(`[WEBHOOK] Normalized ${normalizedEvents.length} events from payload.`);

    for (const event of normalizedEvents) {
      console.log(`[WEBHOOK] Dispatching event [id: ${event.event_id}, type: ${event.event_type}] to Kafka...`);
      await publishRawEvent(event);
    }
  } catch (error) {
    console.error('[WEBHOOK] Error processing payload: ', error);
  }
}

module.exports = router;
