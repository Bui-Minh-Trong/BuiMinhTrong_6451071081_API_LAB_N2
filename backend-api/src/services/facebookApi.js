const axios = require('axios');
const circuitBreaker = require('./circuitBreaker');
require('dotenv').config();

const BASE_URL = 'https://graph.facebook.com/v19.0';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const MOCK_FACEBOOK_API = process.env.MOCK_FACEBOOK_API === 'true';
const SIMULATE_FACEBOOK_FAILURES = parseInt(process.env.SIMULATE_FACEBOOK_FAILURES || '0', 10);
const simulatedFailures = new Map();

// Create Axios Instance
const fbClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000
});

class FacebookApiError extends Error {
  constructor(code, message, status, details = null, retryable = false) {
    super(message);
    this.name = 'FacebookApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.retryable = retryable;
  }
}

/**
 * Handle Graph API response error formatting
 * @param {Object} error - Axios error object
 * @returns {Error} Specialized error class
 */
function handleFacebookError(error) {
  if (error.response) {
    const status = error.response.status;
    const fbError = error.response.data && error.response.data.error;
    const fbMessage = fbError ? fbError.message : error.message;
    const details = fbError || error.response.data || null;

    if (status === 400 && fbError && fbError.code === 190) {
      return new FacebookApiError(
        'FB_TOKEN_EXPIRED',
        `Page access token is expired or invalid. Details: ${fbMessage}`,
        401,
        details,
        false
      );
    }
    if (status === 401 || status === 403) {
      return new FacebookApiError(
        'FB_UNAUTHORIZED',
        `Facebook API rejected the page token or permissions. Details: ${fbMessage}`,
        status,
        details,
        false
      );
    }
    if (status === 429 || (fbError && (fbError.code === 4 || fbError.code === 17 || fbError.code === 341))) {
      return new FacebookApiError(
        'FB_RATE_LIMIT',
        `Facebook API rate limit exceeded. Details: ${fbMessage}`,
        429,
        details,
        true
      );
    }
    if (status >= 500) {
      return new FacebookApiError(
        'FB_SERVER_ERROR',
        `Transient Facebook server error. Details: ${fbMessage}`,
        502,
        details,
        true
      );
    }
    return new FacebookApiError(
      'FB_API_ERROR',
      `Graph API call failed. Details: ${fbMessage}`,
      status,
      details,
      false
    );
  }

  if (error.code === 'ECONNABORTED') {
    return new FacebookApiError(
      'FB_TIMEOUT',
      'Facebook API request timed out',
      504,
      null,
      true
    );
  }

  return new FacebookApiError(
    'FB_NETWORK_ERROR',
    error.message || 'Unable to reach Facebook API',
    503,
    null,
    true
  );
}

/**
 * Interceptor/Helper to call Facebook Graph API and log details
 */
async function callApi(config) {
  const startTime = Date.now();
  const token = config.token || PAGE_ACCESS_TOKEN;

  if (MOCK_FACEBOOK_API) {
    const key = `${config.method}:${config.url}`;
    const attempt = simulatedFailures.get(key) || 0;

    if (SIMULATE_FACEBOOK_FAILURES > attempt) {
      simulatedFailures.set(key, attempt + 1);
      throw new FacebookApiError(
        'FB_TIMEOUT',
        `Mock transient Facebook timeout (${attempt + 1}/${SIMULATE_FACEBOOK_FAILURES})`,
        504,
        { mock: true, key },
        true
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[FB API MOCK] ${config.method.toUpperCase()} ${config.url} | Status: 200 | Latency: ${duration}ms`);
    return {
      id: `mock_${Date.now()}`,
      success: true,
      mock: true,
      url: config.url,
      method: config.method,
      data: config.data || null
    };
  }

  if (!token || token === 'your_page_access_token_here') {
    throw new FacebookApiError(
      'FB_TOKEN_MISSING',
      'PAGE_ACCESS_TOKEN is not configured',
      500,
      null,
      false
    );
  }

  // Append token to params or headers
  config.params = {
    ...config.params,
    access_token: token
  };

  const timestamp = new Date().toISOString();
  try {
    const response = await fbClient(config);
    const duration = Date.now() - startTime;
    console.log(`[FB API LOG] [${timestamp}] ${config.method.toUpperCase()} ${config.url} | Status: ${response.status} | Latency: ${duration}ms`);
    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;
    const mappedError = handleFacebookError(error);
    const status = error.response ? error.response.status : 'NETWORK_ERROR';
    console.error(`[FB API ERROR] [${timestamp}] ${config.method.toUpperCase()} ${config.url} | Status: ${status} | Latency: ${duration}ms | Error: ${mappedError.message}`);
    throw mappedError;
  }
}

/**
 * Send a reply comment to a specific comment ID
 * Wrapped in Circuit Breaker
 * @param {string} commentId - Target comment ID
 * @param {string} message - Message body content
 */
async function replyComment(commentId, message) {
  return circuitBreaker.execute(async () => {
    return callApi({
      method: 'post',
      url: `/${commentId}/comments`,
      data: {
        message
      }
    });
  });
}

/**
 * Hide a specific comment ID
 * Wrapped in Circuit Breaker
 * @param {string} commentId - Target comment ID
 */
async function hideComment(commentId) {
  return circuitBreaker.execute(async () => {
    return callApi({
      method: 'post',
      url: `/${commentId}`,
      data: {
        is_hidden: true
      }
    });
  });
}

/**
 * Fetch posts of a specific page
 * @param {string} pageId - Target page ID
 */
async function getPosts(pageId) {
  return callApi({
    method: 'get',
    url: `/${pageId}/posts`
  });
}

/**
 * Publish a post to a page feed
 * @param {string} pageId - Target page ID
 * @param {string} message - Post text message
 */
async function createPost(pageId, message) {
  return callApi({
    method: 'post',
    url: `/${pageId}/feed`,
    data: {
      message
    }
  });
}

/**
 * Fetch comments on a specific post
 * @param {string} postId - Target post ID
 */
async function getComments(postId) {
  return callApi({
    method: 'get',
    url: `/${postId}/comments`
  });
}

module.exports = {
  replyComment,
  hideComment,
  getPosts,
  createPost,
  getComments,
  FacebookApiError
};
