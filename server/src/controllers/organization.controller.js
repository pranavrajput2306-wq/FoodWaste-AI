const { pool } = require('../config/database');

/**
 * GET /api/organizations/current
 * Returns the organization associated with the authenticated user.
 */
async function getCurrentOrganization(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT o.id, o.name, o.organization_type, o.created_at, o.updated_at, uo.role
       FROM user_organizations uo
       JOIN organizations o ON uo.organization_id = o.id
       WHERE uo.user_id = ?
       LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        organization: null,
      });
    }

    return res.status(200).json({
      success: true,
      organization: rows[0],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/organizations
 * Creates a new organization and links the user as 'owner'.
 * Body: { name, organization_type }
 */
async function createOrganization(req, res, next) {
  const connection = await pool.getConnection();
  try {
    const { name, organization_type = 'other' } = req.body;

    // Check if user already has an organization
    const [existing] = await connection.execute(
      'SELECT id FROM user_organizations WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already belong to an organization. Please update your current organization instead.',
      });
    }

    await connection.beginTransaction();

    const [orgResult] = await connection.execute(
      `INSERT INTO organizations (name, organization_type)
       VALUES (?, ?)`,
      [name.trim(), organization_type]
    );

    const organizationId = orgResult.insertId;

    await connection.execute(
      `INSERT INTO user_organizations (user_id, organization_id, role)
       VALUES (?, ?, 'owner')`,
      [req.user.id, organizationId]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Organization created successfully.',
      organization: {
        id: organizationId,
        name: name.trim(),
        organization_type,
        role: 'owner',
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/**
 * PUT /api/organizations/current
 * Updates the current organization details.
 * Body: { name, organization_type }
 */
async function updateCurrentOrganization(req, res, next) {
  try {
    const { name, organization_type = 'other' } = req.body;

    // Fetch user's organization link
    const [rows] = await pool.execute(
      `SELECT o.id, uo.role
       FROM user_organizations uo
       JOIN organizations o ON uo.organization_id = o.id
       WHERE uo.user_id = ?
       LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No organization found to update. Please create one first.',
      });
    }

    const { id: organizationId, role } = rows[0];

    // Authorization: only owner or manager can update organization details
    if (role !== 'owner' && role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Only organization owners or managers can modify organization settings.',
      });
    }

    await pool.execute(
      `UPDATE organizations
       SET name = ?, organization_type = ?
       WHERE id = ?`,
      [name.trim(), organization_type, organizationId]
    );

    const [updated] = await pool.execute(
      'SELECT id, name, organization_type, created_at, updated_at FROM organizations WHERE id = ?',
      [organizationId]
    );

    return res.status(200).json({
      success: true,
      message: 'Organization updated successfully.',
      organization: {
        ...updated[0],
        role,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCurrentOrganization,
  createOrganization,
  updateCurrentOrganization,
};
