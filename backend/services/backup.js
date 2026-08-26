const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { pool, DB_NAME } = require('../db/pool');

const BACKUP_DIR = path.join(__dirname, '..', 'db-backup');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

let cronTask = null;

// Finds mysqldump.exe without hardcoding a MySQL version number, since "MySQL Server 9.5"
// is specific to the machine this was first built on — a different machine (or a future
// MySQL upgrade on this one) would have a different folder name and silently ENOENT here.
function resolveMysqldump() {
  if (process.env.MYSQLDUMP_PATH) {
    if (fs.existsSync(process.env.MYSQLDUMP_PATH)) return process.env.MYSQLDUMP_PATH;
    console.warn(`MYSQLDUMP_PATH is set to "${process.env.MYSQLDUMP_PATH}" but that file doesn't exist — falling back to auto-detection.`);
  }

  if (process.platform === 'win32') {
    for (const base of ['C:\\Program Files\\MySQL', 'C:\\Program Files (x86)\\MySQL']) {
      if (!fs.existsSync(base)) continue;
      const serverDirs = fs.readdirSync(base).filter(d => d.startsWith('MySQL Server'));
      for (const dir of serverDirs) {
        const candidate = path.join(base, dir, 'bin', 'mysqldump.exe');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  // Last resort: assume it's on PATH (true on most Linux/Mac installs, and on Windows if
  // someone added the MySQL bin folder to PATH manually).
  return 'mysqldump';
}

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// Dumps the full database (schema + data, including CREATE TABLE / CREATE DATABASE
// statements via --databases) to a single .sql file, so it can be restored into a fresh
// MySQL instance with nothing more than `mysql -u root -p < file.sql`.
async function runBackup(triggeredBy = 'schedule') {
  const filename = `erp-meeting-tracker-${timestamp()}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  const [result] = await pool.execute(
    'INSERT INTO backup_runs (filename, status, triggered_by) VALUES (?, ?, ?)',
    [filename, 'running', triggeredBy]
  );
  const runId = result.insertId;

  const bin = resolveMysqldump();
  const args = [
    '-h', process.env.DB_HOST || 'localhost',
    '-P', String(process.env.DB_PORT || 3306),
    '-u', process.env.DB_USER || 'root',
    '--single-transaction',
    '--routines',
    '--triggers',
    // Without this, mysqldump embeds `SET @@GLOBAL.GTID_PURGED=...` whenever the source
    // server has GTID-based binary logging on (the MySQL default in recent versions).
    // That statement only makes sense when restoring onto a replica of the same server —
    // restoring onto any other independent MySQL instance (which already has its own
    // non-empty GTID_EXECUTED) fails with "ERROR 3546 ... gtid set must not overlap".
    // These backups are meant to be portable to any MySQL server, so GTID state is skipped.
    '--set-gtid-purged=OFF',
    '--databases', DB_NAME,
  ];

  try {
    const child = spawn(bin, args, { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' } });
    const out = fs.createWriteStream(filepath);
    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.stdout.pipe(out);

    const [exitCode] = await Promise.all([
      new Promise((resolve, reject) => {
        child.on('error', err => {
          if (err.code === 'ENOENT') {
            reject(new Error(
              `Could not find mysqldump at "${bin}". Set MYSQLDUMP_PATH in backend/.env to the ` +
              `full path of mysqldump.exe on this machine (inside your MySQL install's bin folder).`
            ));
          } else {
            reject(err);
          }
        });
        child.on('exit', resolve);
      }),
      new Promise((resolve, reject) => {
        out.on('finish', resolve);
        out.on('error', reject);
      }),
    ]);

    if (exitCode !== 0) throw new Error(stderr.slice(0, 2000) || `mysqldump exited with code ${exitCode}`);

    const size = fs.existsSync(filepath) ? fs.statSync(filepath).size : 0;
    await pool.execute(
      'UPDATE backup_runs SET status = ?, size_bytes = ?, finished_at = NOW() WHERE id = ?',
      ['success', size, runId]
    );
    return { success: true, filename, size };
  } catch (e) {
    await pool.execute(
      'UPDATE backup_runs SET status = ?, message = ?, finished_at = NOW() WHERE id = ?',
      ['failed', e.message, runId]
    );
    fs.rm(filepath, { force: true }, () => {});
    return { success: false, message: e.message };
  }
}

async function getSettings() {
  const [rows] = await pool.query('SELECT * FROM backup_settings WHERE is_deleted = 0 ORDER BY id DESC LIMIT 1');
  return rows[0] || { enabled: 1, hour: 2, minute: 0 };
}

function scheduleFromSettings(settings) {
  if (cronTask) { cronTask.stop(); cronTask = null; }
  if (!settings.enabled) { console.log('Automatic backups disabled'); return; }
  const pattern = `${settings.minute} ${settings.hour} * * *`;
  cronTask = cron.schedule(pattern, () => {
    runBackup('schedule').catch(e => console.error('Scheduled backup failed:', e.message));
  });
  console.log(`Automatic backups scheduled daily at ${String(settings.hour).padStart(2, '0')}:${String(settings.minute).padStart(2, '0')}`);
}

async function initScheduler() {
  scheduleFromSettings(await getSettings());
}

module.exports = { runBackup, getSettings, initScheduler, rescheduleBackups: initScheduler, BACKUP_DIR };
