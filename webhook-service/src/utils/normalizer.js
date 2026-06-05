const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const IGNORE_PAGE_SELF_EVENTS = process.env.IGNORE_PAGE_SELF_EVENTS !== 'false';
const AUTO_REPLY_MESSAGES = [
  'Ban oi shop se inbox bao gia chi tiet ngay nhe!',
  'Cam on ban da ung ho shop!',
  'Shop rat xin loi vi trai nghiem chua tot. Shop se kiem tra va ho tro ban ngay!',
  'Cam on ban da de lai binh luan. Shop se phan hoi ban som!',
  'Cam on ban da de lai tin nhan. Shop se lien he ho tro ban som nhat!'
];

function isPageSelfEvent(pageId, senderId) {
  return Boolean(pageId && senderId && String(pageId) === String(senderId));
}

function normalizeText(message) {
  return String(message || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function isOwnAutoReplyMessage(message) {
  const text = normalizeText(message);
  return AUTO_REPLY_MESSAGES.some((replyText) => normalizeText(replyText) === text);
}

/**
 * Normalizes raw Facebook Webhook payload into standardized raw_events schema
 * @param {Object} payload - Raw JSON body from Facebook webhook
 * @returns {Array<Object>} List of normalized events matching standard schema
 */
function normalizeFacebookPayload(payload) {
  const normalizedEvents = [];

  if (!payload || payload.object !== 'page' || !payload.entry || !Array.isArray(payload.entry)) {
    return normalizedEvents;
  }

  for (const entry of payload.entry) {
    const pageId = entry.id;

    // 1. Process Page Feed Changes (e.g. comments on posts)
    if (entry.changes && Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        if (change.field === 'feed') {
          const value = change.value;
          if (value && value.item === 'comment' && value.verb === 'add') {
            if (IGNORE_PAGE_SELF_EVENTS && isOwnAutoReplyMessage(value.message)) {
              console.log(`[WEBHOOK] Ignored own auto-reply comment. page_id=${pageId}, comment_id=${value.comment_id || ''}`);
              continue;
            }

            if (IGNORE_PAGE_SELF_EVENTS && isPageSelfEvent(pageId, value.sender_id)) {
              console.log(`[WEBHOOK] Ignored page self-comment. page_id=${pageId}, comment_id=${value.comment_id || ''}`);
              continue;
            }

            normalizedEvents.push({
              schema_version: 1,
              event_id: uuidv4(),
              event_type: 'comment_created',
              source: 'facebook',
              page_id: pageId ? String(pageId) : '',
              post_id: value.post_id ? String(value.post_id) : '',
              comment_id: value.comment_id ? String(value.comment_id) : '',
              user_id: value.sender_id ? String(value.sender_id) : '',
              message: value.message || '',
              created_at: value.created_time
                ? new Date(value.created_time * 1000).toISOString()
                : new Date().toISOString()
            });
          }
        }
      }
    }

    // 2. Process Direct Messenger Messages
    if (entry.messaging && Array.isArray(entry.messaging)) {
      for (const messagingItem of entry.messaging) {
        if (messagingItem.message && !messagingItem.message.is_echo) {
          normalizedEvents.push({
            schema_version: 1,
            event_id: uuidv4(),
            event_type: 'message_received',
            source: 'facebook',
            page_id: pageId ? String(pageId) : '',
            post_id: '',
            comment_id: messagingItem.message.mid ? String(messagingItem.message.mid) : '', // Mapped message ID to comment_id field
            user_id: messagingItem.sender && messagingItem.sender.id ? String(messagingItem.sender.id) : '',
            message: messagingItem.message.text || '',
            created_at: messagingItem.timestamp
              ? new Date(messagingItem.timestamp).toISOString()
              : new Date().toISOString()
          });
        }
      }
    }
  }

  return normalizedEvents;
}

module.exports = {
  normalizeFacebookPayload,
  isPageSelfEvent,
  isOwnAutoReplyMessage
};
