const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'backend-api',
      database_enabled: process.env.ENABLE_DATABASE !== 'false',
      kafka_enabled: process.env.ENABLE_KAFKA !== 'false'
    },
    error: null,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
