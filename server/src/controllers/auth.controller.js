const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const SALT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// Token helper
// ---------------------------------------------------------------------------

function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/register
 * Body: { name, email, password, role? }
 */
async function register(req, res, next) {
  try {
    const { name, email, password, role = 'user' } = req.body;

    // Duplicate-email check
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, ?)`,
      [name.trim(), email.toLowerCase().trim(), password_hash, role]
    );

    const userId = result.insertId;

    // Issue token
    const token = generateToken({ id: userId, email: email.toLowerCase(), role });

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user: { id: userId, name: name.trim(), email: email.toLowerCase(), role },
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Lookup user
    const [rows] = await pool.execute(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = rows[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Issue token
    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// Me — get current authenticated user
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/me
 * Requires: authenticate middleware
 */
async function getMe(req, res, next) {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user: rows[0],
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, getMe };
