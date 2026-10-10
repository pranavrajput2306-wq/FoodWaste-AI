/**
 * Central error-handling middleware.
 * Must be registered LAST in the Express app (after all routes).
 */
function errorHandler(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Always log full error details server-side for operational diagnostics
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);
  if (!isProduction) {
    console.error(err.stack);
  }

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  let clientMessage = err.message || 'An unexpected error occurred.';

  // In production, sanitize 500 server errors and sensitive database errors to prevent internal info leakage
  if (isProduction) {
    const isSensitive =
      statusCode >= 500 ||
      err.code === 'ER_PARSE_ERROR' ||
      err.code === 'ER_NO_SUCH_TABLE' ||
      err.code === 'ER_BAD_FIELD_ERROR' ||
      err.code === 'ECONNREFUSED' ||
      /sql|syntax|password|secret|path|column|table|jwt/i.test(err.message || '');

    if (isSensitive) {
      clientMessage = statusCode === 500
        ? 'Internal server error. Please try again later.'
        : 'A database or service error occurred.';
    }
  }

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    ...(!isProduction && { stack: err.stack }),
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
