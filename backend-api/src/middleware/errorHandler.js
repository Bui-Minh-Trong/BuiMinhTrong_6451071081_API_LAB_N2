/**
 * Standard centralized Express error handling middleware
 */
function errorHandler(err, req, res, next) {
  console.error('[SERVER ERROR]', err);

  const statusCode = err.status || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const errorMessage = err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code: errorCode,
      message: errorMessage,
      details: err.details || null,
      retryable: Boolean(err.retryable)
    },
    timestamp: new Date().toISOString()
  });
}

module.exports = errorHandler;
