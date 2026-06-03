const { v4: uuidv4 } = require('uuid');

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
  normalizeFacebookPayload
};
