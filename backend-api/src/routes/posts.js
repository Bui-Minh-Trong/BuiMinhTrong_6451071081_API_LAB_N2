const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/authMiddleware');
const facebookApi = require('../services/facebookApi');
const { pool } = require('../config/database');
require('dotenv').config();

const router = express.Router();

// Apply authentication middleware to all routes in this router
router.use(authMiddleware);
router.use(requireRole('admin'));

function badRequest(res, message) {
  return res.status(400).json({
    success: false,
    data: null,
    error: {
      code: 'BAD_REQUEST',
      message
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * GET /posts - Fetch posts from Facebook Page
 * Query: page_id (optional, falls back to env PAGE_ID)
 */
router.get('/posts', async (req, res, next) => {
  const pageId = req.query.page_id || process.env.PAGE_ID;

  if (!pageId) {
    return badRequest(res, 'page_id is required either via query parameter or environment configuration');
  }

  try {
    const posts = await facebookApi.getPosts(pageId);
    res.status(200).json({
      success: true,
      data: posts,
      error: null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /post - Create a post on Facebook Page
 * Body: { message }
 * Query: page_id (optional, falls back to env PAGE_ID)
 */
router.post('/post', async (req, res, next) => {
  const pageId = req.query.page_id || process.env.PAGE_ID;
  const { message } = req.body;

  if (!pageId) {
    return badRequest(res, 'page_id is required either via query parameter or environment configuration');
  }

  if (!message) {
    return badRequest(res, 'message field is required in request body');
  }

  try {
    const result = await facebookApi.createPost(pageId, message);
    res.status(201).json({
      success: true,
      data: result,
      error: null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /comments - Fetch comments of a specific post from Facebook
 * Query: post_id
 */
router.get('/comments', async (req, res, next) => {
  const { post_id: postId } = req.query;

  if (!postId) {
    return badRequest(res, 'post_id query parameter is required');
  }

  try {
    const comments = await facebookApi.getComments(postId);
    res.status(200).json({
      success: true,
      data: comments,
      error: null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /comments/:postId - Fetch comments of a specific post from Facebook
 */
router.get('/comments/:postId', async (req, res, next) => {
  const { postId } = req.params;

  if (!postId) {
    return badRequest(res, 'postId path parameter is required');
  }

  try {
    const comments = await facebookApi.getComments(postId);
    res.status(200).json({
      success: true,
      data: comments,
      error: null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /comments/:commentId/reply - Send an admin reply through Facebook Graph API
 * Body: { message }
 */
router.post('/comments/:commentId/reply', async (req, res, next) => {
  const { commentId } = req.params;
  const { message } = req.body;

  if (!commentId) {
    return badRequest(res, 'commentId path parameter is required');
  }

  if (!message) {
    return badRequest(res, 'message field is required in request body');
  }

  try {
    const result = await facebookApi.replyComment(commentId, message);
    res.status(200).json({
      success: true,
      data: result,
      error: null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /comments/:commentId/hide - Hide a comment through Facebook Graph API
 */
router.post('/comments/:commentId/hide', async (req, res, next) => {
  const { commentId } = req.params;

  if (!commentId) {
    return badRequest(res, 'commentId path parameter is required');
  }

  try {
    const result = await facebookApi.hideComment(commentId);
    res.status(200).json({
      success: true,
      data: result,
      error: null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /dashboard/comments - Get processed comments from PostgreSQL with filter and pagination
 * Query: page, limit, status, sentiment
 */
router.get('/dashboard/comments', async (req, res, next) => {
  if (process.env.ENABLE_DATABASE === 'false') {
    return res.status(503).json({
      success: false,
      data: null,
      error: {
        code: 'DATABASE_DISABLED',
        message: 'Database features are disabled. Set ENABLE_DATABASE=true to use dashboard history.'
      },
      timestamp: new Date().toISOString()
    });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { status, sentiment } = req.query;

  let queryText = 'SELECT * FROM comments WHERE 1=1';
  const queryParams = [];

  if (status) {
    queryParams.push(status.toUpperCase());
    queryText += ` AND status = $${queryParams.length}`;
  }

  if (sentiment) {
    queryParams.push(sentiment.toLowerCase());
    queryText += ` AND sentiment = $${queryParams.length}`;
  }

  // Count query for pagination meta
  let countQueryText = 'SELECT COUNT(*) FROM comments WHERE 1=1';
  const countParams = [];

  if (status) {
    countParams.push(status.toUpperCase());
    countQueryText += ` AND status = $${countParams.length}`;
  }

  if (sentiment) {
    countParams.push(sentiment.toLowerCase());
    countQueryText += ` AND sentiment = $${countParams.length}`;
  }

  try {
    // Execute count query
    const countResult = await pool.query(countQueryText, countParams);
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    // Append limit/offset and run final query
    queryParams.push(limit);
    queryText += ` LIMIT $${queryParams.length}`;

    queryParams.push(offset);
    queryText += ` OFFSET $${queryParams.length}`;

    const commentsResult = await pool.query(queryText, queryParams);

    res.status(200).json({
      success: true,
      data: {
        items: commentsResult.rows,
        pagination: {
          page,
          limit,
          total_items: totalItems,
          total_pages: totalPages
        }
      },
      error: null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
