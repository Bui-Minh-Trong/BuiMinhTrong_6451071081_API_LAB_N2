const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

/**
 * Express middleware to authenticate routes using JWT Bearer token
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization header is missing'
      },
      timestamp: new Date().toISOString()
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid authorization format. Use: Bearer <token>'
      },
      timestamp: new Date().toISOString()
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user claims to request
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token is invalid or expired'
      },
      timestamp: new Date().toISOString()
    });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: `Required role: ${role}`
        },
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

module.exports = authMiddleware;
module.exports.requireRole = requireRole;
