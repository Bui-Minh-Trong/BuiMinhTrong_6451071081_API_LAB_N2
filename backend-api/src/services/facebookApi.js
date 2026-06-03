const axios = require('axios');
const circuitBreaker = require('./circuitBreaker');
require('dotenv').config();

const BASE_URL = 'https://graph.facebook.com/v19.0';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// Create Axios Instance
const fbClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000
});

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

    if (status === 401) {
      return new Error(`[FB_TOKEN_EXPIRED] Page access token is expired or invalid. Details: ${fbMessage}`);
    }
    if (status === 429 || (fbError && (fbError.code === 4 || fbError.code === 17 || fbError.code === 341))) {
      return new Error(`[FB_RATE_LIMIT] Facebook API rate limit exceeded. Details: ${fbMessage}`);
    }
    if (status >= 500) {
      return new Error(`[FB_SERVER_ERROR] Transient Facebook server error (Status ${status}). Details: ${fbMessage}`);
    }
    return new Error(`[FB_API_ERROR] Graph API call failed (Status ${status}). Details: ${fbMessage}`);
  }
  return error;
}

/**
 * Interceptor/Helper to call Facebook Graph API and log details
 */
async function callApi(config) {
  const startTime = Date.now();
  const token = config.token || PAGE_ACCESS_TOKEN;

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
  getComments
};
