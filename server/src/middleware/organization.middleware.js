const { pool } = require('../config/database');

/**
 * Organization scoping middleware.
 * Ensures the authenticated user belongs to an organization.
 * Attaches req.organization = { id, name, organization_type, role } to the request.
 */
async function requireOrganization(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const [rows] = await pool.execute(
      `SELECT o.id, o.name, o.organization_type, uo.role
       FROM user_organizations uo
       JOIN organizations o ON uo.organization_id = o.id
       WHERE uo.user_id = ?
       LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'ORGANIZATION_REQUIRED',
        message: 'No organization linked to this account. Please set up your organization first.',
      });
    }

    req.organization = rows[0];
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireOrganization };
