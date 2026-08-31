# Graph Report - anesh-sir-erp-meeting-tracker-application  (2026-08-31)

## Corpus Check
- 75 files · ~131,917 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 641 nodes · 1004 edges · 48 communities
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `13dadb72`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SRPage.jsx
- server.js
- Dashboard.jsx
- dependencies
- migrate-sqlite-to-mysql.js
- DashboardHome.jsx
- dependencies
- deloitte-import.js
- services/backup.js
- frontend/package.json
- GreenMonster.jsx
- users.js
- manageengine-import.js
- api.js
- UpdateTasks.jsx
- srs.js
- SRDetail.jsx
- pool.js
- middleware/auth.js
- csv-import.js
- .oxlintrc.json
- UserManagement.jsx
- Development guide
- Reports.jsx
- ARCHITECTURE.md
- Q: Use https://github.com/Leonxlnx/taste-skill to improve the UI of our web application, keep it smooth and lightweight.
- Q: Make the most of the taste skill and overhaul the web application so it works and looks as amazing as possible.
- Q: Use company color #00B51A and the taste skill to improve fonts, colors, sizes, smoothness, and overall UI quality.
- RDC ERP Meeting Tracker
- App.jsx
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
- Login.jsx
- SRForm.jsx
- routes/backup.js
- useAuth

## God Nodes (most connected - your core abstractions)
1. `react` - 24 edges
2. `useAuth()` - 18 edges
3. `pool` - 14 edges
4. `main()` - 11 edges
5. `authenticate()` - 10 edges
6. `initDb()` - 9 edges
7. `paginationConfig()` - 9 edges
8. `Troubleshooting` - 9 edges
9. `start()` - 8 edges
10. `executeSync()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `AssignedToEcdReport()` --indirect_call--> `ResizableTitle()`  [INFERRED]
  frontend/src/pages/Reports.jsx → frontend/src/components/ui/ResizableTitle.jsx
- `start()` --calls--> `initDb()`  [EXTRACTED]
  backend/server.js → backend/db/database.js
- `start()` --calls--> `initScheduler()`  [EXTRACTED]
  backend/server.js → backend/services/backup.js
- `start()` --calls--> `initManageEngineScheduler()`  [EXTRACTED]
  backend/server.js → backend/services/manageengine-sync.js
- `ProtectedRoute()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/App.jsx → frontend/src/context/AuthContext.jsx

## Import Cycles
- None detected.

## Communities (48 total, 0 thin omitted)

### Community 0 - "SRPage.jsx"
Cohesion: 0.18
Nodes (13): ClosureDateCell(), fmt(), fmtDT(), ResizableTitle(), buildColumns(), fmt(), fmtCreated(), SCOPE_COLORS (+5 more)

### Community 1 - "server.js"
Cohesion: 0.06
Nodes (41): ALLOWED_ORIGIN_PATTERNS, ALLOWED_ORIGINS, app, authLimiter, authRoutes, backupRoutes, compression, cors (+33 more)

### Community 2 - "Dashboard.jsx"
Cohesion: 0.17
Nodes (12): AmbientBackground(), ALL_KEYS, BackupSettings, ChangePassword, Dashboard(), MENU_ITEMS, Reports, ROLE_COLORS (+4 more)

### Community 3 - "dependencies"
Cohesion: 0.04
Nodes (47): author, dependencies, bcryptjs, better-sqlite3, compression, cors, csv-parse, dotenv (+39 more)

### Community 4 - "migrate-sqlite-to-mysql.js"
Cohesion: 0.14
Nodes (29): assertDefaultAdminConfigured(), bcrypt, createTables(), DEFAULT_ADMIN, ensureDatabaseExists(), initDb(), migrateSRsTable(), migrateUsersCanEditDigitization() (+21 more)

### Community 5 - "DashboardHome.jsx"
Cohesion: 0.16
Nodes (6): AnimatedCounter(), TiltCard(), DashboardHome(), MONTHS, PALETTE, statsAPI

### Community 6 - "dependencies"
Cohesion: 0.05
Nodes (36): @ant-design/icons, antd, axios, dayjs, framer-motion, dependencies, @ant-design/icons, antd (+28 more)

### Community 7 - "deloitte-import.js"
Cohesion: 0.11
Nodes (22): { authenticate, requireRole }, DELOITTE_FIELDS, ensureAssignedToDeloitte(), ensureFieldValue(), ensurePendingWithDeloitte(), ETA_RE, express, extractRows() (+14 more)

### Community 8 - "services/backup.js"
Cohesion: 0.22
Nodes (12): BACKUP_DIR, cron, fs, getSettings(), initScheduler(), path, { pool, DB_NAME }, resolveMysqldump() (+4 more)

### Community 9 - "frontend/package.json"
Cohesion: 0.10
Nodes (20): devDependencies, oxlint, @types/react, @types/react-dom, vite, @vitejs/plugin-react, name, private (+12 more)

### Community 10 - "GreenMonster.jsx"
Cohesion: 0.27
Nodes (10): ANCHOR, anchorToPage(), angleBetween(), caretRelativeX(), computeFaceMove(), getMirror(), GreenMonster(), MIRROR_PROPS (+2 more)

### Community 11 - "users.js"
Cohesion: 0.07
Nodes (31): { authenticate }, bcrypt, crypto, { EMAIL_REGEX }, express, { hashToken, createResetToken }, jwt, { pool } (+23 more)

### Community 12 - "manageengine-import.js"
Cohesion: 0.14
Nodes (15): { authenticate, requireRole }, CLOSED_STATUSES, crossReference(), express, { getSyncStatus, runManageEngineSync }, isClosedFamily(), loadRows(), mapOpenStatus() (+7 more)

### Community 13 - "api.js"
Cohesion: 0.24
Nodes (9): api, backupAPI, csvImportAPI, deloitteImportAPI, loadingSubscribers, manageEngineImportAPI, publishLoadingState(), startTracking() (+1 more)

### Community 14 - "UpdateTasks.jsx"
Cohesion: 0.16
Nodes (8): CLASSIFICATION_COLOR, fmtEta(), SHEET_NAMES, TASK_FIELDS, UpdateFromManageEngine(), UploadDeloittePdf(), BulkAddUsersModal(), compactPaginationConfig()

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
Cohesion: 0.23
Nodes (10): Reveal(), RevealGroup(), BackupSettings(), formatBytes(), STATUS_TAG, BULK_USER_FIELDS, ROLE_COLORS, UserManagement() (+2 more)

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

### Community 30 - "App.jsx"
Cohesion: 0.18
Nodes (10): App(), Dashboard, ForgotPassword, Login, ResetPassword, GlobalLoadingIndicator(), LOADING_MESSAGE, LoadingNotice() (+2 more)

### Community 31 - "react"
Cohesion: 0.22
Nodes (6): BrandButton(), MagneticButton(), AuthContext, AuthProvider(), authAPI, react

### Community 32 - "pull_request_template.md"
Cohesion: 0.50
Nodes (3): Data and deployment impact, Verification, What changed?

### Community 33 - "manageengine-sync.js"
Cohesion: 0.12
Nodes (32): applyRequestUpdate(), assertApiSuccess(), beginRun(), CLOSED_STATUSES, comparable(), cron, dateTimeFromApi(), envFlag() (+24 more)

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

### Community 43 - "Login.jsx"
Cohesion: 0.47
Nodes (7): Arrow(), BarChart(), CheckScribble(), DashedCircle(), Sparkle(), Squiggle(), LoginScene

### Community 44 - "SRForm.jsx"
Cohesion: 0.28
Nodes (6): ALL_STATUSES, BASE_STATUSES, dateVal(), SR_TYPES, SRForm(), useDistinctOptions()

### Community 45 - "routes/backup.js"
Cohesion: 0.25
Nodes (7): { authenticate, requireRole }, express, fs, path, { pool }, router, { runBackup, getSettings, rescheduleBackups, BACKUP_DIR }

### Community 46 - "useAuth"
Cohesion: 0.40
Nodes (5): ProtectedRoute(), PublicRoute(), useAuth(), ChangePassword(), Login()

## Knowledge Gaps
- **300 isolated node(s):** `mysql`, `bcrypt`, `{ pool, DB_NAME }`, `mysql`, `jwt` (+295 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `SRPage.jsx`, `Dashboard.jsx`, `DashboardHome.jsx`, `GreenMonster.jsx`, `Login.jsx`, `SRForm.jsx`, `UpdateTasks.jsx`, `LoginScene.jsx`, `SRDetail.jsx`, `.oxlintrc.json`, `UserManagement.jsx`, `Reports.jsx`, `App.jsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `pool` connect `pool.js` to `manageengine-sync.js`, `migrate-sqlite-to-mysql.js`, `deloitte-import.js`, `services/backup.js`, `users.js`, `manageengine-import.js`, `routes/backup.js`, `srs.js`, `middleware/auth.js`, `csv-import.js`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `frontend/package.json`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `mysql`, `bcrypt`, `{ pool, DB_NAME }` to the rest of the system?**
  _300 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06201550387596899 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `migrate-sqlite-to-mysql.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13978494623655913 - nodes in this community are weakly interconnected._