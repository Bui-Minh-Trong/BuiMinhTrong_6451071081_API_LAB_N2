const Anthropic = require('@anthropic-ai/sdk');
const circuitBreaker = require('./circuitBreaker');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AI_TIMEOUT = parseInt(process.env.AI_TIMEOUT, 10) || 10000;
const AI_PROVIDER = (process.env.AI_PROVIDER || '').toUpperCase();

let aiMode = 'FALLBACK';
let anthropicClient = null;

if (AI_PROVIDER === 'FALLBACK') {
  console.warn('[AI SERVICE] AI_PROVIDER=FALLBACK. Running in rule-based demo mode.');
} else if (AI_PROVIDER === 'GEMINI' && GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
  aiMode = 'GEMINI';
  console.log('[AI SERVICE] Configured to use Google Gemini API.');
} else if (AI_PROVIDER === 'ANTHROPIC' && ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here') {
  aiMode = 'ANTHROPIC';
  anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  console.log('[AI SERVICE] Configured to use Anthropic Claude API.');
} else if (!AI_PROVIDER && GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
  aiMode = 'GEMINI';
  console.log('[AI SERVICE] Configured to use Google Gemini API.');
} else if (!AI_PROVIDER && ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here') {
  aiMode = 'ANTHROPIC';
  anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  console.log('[AI SERVICE] Configured to use Anthropic Claude API.');
} else {
  console.warn('[AI SERVICE] No AI key configured. Running in fallback rule-based mode.');
}

function normalizeText(messageText) {
  return (messageText || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getFallbackResponse(messageText) {
  const text = normalizeText(messageText);
  let intent = 'other';
  let sentiment = 'neutral';
  let replySuggestion = 'Cam on ban da de lai tin nhan. Shop se lien he ho tro ban som nhat!';

  if (text.includes('gia') || text.includes('bao nhieu')) {
    intent = 'ask_price';
    sentiment = 'neutral';
    replySuggestion = 'Ban oi shop se inbox bao gia chi tiet ngay nhe!';
  } else if (
    text.includes('te') || text.includes('toi') || text.includes('xau') ||
    text.includes('chan') || text.includes('lau') || text.includes('khieu nai') ||
    text.includes('chua nhan') || text.includes('cho rat')
  ) {
    intent = 'complaint';
    sentiment = 'negative';
    replySuggestion = 'Shop rat xin loi vi trai nghiem chua tot. Shop se kiem tra va ho tro ban ngay!';
  } else if (
    text.includes('tot') || text.includes('hay') || text.includes('thich') ||
    text.includes('tuyet') || text.includes('ung ho')
  ) {
    intent = 'compliment';
    sentiment = 'positive';
    replySuggestion = 'Cam on ban da ung ho shop!';
  }

  return {
    intent,
    sentiment,
    reply_suggestion: replySuggestion,
    is_fallback: true
  };
}

async function callGeminiApi(messageText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Analyze this Facebook customer message and return JSON only with intent, sentiment, reply_suggestion.
Allowed intent: ask_price, complaint, compliment, spam, other.
Allowed sentiment: positive, neutral, negative.
Message: "${messageText}"`
        }]
      }],
      generationConfig: { responseMimeType: 'application/json' }
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

async function callAnthropicApi(messageText) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT);

  try {
    const response = await anthropicClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'Return JSON only: { "intent": "ask_price|complaint|compliment|spam|other", "sentiment": "positive|neutral|negative", "reply_suggestion": "string" }',
      messages: [{ role: 'user', content: messageText }]
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    let responseText = response.content[0].text.trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    }
    return JSON.parse(responseText);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function analyzeMessage(messageText) {
  if (aiMode === 'FALLBACK') {
    return getFallbackResponse(messageText);
  }

  const apiTask = async () => {
    const parsedJson = aiMode === 'GEMINI'
      ? await callGeminiApi(messageText)
      : await callAnthropicApi(messageText);

    if (!parsedJson.intent || !parsedJson.sentiment || !parsedJson.reply_suggestion) {
      throw new Error('AI response does not match required schema fields');
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
    console.error(`[AI SERVICE] [${aiMode}] AI failed (${error.message}). Invoking fallback rules...`);
    return getFallbackResponse(messageText);
  }
}

module.exports = {
  analyzeMessage,
  getFallbackResponse
};
