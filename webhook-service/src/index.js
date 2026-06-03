const express = require('express');
require('dotenv').config();
const webhookRoutes = require('./routes/webhook');
const errorHandler = require('./middleware/errorHandler');
const { connectProducer, disconnectProducer } = require('./services/kafkaProducer');

const app = express();
const PORT = process.env.PORT || 3001;

// Body parser configuration to capture rawBody for signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

app.use(express.urlencoded({ extended: true }));

// GET /health - API health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'webhook-service'
    },
    error: null,
    timestamp: new Date().toISOString()
  });
});

// Mount Webhook Router
app.use(webhookRoutes);

// Catch-all route handler for unmatched routes
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`
    },
    timestamp: new Date().toISOString()
  });
});

// Mount Global Error Handler
app.use(errorHandler);

// Start server and connect producer
let server;
async function startServer() {
  try {
    // Connect to Kafka before starting the HTTP listener
    await connectProducer();

    server = app.listen(PORT, () => {
      console.log(`[WEBHOOK-SERVICE] Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[WEBHOOK-SERVICE] Critical startup failure:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown handler
async function handleShutdown(signal) {
  console.log(`\n[WEBHOOK-SERVICE] Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      console.log('[WEBHOOK-SERVICE] Express server stopped listening.');
    });
  }

  try {
    await disconnectProducer();
    console.log('[WEBHOOK-SERVICE] Graceful shutdown complete.');
    process.exit(0);
  } catch (error) {
    console.error('[WEBHOOK-SERVICE] Error during graceful shutdown:', error.message);
    process.exit(1);
  }
}

// Intercept process signals
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

startServer();
