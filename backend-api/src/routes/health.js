const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'backend-api'
    },
    error: null,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
