const Anthropic = require('@anthropic-ai/sdk');
const circuitBreaker = require('./circuitBreaker');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AI_TIMEOUT = parseInt(process.env.AI_TIMEOUT) || 10000;

let aiMode = 'FALLBACK'; // GEMINI | ANTHROPIC | FALLBACK
let anthropicClient = null;

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
  aiMode = 'GEMINI';
  console.log('[AI SERVICE] Configured to use Google Gemini API.');
} else if (ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here') {
  aiMode = 'ANTHROPIC';
  anthropicClient = new Anthropic({
    apiKey: ANTHROPIC_API_KEY
  });
  console.log('[AI SERVICE] Configured to use Anthropic Claude API.');
} else {
  console.warn('[AI SERVICE] Neither GEMINI_API_KEY nor ANTHROPIC_API_KEY is configured. Running in Fallback (Rule-Based) mode.');
}

/**
 * Perform rule-based fallback analysis on the message
 * @param {string} messageText - The user message content
 * @returns {Object} Standard intent/sentiment analysis result
 */
function getFallbackResponse(messageText) {
  const text = (messageText || '').toLowerCase();
  let intent = 'other';
  let sentiment = 'neutral';
  let replySuggestion = 'Cảm ơn bạn đã để lại tin nhắn. Shop sẽ liên hệ hỗ trợ bạn sớm nhất!';

  if (text.includes('giá') || text.includes('bao nhiêu')) {
    intent = 'ask_price';
    sentiment = 'neutral';
    replySuggestion = 'Bạn ơi shop sẽ inbox báo giá chi tiết ngay nhé! 😊';
  } else if (text.includes('tệ') || text.includes('tồi') || text.includes('xấu') || text.includes('chán')) {
    intent = 'complaint';
    sentiment = 'negative';
    replySuggestion = 'Shop rất tiếc về vấn đề này. Bạn vui lòng inbox để shop hỗ trợ ngay!';
  } else if (text.includes('tốt') || text.includes('hay') || text.includes('thích') || text.includes('tuyệt')) {
    intent = 'compliment';
    sentiment = 'positive';
    replySuggestion = 'Cảm ơn bạn đã ủng hộ shop! 🙏';
  }

  return {
    intent,
    sentiment,
    reply_suggestion: replySuggestion,
    is_fallback: true
  };
}

/**
 * Call Google Gemini REST API using global fetch
 */
async function callGeminiApi(messageText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `You are an automated Facebook customer service event analyzer. Analyze the customer message and return a JSON object with intent, sentiment, and reply_suggestion fields.
          
Supported Values:
- intent: "ask_price" | "complaint" | "compliment" | "spam" | "other"
- sentiment: "positive" | "neutral" | "negative"
- reply_suggestion: Recommended auto-reply response in Vietnamese.

Message to analyze:
"${messageText}"`
        }]
      }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    }),
    signal: AbortSignal.timeout(AI_TIMEOUT)
  });

  if (!response.ok) {
    throw new Error(`Gemini API HTTP Error: status ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  return JSON.parse(text);
}

/**
 * Call Anthropic Claude Messages API
 */
async function callAnthropicApi(messageText) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT);

  try {
    const response = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'You are an automated Facebook customer service event analyzer. Analyze the customer message and return a JSON object ONLY. Do not write any introduction, commentary, or wrap it in markdown. The response must follow this schema exactly: { "intent": "ask_price|complaint|compliment|spam|other", "sentiment": "positive|neutral|negative", "reply_suggestion": "string" }',
      messages: [
        {
          role: 'user',
          content: messageText
        }
      ]
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    const responseText = response.content[0].text.trim();

    let sanitizedText = responseText;
    if (sanitizedText.startsWith('```')) {
      sanitizedText = sanitizedText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    }
    return JSON.parse(sanitizedText);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Analyzes raw message using AI API, wrapped inside Circuit Breaker and Timeout limit
 * @param {string} messageText - Raw message content
 * @returns {Promise<Object>} Analyzed intent, sentiment and suggestion response
 */
async function analyzeMessage(messageText) {
  if (aiMode === 'FALLBACK') {
    return getFallbackResponse(messageText);
  }

  const apiTask = async () => {
    let parsedJson;

    if (aiMode === 'GEMINI') {
      parsedJson = await callGeminiApi(messageText);
    } else {
      parsedJson = await callAnthropicApi(messageText);
    }

    if (!parsedJson.intent || !parsedJson.sentiment || !parsedJson.reply_suggestion) {
      throw new Error('AI Response does not match the required schema fields');
    }

    return {
      intent: parsedJson.intent,
      sentiment: parsedJson.sentiment,
      reply_suggestion: parsedJson.reply_suggestion,
      is_fallback: false
    };
  };

  try {
    const result = await circuitBreaker.execute(apiTask);
    console.log(`[AI SERVICE] [${aiMode}] Analysis result: intent=${result.intent}, sentiment=${result.sentiment}`);
    return result;
  } catch (error) {
    console.error(`[AI SERVICE] [${aiMode}] AI Analysis failed (${error.message}). Invoking fallback rules...`);
    const fallback = getFallbackResponse(messageText);
    console.log(`[AI SERVICE] Fallback outcome: intent=${fallback.intent}, sentiment=${fallback.sentiment}`);
    return fallback;
  }
}

module.exports = {
  analyzeMessage,
  getFallbackResponse
};
