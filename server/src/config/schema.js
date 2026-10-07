const { pool } = require('../config/database');

/**
 * Initialize the database schema.
 * Creates all core tables if they do not already exist.
 * Uses IF NOT EXISTS — safe to run on every server startup.
 */
async function initializeSchema() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // ------------------------------------------------------------------
    // 1. users
    // ------------------------------------------------------------------
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name          VARCHAR(100)        NOT NULL,
        email         VARCHAR(255)        NOT NULL,
        password_hash VARCHAR(255)        NOT NULL,
        role          ENUM('admin','user') NOT NULL DEFAULT 'user',
        created_at    TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE INDEX uq_users_email (email),
        INDEX idx_users_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ------------------------------------------------------------------
    // 2. organizations
    // ------------------------------------------------------------------
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS organizations (
        id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name              VARCHAR(150)  NOT NULL,
        organization_type ENUM(
          'restaurant',
          'cafeteria',
          'canteen',
          'institutional',
          'other'
        ) NOT NULL DEFAULT 'other',
        created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_organizations_type (organization_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ------------------------------------------------------------------
    // 3. user_organizations  (many-to-many join table)
    // ------------------------------------------------------------------
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_organizations (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id         INT UNSIGNED NOT NULL,
        organization_id INT UNSIGNED NOT NULL,
        role            ENUM('owner','manager','staff') NOT NULL DEFAULT 'staff',
        created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE INDEX uq_user_org (user_id, organization_id),
        FOREIGN KEY (user_id)
          REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (organization_id)
          REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
        INDEX idx_uo_org (organization_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // ------------------------------------------------------------------
    // 4. food_items
    // ------------------------------------------------------------------
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS food_items (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        organization_id INT UNSIGNED  NOT NULL,
        name            VARCHAR(150)  NOT NULL,
        category        VARCHAR(100)  NOT NULL DEFAULT 'Uncategorized',
        unit            VARCHAR(30)   NOT NULL DEFAULT 'portions',
        unit_cost       DECIMAL(10, 2) DEFAULT NULL,
        created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id)
          REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
        INDEX idx_fi_org  (organization_id),
        INDEX idx_fi_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Migration: ensure unit_cost column exists in existing food_items table
    const [costCol] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'food_items' 
        AND COLUMN_NAME = 'unit_cost'
    `);
    if (costCol.length === 0) {
      await connection.execute(`
        ALTER TABLE food_items 
        ADD COLUMN unit_cost DECIMAL(10, 2) DEFAULT NULL
      `);
      console.log('✅ Added unit_cost column to food_items table');
    }

    // ------------------------------------------------------------------
    // 5. demand_records  (core ML training data)
    // ------------------------------------------------------------------
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS demand_records (
        id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        organization_id   INT UNSIGNED   NOT NULL,
        food_item_id      INT UNSIGNED   NOT NULL,
        record_date       DATE           NOT NULL,
        quantity_prepared DECIMAL(10,2)  NOT NULL CHECK (quantity_prepared >= 0),
        quantity_sold     DECIMAL(10,2)  NOT NULL CHECK (quantity_sold     >= 0),
        quantity_wasted   DECIMAL(10,2)  NOT NULL CHECK (quantity_wasted   >= 0),
        created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE INDEX uq_dr_item_date (food_item_id, record_date),
        FOREIGN KEY (organization_id)
          REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (food_item_id)
          REFERENCES food_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
        INDEX idx_dr_org_date  (organization_id, record_date),
        INDEX idx_dr_item      (food_item_id),
        INDEX idx_dr_date      (record_date),
        CONSTRAINT chk_wasted_le_prepared
          CHECK (quantity_wasted <= quantity_prepared)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.commit();
    console.log('✅ Database schema initialised successfully');
  } catch (error) {
    await connection.rollback();
    console.error('❌ Schema initialisation failed:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { initializeSchema };
