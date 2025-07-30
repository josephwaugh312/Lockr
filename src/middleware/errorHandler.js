const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle specific error types
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      error: 'Database connection unavailable',
      message: 'The service is temporarily unavailable. Please try again later.',
      timestamp: new Date().toISOString(),
      retryAfter: 30 // Suggest retry after 30 seconds
    });
  }

  if (err.code === 'ETIMEDOUT') {
    return res.status(504).json({
      error: 'Database connection timeout',
      message: 'The request timed out. Please try again later.',
      timestamp: new Date().toISOString(),
      retryAfter: 60 // Suggest retry after 60 seconds
    });
  }

  if (err.code === '23505') { // PostgreSQL unique constraint violation
    return res.status(409).json({
      error: 'Conflict',
      message: 'A resource with this information already exists.',
      timestamp: new Date().toISOString()
    });
  }

  if (err.code === '23503') { // PostgreSQL foreign key constraint violation
    return res.status(400).json({
      error: 'Invalid reference',
      message: 'The requested operation references a non-existent resource.',
      timestamp: new Date().toISOString()
    });
  }

  // Default error response
  const statusCode = err.status || 500;
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: errorMessage,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = { errorHandler }; 