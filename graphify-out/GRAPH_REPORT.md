# Graph Report - anesh-sir-erp-meeting-tracker-application  (2026-08-31)

## Corpus Check
- 75 files · ~132,865 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 646 nodes · 1026 edges · 46 communities
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c29cab50`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SRPage.jsx
- server.js
- users.js
- dependencies
- migrate-sqlite-to-mysql.js
- DashboardHome.jsx
- dependencies
- deloitte-import.js
- routes/backup.js
- frontend/package.json
- Login.jsx
- routes/auth.js
- manageengine-import.js
- api.js
- UpdateTasks.jsx
- srs.js
- SRDetail.jsx
- stats.js
- pool.js
- csv-import.js
- .oxlintrc.json
- BackupSettings.jsx
- Development guide
- Reports.jsx
- ARCHITECTURE.md
- Q: Use https://github.com/Leonxlnx/taste-skill to improve the UI of our web application, keep it smooth and lightweight.
- Q: Make the most of the taste skill and overhaul the web application so it works and looks as amazing as possible.
- Q: Use company color #00B51A and the taste skill to improve fonts, colors, sizes, smoothness, and overall UI quality.
- RDC ERP Meeting Tracker
- Dashboard.jsx
- react
- pull_request_template.md
- manageengine-sync.js
- Troubleshooting
- Architecture
- User guide
- Contributing
- Security policy
- ManageEngine API synchronization
- Windows production deployment
- exchange-manageengine-code.js
- mailer.js
- ClosureDateCell.jsx

## God Nodes (most connected - your core abstractions)
1. `react` - 24 edges
2. `useAuth()` - 18 edges
3. `pool` - 14 edges
4. `main()` - 11 edges
5. `initDb()` - 10 edges
6. `authenticate()` - 10 edges
7. `normalizeRequest()` - 10 edges
8. `executeSync()` - 10 edges
9. `paginationConfig()` - 9 edges
10. `Troubleshooting` - 9 edges

## Surprising Connections (you probably didn't know these)
- `AssignedToEcdReport()` --indirect_call--> `ResizableTitle()`  [INFERRED]
  frontend/src/pages/Reports.jsx → frontend/src/components/ui/ResizableTitle.jsx
- `start()` --calls--> `initDb()`  [EXTRACTED]
  backend/server.js → backend/db/database.js
- `provisionUser()` --calls--> `createResetToken()`  [EXTRACTED]
  backend/routes/users.js → backend/utils/resetToken.js
- `start()` --calls--> `initScheduler()`  [EXTRACTED]
  backend/server.js → backend/services/backup.js
- `start()` --calls--> `verifyMailer()`  [EXTRACTED]
  backend/server.js → backend/services/mailer.js

## Import Cycles
- None detected.

## Communities (46 total, 0 thin omitted)

### Community 0 - "SRPage.jsx"
Cohesion: 0.21
Nodes (11): ResizableTitle(), buildColumns(), fmt(), fmtCreated(), SCOPE_COLORS, SRPage(), STATUS_COLORS, STATUS_STAT_KEY (+3 more)

### Community 1 - "server.js"
Cohesion: 0.06
Nodes (40): ALLOWED_ORIGIN_PATTERNS, ALLOWED_ORIGINS, app, authLimiter, authRoutes, backupRoutes, compression, cors (+32 more)

### Community 2 - "users.js"
Cohesion: 0.15
Nodes (14): { authenticate, requireRole }, bcrypt, { createResetToken }, express, { generateRandomPassword }, { pool }, provisionUser(), { RDC_EMAIL_REGEX } (+6 more)

### Community 3 - "dependencies"
Cohesion: 0.04
Nodes (47): author, dependencies, bcryptjs, better-sqlite3, compression, cors, csv-parse, dotenv (+39 more)

### Community 4 - "migrate-sqlite-to-mysql.js"
Cohesion: 0.14
Nodes (30): assertDefaultAdminConfigured(), bcrypt, createTables(), DEFAULT_ADMIN, ensureDatabaseExists(), initDb(), migrateManageEngineSyncRuns(), migrateSRsTable() (+22 more)

### Community 5 - "DashboardHome.jsx"
Cohesion: 0.19
Nodes (5): AnimatedCounter(), Reveal(), RevealGroup(), MONTHS, PALETTE

### Community 6 - "dependencies"
Cohesion: 0.05
Nodes (36): @ant-design/icons, antd, axios, dayjs, framer-motion, dependencies, @ant-design/icons, antd (+28 more)

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
Cohesion: 0.15
Nodes (12): { authenticate }, bcrypt, crypto, { EMAIL_REGEX }, express, { hashToken, createResetToken }, jwt, { pool } (+4 more)

### Community 12 - "manageengine-import.js"
Cohesion: 0.14
Nodes (15): { authenticate, requireRole }, CLOSED_STATUSES, crossReference(), express, { getSyncStatus, runManageEngineSync }, isClosedFamily(), loadRows(), mapOpenStatus() (+7 more)

### Community 13 - "api.js"
Cohesion: 0.32
Nodes (7): api, loadingSubscribers, publishLoadingState(), startTracking(), statsAPI, stopTracking(), userAPI

### Community 14 - "UpdateTasks.jsx"
Cohesion: 0.14
Nodes (10): CLASSIFICATION_COLOR, fmtEta(), SHEET_NAMES, TASK_FIELDS, UpdateFromManageEngine(), UploadDeloittePdf(), BulkAddUsersModal(), csvImportAPI (+2 more)

### Community 15 - "srs.js"
Cohesion: 0.15
Nodes (10): addInFilter(), addPendingWithFilter(), { authenticate, requireRole }, DISTINCT_FIELDS, express, { pool }, router, SORTABLE_FIELDS (+2 more)

### Community 16 - "SRDetail.jsx"
Cohesion: 0.21
Nodes (9): ALL_STATUSES, BASE_STATUSES, fmt(), fmtDT(), SCOPE_COLORS, SR_TYPES, SRDetail(), STATUS_COLORS (+1 more)

### Community 17 - "stats.js"
Cohesion: 0.29
Nodes (4): { authenticate }, express, { pool }, router

### Community 18 - "pool.js"
Cohesion: 0.22
Nodes (8): mysql, pool, { authenticate }, express, { pool }, router, crypto, { pool }

### Community 19 - "csv-import.js"
Cohesion: 0.18
Nodes (8): authenticate(), jwt, requireRole(), { authenticate, requireRole }, express, { pool }, router, VALID_STATUSES

### Community 20 - ".oxlintrc.json"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 22 - "BackupSettings.jsx"
Cohesion: 0.29
Nodes (7): TiltCard(), BackupSettings(), formatBytes(), STATUS_TAG, UserManagement(), backupAPI, paginationConfig()

### Community 23 - "Development guide"
Cohesion: 0.20
Nodes (10): Database and migrations, Development guide, Development workflows, Frontend conventions, Hot reload, Prerequisites, Production-style single port, Project map (+2 more)

### Community 24 - "Reports.jsx"
Cohesion: 0.29
Nodes (7): CommentCell(), fmtDT(), AssignedToEcdReport(), fmt(), STATUS_COLORS, reportsAPI, srAPI

### Community 25 - "ARCHITECTURE.md"
Cohesion: 0.25
Nodes (5): Backend service, Commands, Client structure, Commands, Frontend

### Community 26 - "Q: Use https://github.com/Leonxlnx/taste-skill to improve the UI of our web application, keep it smooth and lightweight."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Use https://github.com/Leonxlnx/taste-skill to improve the UI of our web application, keep it smooth and lightweight., Source Nodes

### Community 27 - "Q: Make the most of the taste skill and overhaul the web application so it works and looks as amazing as possible."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Make the most of the taste skill and overhaul the web application so it works and looks as amazing as possible., Source Nodes

### Community 28 - "Q: Use company color #00B51A and the taste skill to improve fonts, colors, sizes, smoothness, and overall UI quality."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Use company color #00B51A and the taste skill to improve fonts, colors, sizes, smoothness, and overall UI quality., Source Nodes

### Community 29 - "RDC ERP Meeting Tracker"
Cohesion: 0.20
Nodes (10): Documentation, Quick start, RDC ERP Meeting Tracker, Repository layout, Requirements, Run locally, Screenshots, Security and data boundaries (+2 more)

### Community 30 - "Dashboard.jsx"
Cohesion: 0.06
Nodes (35): App(), Dashboard, ForgotPassword, Login, ProtectedRoute(), PublicRoute(), ResetPassword, ALL_STATUSES (+27 more)

### Community 31 - "react"
Cohesion: 0.21
Nodes (7): BrandButton(), MagneticButton(), AuthContext, BULK_USER_FIELDS, ROLE_COLORS, authAPI, react

### Community 32 - "pull_request_template.md"
Cohesion: 0.50
Nodes (3): Data and deployment impact, Verification, What changed?

### Community 33 - "manageengine-sync.js"
Cohesion: 0.13
Nodes (36): applyRequestUpdate(), assertApiSuccess(), beginRun(), CLOSED_STATUSES, comparable(), createAutoRequest(), cron, dateTimeFromApi() (+28 more)

### Community 34 - "Troubleshooting"
Cohesion: 0.22
Nodes (9): A batch window opens and closes immediately, Backups fail, Health check, Login or password reset problems, MySQL connection or startup failure, Port 777 is already in use, Production update refuses to run, The site opens but the old UI is still visible (+1 more)

### Community 35 - "Architecture"
Cohesion: 0.29
Nodes (7): API map, Architecture, Authentication and authorization, Data model, Performance and operational choices, Repository responsibilities, Runtime topology

### Community 36 - "User guide"
Cohesion: 0.33
Nodes (6): Dashboard, Reports and backups, Roles and permissions, Service Requests and Digitization Projects, Update Tasks, User guide

### Community 37 - "Contributing"
Cohesion: 0.40
Nodes (4): Commit guidance, Contributing, Required checks, Workflow

### Community 39 - "Security policy"
Cohesion: 0.40
Nodes (4): Operational protections, Reporting a vulnerability, Scope, Security policy

### Community 40 - "ManageEngine API synchronization"
Cohesion: 0.50
Nodes (4): Fields synchronized, ManageEngine API synchronization, OAuth setup, Production checks

### Community 41 - "Windows production deployment"
Cohesion: 0.50
Nodes (4): First deployment after cloning, Installing future updates, Windows production deployment, Windows Task Scheduler

### Community 42 - "exchange-manageengine-code.js"
Cohesion: 0.38
Nodes (6): ENV_PATH, fs, main(), path, removeEnvValue(), upsertEnvValue()

### Community 43 - "mailer.js"
Cohesion: 0.40
Nodes (4): nodemailer, sendPasswordResetEmail(), transporter, verifyMailer()

### Community 44 - "ClosureDateCell.jsx"
Cohesion: 0.83
Nodes (3): ClosureDateCell(), fmt(), fmtDT()

## Knowledge Gaps
- **300 isolated node(s):** `mysql`, `bcrypt`, `{ pool, DB_NAME }`, `mysql`, `jwt` (+295 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `SRPage.jsx`, `DashboardHome.jsx`, `Login.jsx`, `ClosureDateCell.jsx`, `UpdateTasks.jsx`, `LoginScene.jsx`, `SRDetail.jsx`, `.oxlintrc.json`, `BackupSettings.jsx`, `Reports.jsx`, `Dashboard.jsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `pool` connect `pool.js` to `manageengine-sync.js`, `users.js`, `migrate-sqlite-to-mysql.js`, `deloitte-import.js`, `routes/backup.js`, `routes/auth.js`, `manageengine-import.js`, `srs.js`, `stats.js`, `csv-import.js`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `frontend/package.json`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `mysql`, `bcrypt`, `{ pool, DB_NAME }` to the rest of the system?**
  _300 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0627177700348432 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `migrate-sqlite-to-mysql.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1350806451612903 - nodes in this community are weakly interconnected._