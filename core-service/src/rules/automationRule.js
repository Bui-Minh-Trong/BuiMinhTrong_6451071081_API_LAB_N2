function applyAutomationRule({ intent, sentiment, isSpam, isRateLimit, reply_suggestion }) {
  if (isSpam) {
    return {
      action: 'hide',
      reply_text: null
    };
  }

  if (isRateLimit) {
    return {
      action: 'pending_review',
      reply_text: null
    };
  }

  if (sentiment === 'positive') {
    return {
      action: 'reply',
      reply_text: 'Cam on ban da ung ho shop!'
    };
  }

  if (sentiment === 'negative') {
    return {
      action: 'reply',
      reply_text: 'Shop rat xin loi vi trai nghiem chua tot. Shop se kiem tra va ho tro ban ngay!'
    };
  }

  if (intent === 'ask_price') {
    return {
      action: 'reply',
      reply_text: 'Ban oi shop se inbox bao gia chi tiet ngay nhe!'
    };
  }

  if (intent === 'complaint') {
    return {
      action: 'reply',
      reply_text: 'Shop rat xin loi vi trai nghiem chua tot. Shop se kiem tra va ho tro ban ngay!'
    };
  }

  return {
    action: 'reply',
    reply_text: reply_suggestion || 'Cam on ban da de lai binh luan. Shop se phan hoi ban som!'
  };
}

module.exports = {
  applyAutomationRule
};
