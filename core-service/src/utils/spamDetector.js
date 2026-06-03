// Memory storage for user events tracking
// Structure: Map<userId, { messages: Array<{text: string, timestamp: number}>, timestamps: Array<number> }>
const userCommentHistory = new Map();

/**
 * Cleanup helper to remove history older than target intervals
 * @param {string} userId - ID of the user to clean
 */
function cleanupHistory(userId) {
  const history = userCommentHistory.get(userId);
  if (!history) return;

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneMinuteAgo = now - 60 * 1000;

  // Filter messages older than 24h
  history.messages = history.messages.filter((item) => item.timestamp >= oneDayAgo);
  // Filter timestamps older than 1m
  history.timestamps = history.timestamps.filter((t) => t >= oneMinuteAgo);

  // Free memory if user has no recent active trace
  if (history.messages.length === 0 && history.timestamps.length === 0) {
    userCommentHistory.delete(userId);
  }
}

/**
 * Checks if the comment/message matches spam conditions
 * 1. Contains links (http, https, bit.ly, t.me)
 * 2. Duplicate text by the same user in the last 24h
 * @param {Object} event - Standard raw event payload
 * @returns {boolean} True if spam, false otherwise
 */
function isSpam(event) {
  const userId = event.user_id;
  const messageText = (event.message || '').trim().toLowerCase();

  if (!userId) return false;

  // 1. Detect links
  const linkPattern = /https?:\/\/|bit\.ly|t\.me/i;
  if (linkPattern.test(messageText)) {
    console.log(`[SPAM DETECTOR] Link detected in message from user ${userId}: "${event.message}"`);
    return true;
  }

  // Clean stale history first
  cleanupHistory(userId);

  // Retrieve or initialize history
  let history = userCommentHistory.get(userId);
  if (history) {
    // 2. Detect identical message text duplication in 24 hours
    const isDuplicate = history.messages.some((m) => m.text === messageText);
    if (isDuplicate) {
      console.log(`[SPAM DETECTOR] Content repetition detected for user ${userId}: "${event.message}"`);
      return true;
    }
  } else {
    history = { messages: [], timestamps: [] };
    userCommentHistory.set(userId, history);
  }

  // Register this message history
  history.messages.push({
    text: messageText,
    timestamp: Date.now()
  });

  return false;
}

/**
 * Checks if the user is rate limited (>20 comments/messages in 1 minute)
 * @param {Object} event - Standard raw event payload
 * @returns {boolean} True if rate limited, false otherwise
 */
function isRateLimit(event) {
  const userId = event.user_id;
  if (!userId) return false;

  // Clean stale history first
  cleanupHistory(userId);

  // Retrieve or initialize history
  let history = userCommentHistory.get(userId);
  if (!history) {
    history = { messages: [], timestamps: [] };
    userCommentHistory.set(userId, history);
  }

  const now = Date.now();
  history.timestamps.push(now);

  const oneMinuteAgo = now - 60 * 1000;
  const eventsCount = history.timestamps.filter((t) => t >= oneMinuteAgo).length;

  if (eventsCount > 20) {
    console.warn(`[SPAM DETECTOR] Rate limit exceeded for user ${userId}. Count: ${eventsCount}/20 in 1 minute.`);
    return true;
  }

  return false;
}


module.exports = {
  isSpam,
  isRateLimit,
  // Export storage for test inspection if needed
  _userCommentHistory: userCommentHistory
};
