const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { pool, DB_NAME } = require('./pool');

const DEFAULT_ADMIN = {
  full_name: process.env.DEFAULT_ADMIN_NAME || 'System Administrator',
  email: process.env.DEFAULT_ADMIN_EMAIL || '',
  password: process.env.DEFAULT_ADMIN_PASSWORD || '',
  role: 'admin',
};

function assertDefaultAdminConfigured() {
  if (!DEFAULT_ADMIN.email || !DEFAULT_ADMIN.password) {
    throw new Error(
      'No users exist. Set DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD in backend/.env before starting the app.'
    );
  }
}

async function ensureDatabaseExists() {
  const rootConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await rootConn.end();
}

async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
      can_edit_digitization TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      reset_token_hash VARCHAR(255) NULL,
      reset_token_expires DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_users_is_deleted (is_deleted)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS srs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      sr_number VARCHAR(100) NOT NULL,
      category VARCHAR(20) NOT NULL CHECK (category IN ('SR', 'Digitization')),
      scope VARCHAR(20) NULL CHECK (scope IN ('Internal', 'External')),
      status VARCHAR(20) NOT NULL DEFAULT 'Open',
      pending_with VARCHAR(255),
      assigned_to VARCHAR(255),
      closed_date DATE,

      description TEXT,
      type VARCHAR(255),
      creation_date DATE,
      created_by_name VARCHAR(255),
      expected_closure_date DATE,

      manageengine_status VARCHAR(255),
      manageengine_pending_party VARCHAR(20),
      manageengine_created_at DATETIME,
      manageengine_closed_at DATETIME,
      manageengine_last_synced_at DATETIME,

      project_name VARCHAR(255),
      process_owner VARCHAR(255),
      target_date DATE,

      created_by INT NULL,
      updated_by INT NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      CONSTRAINT fk_srs_created_by FOREIGN KEY (created_by) REFERENCES users(id),
      CONSTRAINT fk_srs_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
      INDEX idx_srs_sr_number (sr_number),
      INDEX idx_srs_status (status),
      INDEX idx_srs_pending_with (pending_with),
      INDEX idx_srs_assigned_to (assigned_to),
      INDEX idx_srs_list (category, is_deleted, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sr_comments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      sr_id INT NOT NULL,
      comment TEXT NOT NULL,
      commented_by INT NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      commented_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_comments_sr FOREIGN KEY (sr_id) REFERENCES srs(id) ON DELETE CASCADE,
      CONSTRAINT fk_comments_user FOREIGN KEY (commented_by) REFERENCES users(id),
      INDEX idx_comments_sr (sr_id, is_deleted, commented_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sr_history (
      id INT PRIMARY KEY AUTO_INCREMENT,
      sr_id INT NOT NULL,
      field_changed VARCHAR(100) NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by INT NULL,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_history_sr FOREIGN KEY (sr_id) REFERENCES srs(id) ON DELETE CASCADE,
      CONSTRAINT fk_history_user FOREIGN KEY (changed_by) REFERENCES users(id),
      INDEX idx_history_sr (sr_id, is_deleted, changed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS backup_settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      hour TINYINT NOT NULL DEFAULT 2,
      minute TINYINT NOT NULL DEFAULT 0,
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      updated_by INT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS backup_runs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      filename VARCHAR(255) NOT NULL,
      size_bytes BIGINT NULL,
      status VARCHAR(20) NOT NULL,
      message TEXT NULL,
      triggered_by VARCHAR(20) NOT NULL DEFAULT 'schedule',
      is_deleted TINYINT(1) NOT NULL DEFAULT 0,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS manageengine_sync_runs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      status VARCHAR(20) NOT NULL,
      triggered_by VARCHAR(20) NOT NULL DEFAULT 'schedule',
      local_srs INT NOT NULL DEFAULT 0,
      remote_requests_scanned INT NOT NULL DEFAULT 0,
      matched INT NOT NULL DEFAULT 0,
      updated INT NOT NULL DEFAULT 0,
      unchanged INT NOT NULL DEFAULT 0,
      missing INT NOT NULL DEFAULT 0,
      error_count INT NOT NULL DEFAULT 0,
      message TEXT NULL,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME NULL,
      INDEX idx_manageengine_sync_runs_started (started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

// The users table already existed with the old constraints (username required, email
// optional) before login switched to email-only — CREATE TABLE IF NOT EXISTS doesn't
// retroactively fix an existing table, so drop the now-unused username column and make
// email required, the same way a fresh install's schema already has it.
async function migrateUsersTable() {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.columns
     WHERE table_schema = ? AND table_name = 'users' AND COLUMN_NAME IN ('username', 'email')`,
    [DB_NAME]
  );
  const usernameCol = cols.find(c => c.COLUMN_NAME === 'username');
  const emailCol = cols.find(c => c.COLUMN_NAME === 'email');

  if (usernameCol) {
    await pool.query('ALTER TABLE users DROP COLUMN username');
    console.log('Migrated: dropped users.username — email is the only login identifier now.');
  }

  if (emailCol && emailCol.IS_NULLABLE === 'YES') {
    const [badRows] = await pool.query("SELECT COUNT(*) as n FROM users WHERE email IS NULL OR email = ''");
    if (badRows[0].n === 0) {
      await pool.query('ALTER TABLE users MODIFY email VARCHAR(255) NOT NULL');
      console.log('Migrated: users.email is now required (used for login).');
    } else {
      console.warn(`Skipped making users.email required — ${badRows[0].n} existing user(s) have no email set. Give them one, then restart.`);
    }
  }
}

// New field added after the srs table already existed on production — CREATE TABLE IF NOT
// EXISTS doesn't retroactively add a column, so add it here if missing. Existing rows get
// NULL (blank) rather than a guessed value; nothing else about their data changes.
async function migrateSRsTable() {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.columns
     WHERE table_schema = ? AND table_name = 'srs'`,
    [DB_NAME]
  );
  const existing = new Set(cols.map(c => c.COLUMN_NAME));
  if (!existing.has('assigned_to')) {
    await pool.query('ALTER TABLE srs ADD COLUMN assigned_to VARCHAR(255) NULL AFTER pending_with');
    await pool.query('ALTER TABLE srs ADD INDEX idx_srs_assigned_to (assigned_to)');
    console.log('Migrated: added srs.assigned_to column.');
  }

  const manageEngineColumns = [
    ['manageengine_status', 'VARCHAR(255) NULL AFTER expected_closure_date'],
    ['manageengine_pending_party', 'VARCHAR(20) NULL AFTER manageengine_status'],
    ['manageengine_created_at', 'DATETIME NULL AFTER manageengine_pending_party'],
    ['manageengine_closed_at', 'DATETIME NULL AFTER manageengine_created_at'],
    ['manageengine_last_synced_at', 'DATETIME NULL AFTER manageengine_closed_at'],
  ];
  for (const [name, definition] of manageEngineColumns) {
    if (existing.has(name)) continue;
    await pool.query(`ALTER TABLE srs ADD COLUMN ${name} ${definition}`);
    console.log(`Migrated: added srs.${name} column.`);
  }
}

// A viewer can normally only read — this flag lets an admin grant one specific viewer the
// ability to edit Digitization Projects (not Service Requests) without promoting them to a
// full editor. Same CREATE TABLE IF NOT EXISTS limitation as srs.assigned_to above.
async function migrateUsersCanEditDigitization() {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.columns
     WHERE table_schema = ? AND table_name = 'users' AND COLUMN_NAME = 'can_edit_digitization'`,
    [DB_NAME]
  );
  if (cols.length === 0) {
    await pool.query('ALTER TABLE users ADD COLUMN can_edit_digitization TINYINT(1) NOT NULL DEFAULT 0 AFTER role');
    console.log('Migrated: added users.can_edit_digitization column.');
  }
}

async function seedDefaults() {
  const [settingsRows] = await pool.query('SELECT id FROM backup_settings LIMIT 1');
  if (settingsRows.length === 0) {
    await pool.query('INSERT INTO backup_settings (enabled, hour, minute) VALUES (1, 2, 0)');
    console.log('Default backup schedule created: daily at 02:00');
  }

  const [userRows] = await pool.query('SELECT COUNT(*) as count FROM users');
  if (userRows[0].count === 0) {
    assertDefaultAdminConfigured();
    const hashed = bcrypt.hashSync(DEFAULT_ADMIN.password, 10);
    await pool.query(
      'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
      [DEFAULT_ADMIN.full_name, DEFAULT_ADMIN.email, hashed, DEFAULT_ADMIN.role]
    );
    console.log(`Default admin created for ${DEFAULT_ADMIN.email}.`);
  }
}

async function initDb() {
  await ensureDatabaseExists();
  await createTables();
  await migrateUsersTable();
  await migrateUsersCanEditDigitization();
  await migrateSRsTable();
  await seedDefaults();
}

module.exports = {
  initDb,
  ensureDatabaseExists,
  createTables,
  seedDefaults,
  pool,
  DEFAULT_ADMIN,
  assertDefaultAdminConfigured,
};
