// One-time migration: copies all data out of the legacy SQLite database into the new
// MySQL database (erp-meeting-tracker). Safe to re-run — it skips a table's data copy if
// that table in MySQL already has rows, so it won't duplicate data on a second run.
// The original SQLite files are never touched; they're only ever copied, not moved.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const {
  pool,
  ensureDatabaseExists,
  createTables,
  seedDefaults,
  DEFAULT_ADMIN,
  assertDefaultAdminConfigured,
} = require('../db/database');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SQLITE_PATH = path.join(DATA_DIR, 'sr_review.db');
const BACKUP_ROOT = path.join(__dirname, '..', 'db-backup');

function nullIfEmpty(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function backupSqliteFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log('No backend/data directory found — nothing to back up.');
    return;
  }
  const pad = n => String(n).padStart(2, '0');
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const destDir = path.join(BACKUP_ROOT, `sqlite-pre-migration-${stamp}`);
  fs.mkdirSync(destDir, { recursive: true });

  const files = fs.readdirSync(DATA_DIR);
  for (const f of files) {
    fs.copyFileSync(path.join(DATA_DIR, f), path.join(destDir, f));
  }
  console.log(`Backed up ${files.length} SQLite file(s) to ${destDir} (originals left in place).`);
}

async function tableHasRows(table) {
  const [rows] = await pool.query(`SELECT COUNT(*) as n FROM ${table}`);
  return rows[0].n > 0;
}

async function migrateUsers(sqlite) {
  if (await tableHasRows('users')) {
    console.log('MySQL "users" already has data — skipping user copy.');
    return;
  }
  const rows = sqlite.prepare('SELECT * FROM users').all();
  for (const u of rows) {
    // The old SQLite schema required a username and made email optional; the app has
    // since switched to email-only login, so a row with no email can't be copied as-is —
    // fall back to a placeholder built from the username so no historical user is silently
    // dropped, but flag it since it won't be able to log in until given a real email.
    const email = nullIfEmpty(u.email) || `${u.username}@rdc.in`;
    if (!nullIfEmpty(u.email)) {
      console.warn(`User "${u.username}" (id ${u.id}) had no email in the old data — using placeholder "${email}". Update it before they try to log in.`);
    }
    await pool.execute(
      `INSERT INTO users (id, full_name, email, password, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.full_name, email, u.password, u.role, u.is_active,
        nullIfEmpty(u.created_at) || new Date(), nullIfEmpty(u.updated_at) || new Date()]
    );
  }
  console.log(`Copied ${rows.length} user(s).`);
}

async function migrateSrs(sqlite) {
  if (await tableHasRows('srs')) {
    console.log('MySQL "srs" already has data — skipping SR copy.');
    return;
  }
  const rows = sqlite.prepare('SELECT * FROM srs').all();
  for (const s of rows) {
    await pool.execute(
      `INSERT INTO srs (
        id, sr_number, category, scope, status, pending_with, closed_date,
        description, type, creation_date, created_by_name, expected_closure_date,
        project_name, process_owner, target_date,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id, s.sr_number, s.category, s.scope, s.status, s.pending_with, nullIfEmpty(s.closed_date),
        s.description, s.type, nullIfEmpty(s.creation_date), s.created_by_name, nullIfEmpty(s.expected_closure_date),
        s.project_name, s.process_owner, nullIfEmpty(s.target_date),
        s.created_by, s.updated_by,
        nullIfEmpty(s.created_at) || new Date(), nullIfEmpty(s.updated_at) || new Date(),
      ]
    );
  }
  console.log(`Copied ${rows.length} SR/Digitization record(s).`);
}

async function migrateComments(sqlite) {
  if (await tableHasRows('sr_comments')) {
    console.log('MySQL "sr_comments" already has data — skipping comment copy.');
    return;
  }
  const rows = sqlite.prepare('SELECT * FROM sr_comments').all();
  for (const c of rows) {
    await pool.execute(
      'INSERT INTO sr_comments (id, sr_id, comment, commented_by, commented_at) VALUES (?, ?, ?, ?, ?)',
      [c.id, c.sr_id, c.comment, c.commented_by, nullIfEmpty(c.commented_at) || new Date()]
    );
  }
  console.log(`Copied ${rows.length} comment(s).`);
}

async function migrateHistory(sqlite) {
  if (await tableHasRows('sr_history')) {
    console.log('MySQL "sr_history" already has data — skipping history copy.');
    return;
  }
  const rows = sqlite.prepare('SELECT * FROM sr_history').all();
  for (const h of rows) {
    await pool.execute(
      `INSERT INTO sr_history (id, sr_id, field_changed, old_value, new_value, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [h.id, h.sr_id, h.field_changed, h.old_value, h.new_value, h.changed_by, nullIfEmpty(h.changed_at) || new Date()]
    );
  }
  console.log(`Copied ${rows.length} history entr(y/ies).`);
}

// The configured default admin replaces the migrated admin credentials. Matching by role
// keeps this compatible with the current schema, which no longer has a username field.
async function applyDefaultAdminCredentials() {
  assertDefaultAdminConfigured();
  const [rows] = await pool.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
  const hashed = bcrypt.hashSync(DEFAULT_ADMIN.password, 10);
  if (rows[0]) {
    await pool.execute(
      'UPDATE users SET password = ?, email = ?, role = ?, is_active = 1, is_deleted = 0 WHERE id = ?',
      [hashed, DEFAULT_ADMIN.email, DEFAULT_ADMIN.role, rows[0].id]
    );
    console.log(`Updated existing admin user to the new default credentials (email: ${DEFAULT_ADMIN.email}).`);
  } else {
    await pool.execute(
      'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
      [DEFAULT_ADMIN.full_name, DEFAULT_ADMIN.email, hashed, DEFAULT_ADMIN.role]
    );
    console.log('No admin user existed in the migrated data — created one with the new default credentials.');
  }
}

async function main() {
  console.log('=== SQLite -> MySQL migration ===');

  backupSqliteFiles();

  if (!fs.existsSync(SQLITE_PATH)) {
    console.log(`No SQLite database found at ${SQLITE_PATH} — nothing to migrate. Setting up an empty MySQL schema only.`);
    await ensureDatabaseExists();
    await createTables();
    await seedDefaults();
    await pool.end();
    return;
  }

  await ensureDatabaseExists();
  await createTables();

  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  await migrateUsers(sqlite);
  await migrateSrs(sqlite);
  await migrateComments(sqlite);
  await migrateHistory(sqlite);
  await applyDefaultAdminCredentials();
  await seedDefaults(); // creates backup_settings default row if missing; skips user seed (users now non-empty)

  sqlite.close();
  await pool.end();

  console.log('=== Migration complete ===');
  console.log(`Admin account configured for ${DEFAULT_ADMIN.email}.`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
