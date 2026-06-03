const express = require('express');
require('dotenv').config();

const { initializeDatabase } = require('./config/database');
const { connectProducer, disconnectProducer } = require('./services/kafkaProducer');
const { startConsumer, stopConsumer } = require('./services/kafkaConsumer');

const authRouter = require('./routes/auth');
const postsRouter = require('./routes/posts');
const healthRouter = require('./routes/health');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Mount routers
app.use('/auth', authRouter);
app.use('/', postsRouter);
app.use('/', healthRouter); // GET /health is mounted directly

// Route fallback for 404
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

// Centralized error handler middleware
app.use(errorHandler);

let server;

async function bootstrap() {
  try {
    // 1. Setup PG schemas and check connection
    await initializeDatabase();

    // 2. Connect Kafka producer & consumer
    await connectProducer();
    await startConsumer();

    // 3. Bind HTTP server listener
    server = app.listen(PORT, () => {
      console.log(`[BACKEND-API] Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[BACKEND-API] Server boot failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful termination
async function shutdown(signal) {
  console.log(`\n[BACKEND-API] Intercepted ${signal}. Shuttling down services...`);

  if (server) {
    server.close(() => {
      console.log('[BACKEND-API] HTTP Server closed.');
    });
  }

  try {
    await stopConsumer();
    await disconnectProducer();
    console.log('[BACKEND-API] Graceful shutdown process completed.');
    process.exit(0);
  } catch (error) {
    console.error('[BACKEND-API] Error during graceful shutdown:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

bootstrap();
