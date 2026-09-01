const mysql = require('mysql2/promise');

const DB_NAME = process.env.DB_NAME || 'erp-meeting-tracker';
const CONNECTION_LIMIT = Math.max(2, Number(process.env.DB_POOL_SIZE) || 5);
const MAX_IDLE = Math.min(CONNECTION_LIMIT, Math.max(1, Number(process.env.DB_POOL_IDLE) || 3));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: DB_NAME,
  waitForConnections: true,
  // A handful of concurrent users do not need ten permanent database slots. Keep the pool
  // configurable and conservative so this app coexists cleanly with other apps on the host.
  connectionLimit: CONNECTION_LIMIT,
  maxIdle: MAX_IDLE,
  idleTimeout: Math.max(10000, Number(process.env.DB_POOL_IDLE_TIMEOUT_MS) || 60000),
  queueLimit: 0,
  dateStrings: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  decimalNumbers: true,
});

module.exports = { pool, DB_NAME };
