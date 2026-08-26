require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const srRoutes = require('./routes/srs');
const userRoutes = require('./routes/users');
const csvImportRoutes = require('./routes/csv-import');
const statsRoutes = require('./routes/stats');
const backupRoutes = require('./routes/backup');
const reportsRoutes = require('./routes/reports');
const deloitteImportRoutes = require('./routes/deloitte-import');
const manageEngineImportRoutes = require('./routes/manageengine-import');

const { initDb, pool } = require('./db/database');
const { verifyMailer } = require('./services/mailer');
const { initScheduler } = require('./services/backup');
const { startHeartbeat, logShutdown, logCrash } = require('./services/heartbeat');

const REQUIRED_ENV = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_NAME'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length) {
  console.error(`Missing required environment variable(s): ${missingEnv.join(', ')}`);
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');

const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:3000', `http://localhost:${process.env.PORT || 777}`];
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[\w-]+\.ngrok-free\.(app|dev)$/,
  /^https:\/\/[\w-]+\.ngrok\.io$/,
  // The app is served same-origin (frontend + API on one port) in normal use, so this is
  // mostly a safety net: some browsers/proxies still attach an Origin header to same-origin
  // requests, and this also covers a client reaching the API cross-origin behind a proxy.
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
];

app.use(helmet({
  // The app is served same-origin (frontend + API on one port), and CSP would need
  // per-inline-script hashing for Vite's bundle; keep the rest of helmet's hardening
  // (frameguard, noSniff, HSTS off on plain HTTP LAN, etc.) without fighting the SPA.
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGIN_PATTERNS.some(p => p.test(origin))) {
      callback(null, true);
    } else {
      console.warn('Blocked by CORS:', origin);
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// Brute-force protection on the auth endpoints most worth throttling.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/srs', srRoutes);
app.use('/api/users', userRoutes);
app.use('/api/csv-import', csvImportRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/deloitte-import', deloitteImportRoutes);
app.use('/api/manageengine-import', manageEngineImportRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve the built frontend (single port for LAN access) and fall back to index.html for
// any non-API route so React Router's client-side routes work on a hard refresh.
// Hashed asset filenames (dist/assets/*) are safe to cache aggressively — the filename
// itself changes whenever the content does. index.html is NOT hashed and is the one file
// that must always be revalidated, or browsers can keep serving a stale build referencing
// JS bundles that no longer exist on disk after a redeploy.
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(FRONTEND_DIST, {
  index: false,
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', filePath.includes(`${path.sep}assets${path.sep}`)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache');
  },
}));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 777;

async function start() {
  await initDb();
  await verifyMailer();
  await initScheduler();
  const server = app.listen(PORT, () => {
    console.log(`ERP Meeting Tracker API running on http://localhost:${PORT}`);
    startHeartbeat();
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received — shutting down gracefully...`);
    logShutdown(signal);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // These are the crashes a heartbeat file is actually for — without this, the log would
  // just go silent with no record of why, since Node's default uncaught-exception handler
  // only prints to stderr (which nobody's watching on an unattended box) before exiting.
  process.on('uncaughtException', (err) => {
    logCrash('uncaughtException', err);
    console.error('Uncaught exception:', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logCrash('unhandledRejection', reason);
    console.error('Unhandled rejection:', reason);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
