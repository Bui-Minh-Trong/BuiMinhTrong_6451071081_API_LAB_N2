const express = require('express');
require('dotenv').config();

const { connectProducer, disconnectProducer } = require('./services/kafkaProducer');
const { startConsumer, stopConsumer } = require('./services/kafkaConsumer');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// GET /health - Service health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'core-service'
    },
    error: null,
    timestamp: new Date().toISOString()
  });
});

// Capture unmatched routes
app.use((req, res) => {
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

let server;

async function startService() {
  try {
    // 1. Connect Kafka Components
    await connectProducer();
    await startConsumer();

    // 2. Start Express HTTP Server
    server = app.listen(PORT, () => {
      console.log(`[CORE-SERVICE] HTTP Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[CORE-SERVICE] Startup failed:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown orchestrator
async function shutdown(signal) {
  console.log(`\n[CORE-SERVICE] Received ${signal}. Starting shutdown sequence...`);

  if (server) {
    server.close(() => {
      console.log('[CORE-SERVICE] HTTP Server closed.');
    });
  }

  try {
    await stopConsumer();
    await disconnectProducer();
    console.log('[CORE-SERVICE] Graceful shutdown finished.');
    process.exit(0);
  } catch (error) {
    console.error('[CORE-SERVICE] Error during graceful shutdown:', error.message);
    process.exit(1);
  }
}

// Process signals interception
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startService();
