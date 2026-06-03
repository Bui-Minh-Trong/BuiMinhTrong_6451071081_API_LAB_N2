const express = require('express');
require('dotenv').config();

const { connectProducer, disconnectProducer } = require('./services/kafkaProducer');
const { startConsumer, stopConsumer } = require('./services/kafkaConsumer');

const app = express();
const PORT = process.env.PORT || 3003;
const MAX_RETRY = parseInt(process.env.MAX_RETRY) || 3;

app.use(express.json());

// GET /health
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'retry-service',
      maxRetry: MAX_RETRY
    },
    error: null,
    timestamp: new Date().toISOString()
  });
});

// Capture non-existent paths
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

async function bootstrap() {
  try {
    // 1. Establish Kafka connections
    await connectProducer();
    await startConsumer();

    // 2. Bind port
    server = app.listen(PORT, () => {
      console.log(`[RETRY-SERVICE] HTTP Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[RETRY-SERVICE] Bootstrap failed:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown sequentials
async function shutdown(signal) {
  console.log(`\n[RETRY-SERVICE] Intercepted ${signal}. Triggering graceful shutdown...`);

  if (server) {
    server.close(() => {
      console.log('[RETRY-SERVICE] HTTP Server closed.');
    });
  }

  try {
    await stopConsumer();
    await disconnectProducer();
    console.log('[RETRY-SERVICE] Graceful shutdown completed.');
    process.exit(0);
  } catch (error) {
    console.error('[RETRY-SERVICE] Shutdown error:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

bootstrap();
