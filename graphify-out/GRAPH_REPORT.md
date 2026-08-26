# Graph Report - .  (2026-08-26)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 490 nodes · 791 edges · 22 communities
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- SRPage.jsx
- server.js
- SRDetail.jsx
- dependencies
- migrate-sqlite-to-mysql.js
- Dashboard.jsx
- dependencies
- deloitte-import.js
- routes/backup.js
- frontend/package.json
- Login.jsx
- routes/auth.js
- manageengine-import.js
- users.js
- excelIO.js
- srs.js
- backend/package.json
- pool.js
- middleware/auth.js
- csv-import.js
- .oxlintrc.json

## God Nodes (most connected - your core abstractions)
1. `react` - 23 edges
2. `useAuth()` - 18 edges
3. `pool` - 13 edges
4. `main()` - 11 edges
5. `authenticate()` - 10 edges
6. `initDb()` - 9 edges
7. `paginationConfig()` - 9 edges
8. `SRDetail()` - 8 edges
9. `Reveal()` - 8 edges
10. `srAPI` - 8 edges

## Surprising Connections (you probably didn't know these)
- `ChangePassword()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/pages/ChangePassword.jsx → frontend/src/context/AuthContext.jsx
- `start()` --calls--> `initDb()`  [EXTRACTED]
  backend/server.js → backend/db/database.js
- `provisionUser()` --calls--> `createResetToken()`  [EXTRACTED]
  backend/routes/users.js → backend/utils/resetToken.js
- `start()` --calls--> `initScheduler()`  [EXTRACTED]
  backend/server.js → backend/services/backup.js
- `ProtectedRoute()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/App.jsx → frontend/src/context/AuthContext.jsx

## Import Cycles
- None detected.

## Communities (22 total, 0 thin omitted)

### Community 0 - "SRPage.jsx"
Cohesion: 0.05
Nodes (48): plugins, ClosureDateCell(), fmt(), fmtDT(), CommentCell(), fmtDT(), BrandButton(), MagneticButton() (+40 more)

### Community 1 - "server.js"
Cohesion: 0.06
Nodes (43): ALLOWED_ORIGIN_PATTERNS, ALLOWED_ORIGINS, app, authLimiter, authRoutes, backupRoutes, compression, cors (+35 more)

### Community 2 - "SRDetail.jsx"
Cohesion: 0.08
Nodes (26): App(), Dashboard, ForgotPassword, Login, ProtectedRoute(), PublicRoute(), ResetPassword, ALL_STATUSES (+18 more)

### Community 3 - "dependencies"
Cohesion: 0.06
Nodes (33): dependencies, bcryptjs, better-sqlite3, compression, cors, csv-parse, dotenv, express (+25 more)

### Community 4 - "migrate-sqlite-to-mysql.js"
Cohesion: 0.14
Nodes (29): assertDefaultAdminConfigured(), bcrypt, createTables(), DEFAULT_ADMIN, ensureDatabaseExists(), initDb(), migrateSRsTable(), migrateUsersCanEditDigitization() (+21 more)

### Community 5 - "Dashboard.jsx"
Cohesion: 0.09
Nodes (18): AmbientBackground(), AnimatedCounter(), RevealGroup(), TiltCard(), ALL_KEYS, BackupSettings, ChangePassword, Dashboard() (+10 more)

### Community 6 - "dependencies"
Cohesion: 0.08
Nodes (25): @ant-design/icons, antd, axios, dayjs, framer-motion, dependencies, @ant-design/icons, antd (+17 more)

### Community 7 - "deloitte-import.js"
Cohesion: 0.11
Nodes (22): { authenticate, requireRole }, DELOITTE_FIELDS, ensureAssignedToDeloitte(), ensureFieldValue(), ensurePendingWithDeloitte(), ETA_RE, express, extractRows() (+14 more)

### Community 8 - "routes/backup.js"
Cohesion: 0.13
Nodes (19): { authenticate, requireRole }, express, fs, path, { pool }, router, { runBackup, getSettings, rescheduleBackups, BACKUP_DIR }, BACKUP_DIR (+11 more)

### Community 9 - "frontend/package.json"
Cohesion: 0.10
Nodes (20): devDependencies, oxlint, @types/react, @types/react-dom, vite, @vitejs/plugin-react, name, private (+12 more)

### Community 10 - "Login.jsx"
Cohesion: 0.18
Nodes (17): Arrow(), BarChart(), CheckScribble(), DashedCircle(), Sparkle(), Squiggle(), ANCHOR, anchorToPage() (+9 more)

### Community 11 - "routes/auth.js"
Cohesion: 0.14
Nodes (14): { authenticate }, bcrypt, crypto, { EMAIL_REGEX }, express, { hashToken, createResetToken }, jwt, { pool } (+6 more)

### Community 12 - "manageengine-import.js"
Cohesion: 0.16
Nodes (14): { authenticate, requireRole }, CLOSED_STATUSES, crossReference(), express, isClosedFamily(), loadRows(), mapOpenStatus(), multer (+6 more)

### Community 13 - "users.js"
Cohesion: 0.15
Nodes (14): { authenticate, requireRole }, bcrypt, { createResetToken }, express, { generateRandomPassword }, { pool }, provisionUser(), { RDC_EMAIL_REGEX } (+6 more)

### Community 14 - "excelIO.js"
Cohesion: 0.15
Nodes (11): xlsx, buildSheet(), dateStringToExcelSerial(), EXCEL_EPOCH_UTC, excelSerialToDateString(), readSheetAsFields(), readWorkbook(), DIGITIZATION_COLUMNS (+3 more)

### Community 15 - "srs.js"
Cohesion: 0.15
Nodes (10): addInFilter(), addPendingWithFilter(), { authenticate, requireRole }, DISTINCT_FIELDS, express, { pool }, router, SORTABLE_FIELDS (+2 more)

### Community 16 - "backend/package.json"
Cohesion: 0.15
Nodes (12): author, description, keywords, license, main, name, scripts, dev (+4 more)

### Community 17 - "pool.js"
Cohesion: 0.22
Nodes (6): mysql, pool, { authenticate }, express, { pool }, router

### Community 18 - "middleware/auth.js"
Cohesion: 0.25
Nodes (7): authenticate(), jwt, requireRole(), { authenticate }, express, { pool }, router

### Community 19 - "csv-import.js"
Cohesion: 0.22
Nodes (5): { authenticate, requireRole }, express, { pool }, router, VALID_STATUSES

### Community 20 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): rules, react/only-export-components, react/rules-of-hooks, $schema, warn

## Knowledge Gaps
- **220 isolated node(s):** `mysql`, `bcrypt`, `{ pool, DB_NAME }`, `mysql`, `jwt` (+215 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `SRPage.jsx` to `SRDetail.jsx`, `Login.jsx`, `Dashboard.jsx`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `pool` connect `pool.js` to `migrate-sqlite-to-mysql.js`, `deloitte-import.js`, `routes/backup.js`, `routes/auth.js`, `manageengine-import.js`, `users.js`, `srs.js`, `middleware/auth.js`, `csv-import.js`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `frontend/package.json`, `excelIO.js`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `mysql`, `bcrypt`, `{ pool, DB_NAME }` to the rest of the system?**
  _220 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SRPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.052614052614052616 - nodes in this community are weakly interconnected._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.057971014492753624 - nodes in this community are weakly interconnected._
- **Should `SRDetail.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07507507507507508 - nodes in this community are weakly interconnected._