/**
 * Resolves appropriate action and reply content based on processed event characteristics
 * @param {Object} params - Input parameters containing event data and analysis outcomes
 * @param {Object} params.event - The raw event details
 * @param {string} params.intent - Event intent classified by AI or fallback rules
 * @param {string} params.sentiment - Event sentiment classified by AI or fallback rules
 * @param {boolean} params.isSpam - True if flagged as spam
 * @param {boolean} params.isRateLimit - True if flagged as rate-limited
 * @param {string|null} params.reply_suggestion - Suggestion suggested by the AI service
 * @returns {Object} Automation action containing action and reply_text keys
 */
function applyAutomationRule({ event, intent, sentiment, isSpam, isRateLimit, reply_suggestion }) {
  // 1. Spam Rule
  if (isSpam) {
    return {
      action: 'hide',
      reply_text: null
    };
  }

  // 2. Rate Limit Rule
  if (isRateLimit) {
    return {
      action: 'pending_review',
      reply_text: null
    };
  }

  // 3. Sentiment Rules (Positive/Negative)
  if (sentiment === 'positive') {
    return {
      action: 'reply',
      reply_text: 'Cảm ơn bạn đã ủng hộ shop! 🙏'
    };
  }

  if (sentiment === 'negative') {
    return {
      action: 'reply',
      reply_text: 'Shop rất xin lỗi về trải nghiệm chưa tốt. Shop sẽ liên hệ hỗ trợ bạn ngay!'
    };
  }

  // 4. Intent Rules (Price / Complaint)
  if (intent === 'ask_price') {
    return {
      action: 'reply',
      reply_text: 'Bạn ơi shop sẽ inbox báo giá chi tiết ngay nhé! 😊'
    };
  }

  if (intent === 'complaint') {
    return {
      action: 'reply',
      reply_text: 'Shop rất tiếc về vấn đề này. Bạn vui lòng inbox để shop hỗ trợ ngay!'
    };
  }

  // 5. Default Action using AI Suggestion
  return {
    action: 'reply',
    reply_text: reply_suggestion || null
  };
}

module.exports = {
  applyAutomationRule
};
