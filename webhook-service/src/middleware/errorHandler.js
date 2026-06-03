module.exports = (err, req, res, next) => {
  // Log the complete error stack trace
  console.error('[UNHANDLED ERROR]:', err);

  const statusCode = err.status || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const errorMessage = err.message || 'An unexpected error occurred in the webhook service';

  res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code: errorCode,
      message: errorMessage
    },
    timestamp: new Date().toISOString()
  });
};
