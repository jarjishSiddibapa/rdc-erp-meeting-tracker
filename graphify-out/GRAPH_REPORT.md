# Graph Report - anesh-sir-erp-meeting-tracker-application  (2026-08-26)

## Corpus Check
- 62 files · ~117,396 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 522 nodes · 818 edges · 31 communities
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d27aec8b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SRPage.jsx
- server.js
- useAuth
- dependencies
- migrate-sqlite-to-mysql.js
- DashboardHome.jsx
- dependencies
- deloitte-import.js
- routes/backup.js
- frontend/package.json
- Login.jsx
- users.js
- manageengine-import.js
- react
- UpdateTasks.jsx
- srs.js
- SRDetail.jsx
- pool.js
- middleware/auth.js
- csv-import.js
- .oxlintrc.json
- UserManagement.jsx
- excelIO.js
- Reports.jsx
- Windows production deployment
- Q: Use https://github.com/Leonxlnx/taste-skill to improve the UI of our web application, keep it smooth and lightweight.
- Q: Make the most of the taste skill and overhaul the web application so it works and looks as amazing as possible.
- Q: Use company color #00B51A and the taste skill to improve fonts, colors, sizes, smoothness, and overall UI quality.
- React + Vite
- SRForm.jsx

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
- `SRPage()` --indirect_call--> `ResizableTitle()`  [INFERRED]
  frontend/src/pages/SRPage.jsx → frontend/src/components/ui/ResizableTitle.jsx
- `ChangePassword()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/pages/ChangePassword.jsx → frontend/src/context/AuthContext.jsx
- `Login()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/pages/Login.jsx → frontend/src/context/AuthContext.jsx
- `start()` --calls--> `initDb()`  [EXTRACTED]
  backend/server.js → backend/db/database.js
- `start()` --calls--> `initScheduler()`  [EXTRACTED]
  backend/server.js → backend/services/backup.js

## Import Cycles
- None detected.

## Communities (31 total, 0 thin omitted)

### Community 0 - "SRPage.jsx"
Cohesion: 0.20
Nodes (11): ClosureDateCell(), fmt(), fmtDT(), buildColumns(), fmt(), SCOPE_COLORS, SRPage(), STATUS_COLORS (+3 more)

### Community 1 - "server.js"
Cohesion: 0.06
Nodes (40): ALLOWED_ORIGIN_PATTERNS, ALLOWED_ORIGINS, app, authLimiter, authRoutes, backupRoutes, compression, cors (+32 more)

### Community 2 - "useAuth"
Cohesion: 0.18
Nodes (10): App(), Dashboard, ForgotPassword, Login, ProtectedRoute(), PublicRoute(), ResetPassword, AuthContext (+2 more)

### Community 3 - "dependencies"
Cohesion: 0.04
Nodes (45): author, dependencies, bcryptjs, better-sqlite3, compression, cors, csv-parse, dotenv (+37 more)

### Community 4 - "migrate-sqlite-to-mysql.js"
Cohesion: 0.14
Nodes (29): assertDefaultAdminConfigured(), bcrypt, createTables(), DEFAULT_ADMIN, ensureDatabaseExists(), initDb(), migrateSRsTable(), migrateUsersCanEditDigitization() (+21 more)

### Community 5 - "DashboardHome.jsx"
Cohesion: 0.08
Nodes (18): AmbientBackground(), AnimatedCounter(), TiltCard(), ALL_KEYS, BackupSettings, ChangePassword, Dashboard(), MENU_ITEMS (+10 more)

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
Cohesion: 0.17
Nodes (18): Arrow(), BarChart(), CheckScribble(), DashedCircle(), Sparkle(), Squiggle(), ANCHOR, anchorToPage() (+10 more)

### Community 11 - "users.js"
Cohesion: 0.07
Nodes (31): { authenticate }, bcrypt, crypto, { EMAIL_REGEX }, express, { hashToken, createResetToken }, jwt, { pool } (+23 more)

### Community 12 - "manageengine-import.js"
Cohesion: 0.16
Nodes (14): { authenticate, requireRole }, CLOSED_STATUSES, crossReference(), express, isClosedFamily(), loadRows(), mapOpenStatus(), multer (+6 more)

### Community 13 - "react"
Cohesion: 0.17
Nodes (5): BrandButton(), MagneticButton(), ChangePassword(), authAPI, react

### Community 14 - "UpdateTasks.jsx"
Cohesion: 0.15
Nodes (9): CLASSIFICATION_COLOR, fmtEta(), SHEET_NAMES, TASK_FIELDS, UploadDeloittePdf(), api, csvImportAPI, deloitteImportAPI (+1 more)

### Community 15 - "srs.js"
Cohesion: 0.15
Nodes (10): addInFilter(), addPendingWithFilter(), { authenticate, requireRole }, DISTINCT_FIELDS, express, { pool }, router, SORTABLE_FIELDS (+2 more)

### Community 16 - "SRDetail.jsx"
Cohesion: 0.21
Nodes (9): ALL_STATUSES, BASE_STATUSES, fmt(), fmtDT(), SCOPE_COLORS, SR_TYPES, SRDetail(), STATUS_COLORS (+1 more)

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
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 22 - "UserManagement.jsx"
Cohesion: 0.18
Nodes (14): Reveal(), RevealGroup(), BackupSettings(), formatBytes(), STATUS_TAG, UpdateFromManageEngine(), BULK_USER_FIELDS, BulkAddUsersModal() (+6 more)

### Community 23 - "excelIO.js"
Cohesion: 0.15
Nodes (11): xlsx, buildSheet(), dateStringToExcelSerial(), EXCEL_EPOCH_UTC, excelSerialToDateString(), readSheetAsFields(), readWorkbook(), DIGITIZATION_COLUMNS (+3 more)

### Community 24 - "Reports.jsx"
Cohesion: 0.26
Nodes (8): CommentCell(), fmtDT(), ResizableTitle(), AssignedToEcdReport(), fmt(), STATUS_COLORS, reportsAPI, srAPI

### Community 25 - "Windows production deployment"
Cohesion: 0.20
Nodes (8): First deployment after cloning, Installing future updates, Windows production deployment, Windows Task Scheduler, Local setup, RDC ERP Meeting Tracker, Technology, Useful commands

### Community 26 - "Q: Use https://github.com/Leonxlnx/taste-skill to improve the UI of our web application, keep it smooth and lightweight."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Use https://github.com/Leonxlnx/taste-skill to improve the UI of our web application, keep it smooth and lightweight., Source Nodes

### Community 27 - "Q: Make the most of the taste skill and overhaul the web application so it works and looks as amazing as possible."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Make the most of the taste skill and overhaul the web application so it works and looks as amazing as possible., Source Nodes

### Community 28 - "Q: Use company color #00B51A and the taste skill to improve fonts, colors, sizes, smoothness, and overall UI quality."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Use company color #00B51A and the taste skill to improve fonts, colors, sizes, smoothness, and overall UI quality., Source Nodes

### Community 29 - "React + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

### Community 30 - "SRForm.jsx"
Cohesion: 0.28
Nodes (6): ALL_STATUSES, BASE_STATUSES, dateVal(), SR_TYPES, SRForm(), useDistinctOptions()

## Knowledge Gaps
- **238 isolated node(s):** `mysql`, `bcrypt`, `{ pool, DB_NAME }`, `mysql`, `jwt` (+233 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `SRPage.jsx`, `useAuth`, `DashboardHome.jsx`, `Login.jsx`, `UpdateTasks.jsx`, `SRDetail.jsx`, `.oxlintrc.json`, `UserManagement.jsx`, `Reports.jsx`, `SRForm.jsx`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `pool` connect `pool.js` to `migrate-sqlite-to-mysql.js`, `deloitte-import.js`, `routes/backup.js`, `users.js`, `manageengine-import.js`, `srs.js`, `middleware/auth.js`, `csv-import.js`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `frontend/package.json`, `excelIO.js`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `mysql`, `bcrypt`, `{ pool, DB_NAME }` to the rest of the system?**
  _238 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06387921022067364 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `migrate-sqlite-to-mysql.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13978494623655913 - nodes in this community are weakly interconnected._