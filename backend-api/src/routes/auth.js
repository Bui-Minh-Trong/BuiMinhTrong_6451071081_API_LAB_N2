const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      data: null,
      error: {
        code: 'BAD_REQUEST',
        message: 'Username and password are required'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Validate credentials
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Generate JWT token (valid for 24h)
  const token = jwt.sign(
    {
      username: username,
      role: 'admin'
    },
    JWT_SECRET,
    {
      expiresIn: '24h'
    }
  );

  return res.status(200).json({
    success: true,
    data: {
      access_token: token,
      expires_in: 86400, // 24 hours in seconds
      token_type: 'Bearer'
    },
    error: null,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
