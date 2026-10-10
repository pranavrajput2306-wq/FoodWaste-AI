const jwt = require('jsonwebtoken');
const { validateEnv } = require('../config/env');

/**
 * Authentication middleware.
 * Validates the Bearer JWT in the Authorization header.
 * Attaches decoded user payload to req.user on success.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { jwtSecret } = validateEnv();
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded; // { id, email, role }
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }
}

/**
 * Role-based authorisation middleware factory.
 * Usage: authorise('admin') or authorise(['admin', 'manager'])
 */
function authorise(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions.',
      });
    }
    next();
  };
}

module.exports = { authenticate, authorise };
