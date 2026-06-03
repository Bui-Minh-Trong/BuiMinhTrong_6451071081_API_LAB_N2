const crypto = require('crypto');
require('dotenv').config();

module.exports = (req, res, next) => {
  const signatureHeader = req.headers['x-hub-signature-256'];
  const appSecret = process.env.APP_SECRET;

  // If signature verification is not configured or disabled in local dev (optional safety check)
  // we can enforce it as requested: "So sánh chữ ký, trả 403 nếu không khớp"
  if (!signatureHeader) {
    console.error('[SIGNATURE] Missing x-hub-signature-256 header.');
    return res.status(403).json({
      success: false,
      data: null,
      error: {
        code: 'SIGNATURE_MISSING',
        message: 'x-hub-signature-256 header is required for verification'
      },
      timestamp: new Date().toISOString()
    });
  }

  if (!appSecret) {
    console.error('[SIGNATURE] APP_SECRET environment variable is missing on server.');
    return res.status(500).json({
      success: false,
      data: null,
      error: {
        code: 'SERVER_CONFIG_ERROR',
        message: 'Server configuration error: APP_SECRET is missing'
      },
      timestamp: new Date().toISOString()
    });
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    console.error('[SIGNATURE] Invalid signature header format.');
    return res.status(403).json({
      success: false,
      data: null,
      error: {
        code: 'INVALID_SIGNATURE_FORMAT',
        message: 'x-hub-signature-256 header must follow format: sha256=signature_hash'
      },
      timestamp: new Date().toISOString()
    });
  }

  const signature = parts[1];
  const rawBody = req.rawBody || Buffer.from('');

  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  const actualBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  // Use timingSafeEqual to protect against timing attacks, ensure buffer lengths are equal
  if (actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return next();
  } else {
    console.error('[SIGNATURE] Signature verification failed. Calculated:', expectedSignature, 'vs Header:', signature);
    return res.status(403).json({
      success: false,
      data: null,
      error: {
        code: 'INVALID_SIGNATURE',
        message: 'Signature verification failed. The request signature is invalid.'
      },
      timestamp: new Date().toISOString()
    });
  }
};
