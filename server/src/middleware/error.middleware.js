/**
 * Central error-handling middleware.
 * Must be registered LAST in the Express app (after all routes).
 */
function errorHandler(err, req, res, next) {
  // Log error details server-side
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected error occurred.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * 404 handler — catch-all for unknown routes.
 * Register immediately before errorHandler.
 */
function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

module.exports = { errorHandler, notFound };
