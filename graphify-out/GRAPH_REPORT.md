# Graph Report - anesh-sir-erp-meeting-tracker-application  (2026-09-04)

## Corpus Check
- 76 files · ~94,732 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 690 nodes · 1081 edges · 46 communities (45 shown, 1 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b3590651`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SRPage.jsx
- server.js
- users.js
- dependencies
- migrate-sqlite-to-mysql.js
- SRForm.jsx
- dependencies
- deloitte-import.js
- services/backup.js
- frontend/package.json
- GreenMonster.jsx
- csv-import.js
- manageengine-import.js
- api.js
- UpdateTasks.jsx
- srs.js
- SRDetail.jsx
- middleware/auth.js
- pool.js
- UserManagement.jsx
- .oxlintrc.json
- Feature reference
- Development guide
- DashboardHome.jsx
- DEVELOPMENT.md
- Q: Use https://github.com/Leonxlnx/taste-skill to improve the UI of our web application, keep it smooth and lightweight.
- Q: Make the most of the taste skill and overhaul the web application so it works and looks as amazing as possible.
- Q: Use company color #00B51A and the taste skill to improve fonts, colors, sizes, smoothness, and overall UI quality.
- README.md
- Dashboard.jsx
- react
- pull_request_template.md
- manageengine-sync.js
- Troubleshooting
- Architecture
- User guide
- Contributing
- routes/backup.js
- Security policy
- PRODUCTION.md
- API reference
- manageengine-update-only.test.js
- Product tour
- Engineering highlights
- Frontend

## God Nodes (most connected - your core abstractions)
1. `react` - 20 edges
2. `useAuth()` - 18 edges
3. `pool` - 14 edges
4. `initDb()` - 11 edges
5. `main()` - 11 edges
6. `Feature reference` - 11 edges
7. `authenticate()` - 10 edges
8. `paginationConfig()` - 9 edges
9. `API reference` - 9 edges
10. `Development guide` - 9 edges

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

## Communities (46 total, 1 thin omitted)

### Community 0 - "SRPage.jsx"
Cohesion: 0.17
Nodes (14): ClosureDateCell(), fmt(), fmtDT(), ResizableTitle(), buildColumns(), fmt(), fmtCreated(), SCOPE_COLORS (+6 more)

### Community 1 - "server.js"
Cohesion: 0.06
Nodes (44): ALLOWED_ORIGIN_PATTERNS, ALLOWED_ORIGINS, app, authLimiter, authRoutes, backupRoutes, compression, cors (+36 more)

### Community 2 - "users.js"
Cohesion: 0.08
Nodes (28): { authenticate }, bcrypt, crypto, { EMAIL_REGEX }, express, { hashToken, createResetToken }, jwt, { pool } (+20 more)

### Community 3 - "dependencies"
Cohesion: 0.04
Nodes (45): author, dependencies, bcryptjs, better-sqlite3, compression, cors, csv-parse, dotenv (+37 more)

### Community 4 - "migrate-sqlite-to-mysql.js"
Cohesion: 0.13
Nodes (31): assertDefaultAdminConfigured(), bcrypt, createTables(), DEFAULT_ADMIN, ensureDatabaseExists(), initDb(), migrateManageEngineSyncRuns(), migrateSRsTable() (+23 more)

### Community 5 - "SRForm.jsx"
Cohesion: 0.28
Nodes (6): ALL_STATUSES, BASE_STATUSES, dateVal(), SR_TYPES, SRForm(), useDistinctOptions()

### Community 6 - "dependencies"
Cohesion: 0.07
Nodes (26): @ant-design/icons, antd, dayjs, dependencies, @ant-design/icons, antd, dayjs, react (+18 more)

### Community 7 - "deloitte-import.js"
Cohesion: 0.10
Nodes (31): pdf-parse, { authenticate, requireRole }, collectEtaCandidates(), compactText(), consolidateParsedRows(), DELOITTE_FIELDS, ensureAssignedToDeloitte(), ensureFieldValue() (+23 more)

### Community 8 - "services/backup.js"
Cohesion: 0.22
Nodes (12): BACKUP_DIR, cron, fs, getSettings(), initScheduler(), path, { pool, DB_NAME }, resolveMysqldump() (+4 more)

### Community 9 - "frontend/package.json"
Cohesion: 0.10
Nodes (20): devDependencies, oxlint, @types/react, @types/react-dom, vite, @vitejs/plugin-react, name, private (+12 more)

### Community 10 - "GreenMonster.jsx"
Cohesion: 0.27
Nodes (10): ANCHOR, anchorToPage(), angleBetween(), caretRelativeX(), computeFaceMove(), getMirror(), GreenMonster(), MIRROR_PROPS (+2 more)

### Community 11 - "csv-import.js"
Cohesion: 0.22
Nodes (5): { authenticate, requireRole }, express, { pool }, router, VALID_STATUSES

### Community 12 - "manageengine-import.js"
Cohesion: 0.16
Nodes (13): { authenticate, requireRole }, CLOSED_STATUSES, crossReference(), express, { getSyncStatus, runManageEngineSync }, isClosedFamily(), loadRows(), multer (+5 more)

### Community 13 - "api.js"
Cohesion: 0.18
Nodes (18): GlobalLoadingIndicator(), LOADING_MESSAGE, LoadingNotice(), api, clearReadCache(), executeRequest(), get(), getApiLoadingSnapshot() (+10 more)

### Community 14 - "UpdateTasks.jsx"
Cohesion: 0.15
Nodes (7): CLASSIFICATION_COLOR, fmtEta(), SHEET_NAMES, TASK_FIELDS, UploadDeloittePdf(), csvImportAPI, deloitteImportAPI

### Community 15 - "srs.js"
Cohesion: 0.15
Nodes (10): addInFilter(), addPendingWithFilter(), { authenticate, requireRole }, DISTINCT_FIELDS, express, { pool }, router, SORTABLE_FIELDS (+2 more)

### Community 16 - "SRDetail.jsx"
Cohesion: 0.13
Nodes (16): CommentCell(), fmtDT(), ALL_STATUSES, BASE_STATUSES, fmt(), fmtDT(), SCOPE_COLORS, SR_TYPES (+8 more)

### Community 17 - "middleware/auth.js"
Cohesion: 0.25
Nodes (7): authenticate(), jwt, requireRole(), { authenticate }, express, { pool }, router

### Community 18 - "pool.js"
Cohesion: 0.18
Nodes (8): CONNECTION_LIMIT, MAX_IDLE, mysql, pool, { authenticate }, express, { pool }, router

### Community 19 - "UserManagement.jsx"
Cohesion: 0.20
Nodes (12): BackupSettings(), formatBytes(), STATUS_TAG, UpdateFromManageEngine(), BULK_USER_FIELDS, BulkAddUsersModal(), ROLE_COLORS, UserManagement() (+4 more)

### Community 20 - ".oxlintrc.json"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 22 - "Feature reference"
Cohesion: 0.14
Nodes (14): Backup and production operations, Dashboard and operational visibility, Data integrity and audit behavior, Deloitte weekly PDF, Digitization Projects, Excel round trip, Feature reference, ManageEngine administration (+6 more)

### Community 23 - "Development guide"
Cohesion: 0.18
Nodes (11): Database and migrations, Development guide, Development workflows, Documentation and screenshots, Frontend conventions, Hot reload, Prerequisites, Production-style single port (+3 more)

### Community 24 - "DashboardHome.jsx"
Cohesion: 0.16
Nodes (7): AnimatedCounter(), Reveal(), RevealGroup(), TiltCard(), MONTHS, PALETTE, statsAPI

### Community 26 - "Q: Use https://github.com/Leonxlnx/taste-skill to improve the UI of our web application, keep it smooth and lightweight."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Use https://github.com/Leonxlnx/taste-skill to improve the UI of our web application, keep it smooth and lightweight., Source Nodes

### Community 27 - "Q: Make the most of the taste skill and overhaul the web application so it works and looks as amazing as possible."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Make the most of the taste skill and overhaul the web application so it works and looks as amazing as possible., Source Nodes

### Community 28 - "Q: Use company color #00B51A and the taste skill to improve fonts, colors, sizes, smoothness, and overall UI quality."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Use company color #00B51A and the taste skill to improve fonts, colors, sizes, smoothness, and overall UI quality., Source Nodes

### Community 29 - "README.md"
Cohesion: 0.14
Nodes (13): Architecture, Configuration, Documentation, Integration flow, License and data boundary, Local production-style run, Product capabilities, Quality gates (+5 more)

### Community 30 - "Dashboard.jsx"
Cohesion: 0.15
Nodes (14): ALL_KEYS, BackupSettings, ChangePassword, Dashboard(), MENU_ITEMS, PAGE_LOADERS, preloadPage(), Reports (+6 more)

### Community 31 - "react"
Cohesion: 0.13
Nodes (15): App(), Dashboard, ForgotPassword, Login, ProtectedRoute(), PublicRoute(), ResetPassword, BrandButton() (+7 more)

### Community 32 - "pull_request_template.md"
Cohesion: 0.50
Nodes (3): Data and deployment impact, Verification, What changed?

### Community 33 - "manageengine-sync.js"
Cohesion: 0.09
Nodes (44): ENV_PATH, fs, main(), path, removeEnvValue(), { serviceDeskApiDomainFor, trimTrailingSlash }, upsertEnvValue(), applyRequestUpdate() (+36 more)

### Community 34 - "Troubleshooting"
Cohesion: 0.22
Nodes (9): A batch window opens and closes immediately, Backups fail, Health check, Login or password reset problems, MySQL connection or startup failure, Port 777 is already in use, Production update refuses to run, The site opens but the old UI is still visible (+1 more)

### Community 35 - "Architecture"
Cohesion: 0.22
Nodes (9): API map, Architecture, Authentication and authorization, Data model, Key design decisions, Performance and operational choices, Repository responsibilities, Runtime topology (+1 more)

### Community 36 - "User guide"
Cohesion: 0.25
Nodes (8): Dashboard, Loading and refresh behavior, Recommended daily workflow, Reports and backups, Roles and permissions, Service Requests and Digitization Projects, Update Tasks, User guide

### Community 37 - "Contributing"
Cohesion: 0.40
Nodes (4): Commit guidance, Contributing, Required checks, Workflow

### Community 38 - "routes/backup.js"
Cohesion: 0.25
Nodes (7): { authenticate, requireRole }, express, fs, path, { pool }, router, { runBackup, getSettings, rescheduleBackups, BACKUP_DIR }

### Community 39 - "Security policy"
Cohesion: 0.33
Nodes (5): Application controls, Operational protections, Reporting a vulnerability, Scope, Security policy

### Community 40 - "PRODUCTION.md"
Cohesion: 0.18
Nodes (8): Fields synchronized, ManageEngine API synchronization, OAuth setup, Production checks, First deployment after cloning, Installing future updates, Windows production deployment, Windows Task Scheduler

### Community 41 - "API reference"
Cohesion: 0.22
Nodes (9): API reference, Authentication, Authorization summary, Backups, Dashboard and reports, Health, Imports and synchronization, Service Requests and Digitization Projects (+1 more)

### Community 43 - "manageengine-update-only.test.js"
Cohesion: 0.33
Nodes (5): assert, backendRoot, fs, path, test

### Community 44 - "Product tour"
Cohesion: 0.50
Nodes (4): Administration and resilience, Controlled updates and delivery reporting, Product tour, Work management

### Community 45 - "Engineering highlights"
Cohesion: 0.50
Nodes (4): Correctness and trust, Engineering highlights, Performance on a shared server, Security and operations

### Community 46 - "Frontend"
Cohesion: 0.67
Nodes (3): Client structure, Commands, Frontend

## Knowledge Gaps
- **339 isolated node(s):** `mysql`, `bcrypt`, `{ pool, DB_NAME }`, `mysql`, `CONNECTION_LIMIT` (+334 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `deloitte-import.js`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `pdf-parse` connect `deloitte-import.js` to `dependencies`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `mysql`, `bcrypt`, `{ pool, DB_NAME }` to the rest of the system?**
  _339 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.056429232192414434 - nodes in this community are weakly interconnected._
- **Should `users.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07765151515151515 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `migrate-sqlite-to-mysql.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13068181818181818 - nodes in this community are weakly interconnected._