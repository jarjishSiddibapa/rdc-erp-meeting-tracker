# Graph Report - anesh-sir-erp-meeting-tracker-application  (2026-09-01)

## Corpus Check
- 73 files · ~92,112 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 673 nodes · 1052 edges · 48 communities (47 shown, 1 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5c294180`
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
- routes/backup.js
- frontend/package.json
- GreenMonster.jsx
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
- Feature reference
- Development guide
- Reports.jsx
- DEVELOPMENT.md
- Q: Use https://github.com/Leonxlnx/taste-skill to improve the UI of our web application, keep it smooth and lightweight.
- Q: Make the most of the taste skill and overhaul the web application so it works and looks as amazing as possible.
- Q: Use company color #00B51A and the taste skill to improve fonts, colors, sizes, smoothness, and overall UI quality.
- README.md
- DashboardHome.jsx
- react
- pull_request_template.md
- manageengine-sync.js
- Troubleshooting
- Architecture
- User guide
- Contributing
- UserManagement.jsx
- Security policy
- PRODUCTION.md
- API reference
- exchange-manageengine-code.js
- resetToken.js
- Product tour
- Engineering highlights
- Frontend
- Quick start

## God Nodes (most connected - your core abstractions)
1. `react` - 20 edges
2. `useAuth()` - 18 edges
3. `pool` - 14 edges
4. `main()` - 11 edges
5. `Feature reference` - 11 edges
6. `initDb()` - 10 edges
7. `authenticate()` - 10 edges
8. `normalizeRequest()` - 10 edges
9. `executeSync()` - 10 edges
10. `paginationConfig()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `AssignedToEcdReport()` --indirect_call--> `ResizableTitle()`  [INFERRED]
  frontend/src/pages/Reports.jsx → frontend/src/components/ui/ResizableTitle.jsx
- `Login()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/pages/Login.jsx → frontend/src/context/AuthContext.jsx
- `start()` --calls--> `initDb()`  [EXTRACTED]
  backend/server.js → backend/db/database.js
- `extractRows()` --references--> `pdf-parse`  [EXTRACTED]
  backend/routes/deloitte-import.js → backend/package.json
- `provisionUser()` --calls--> `createResetToken()`  [EXTRACTED]
  backend/routes/users.js → backend/utils/resetToken.js

## Import Cycles
- None detected.

## Communities (48 total, 1 thin omitted)

### Community 0 - "SRPage.jsx"
Cohesion: 0.17
Nodes (14): ClosureDateCell(), fmt(), fmtDT(), ResizableTitle(), buildColumns(), fmt(), fmtCreated(), SCOPE_COLORS (+6 more)

### Community 1 - "server.js"
Cohesion: 0.06
Nodes (41): ALLOWED_ORIGIN_PATTERNS, ALLOWED_ORIGINS, app, authLimiter, authRoutes, backupRoutes, compression, cors (+33 more)

### Community 2 - "users.js"
Cohesion: 0.15
Nodes (14): { authenticate, requireRole }, bcrypt, { createResetToken }, express, { generateRandomPassword }, { pool }, provisionUser(), { RDC_EMAIL_REGEX } (+6 more)

### Community 3 - "dependencies"
Cohesion: 0.04
Nodes (47): author, dependencies, bcryptjs, better-sqlite3, compression, cors, csv-parse, dotenv (+39 more)

### Community 4 - "migrate-sqlite-to-mysql.js"
Cohesion: 0.14
Nodes (30): assertDefaultAdminConfigured(), bcrypt, createTables(), DEFAULT_ADMIN, ensureDatabaseExists(), initDb(), migrateManageEngineSyncRuns(), migrateSRsTable() (+22 more)

### Community 5 - "SRForm.jsx"
Cohesion: 0.28
Nodes (6): ALL_STATUSES, BASE_STATUSES, dateVal(), SR_TYPES, SRForm(), useDistinctOptions()

### Community 6 - "dependencies"
Cohesion: 0.07
Nodes (26): @ant-design/icons, antd, dayjs, dependencies, @ant-design/icons, antd, dayjs, react (+18 more)

### Community 7 - "deloitte-import.js"
Cohesion: 0.12
Nodes (21): { authenticate, requireRole }, DELOITTE_FIELDS, ensureAssignedToDeloitte(), ensureFieldValue(), ensurePendingWithDeloitte(), ETA_RE, express, extractRows() (+13 more)

### Community 8 - "routes/backup.js"
Cohesion: 0.13
Nodes (19): { authenticate, requireRole }, express, fs, path, { pool }, router, { runBackup, getSettings, rescheduleBackups, BACKUP_DIR }, BACKUP_DIR (+11 more)

### Community 9 - "frontend/package.json"
Cohesion: 0.10
Nodes (20): devDependencies, oxlint, @types/react, @types/react-dom, vite, @vitejs/plugin-react, name, private (+12 more)

### Community 10 - "GreenMonster.jsx"
Cohesion: 0.27
Nodes (10): ANCHOR, anchorToPage(), angleBetween(), caretRelativeX(), computeFaceMove(), getMirror(), GreenMonster(), MIRROR_PROPS (+2 more)

### Community 11 - "routes/auth.js"
Cohesion: 0.13
Nodes (13): { authenticate }, bcrypt, crypto, { EMAIL_REGEX }, express, { hashToken, createResetToken }, jwt, { pool } (+5 more)

### Community 12 - "manageengine-import.js"
Cohesion: 0.14
Nodes (15): { authenticate, requireRole }, CLOSED_STATUSES, crossReference(), express, { getSyncStatus, runManageEngineSync }, isClosedFamily(), loadRows(), mapOpenStatus() (+7 more)

### Community 13 - "api.js"
Cohesion: 0.26
Nodes (13): api, clearReadCache(), executeRequest(), get(), httpError(), inFlightGets, loadingSubscribers, paramsString() (+5 more)

### Community 14 - "UpdateTasks.jsx"
Cohesion: 0.15
Nodes (7): CLASSIFICATION_COLOR, fmtEta(), SHEET_NAMES, TASK_FIELDS, UploadDeloittePdf(), csvImportAPI, deloitteImportAPI

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
Nodes (8): CONNECTION_LIMIT, MAX_IDLE, mysql, pool, { authenticate }, express, { pool }, router

### Community 19 - "csv-import.js"
Cohesion: 0.18
Nodes (8): authenticate(), jwt, requireRole(), { authenticate, requireRole }, express, { pool }, router, VALID_STATUSES

### Community 20 - ".oxlintrc.json"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 22 - "Feature reference"
Cohesion: 0.14
Nodes (14): Backup and production operations, Dashboard and operational visibility, Data integrity and audit behavior, Deloitte weekly PDF, Digitization Projects, Excel round trip, Feature reference, ManageEngine administration (+6 more)

### Community 23 - "Development guide"
Cohesion: 0.18
Nodes (11): Database and migrations, Development guide, Development workflows, Documentation and screenshots, Frontend conventions, Hot reload, Prerequisites, Production-style single port (+3 more)

### Community 24 - "Reports.jsx"
Cohesion: 0.29
Nodes (7): CommentCell(), fmtDT(), AssignedToEcdReport(), fmt(), STATUS_COLORS, reportsAPI, srAPI

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
Cohesion: 0.18
Nodes (10): Architecture, Configuration, Documentation, Integration flow, License and data boundary, Product capabilities, Quality gates, Repository map (+2 more)

### Community 30 - "DashboardHome.jsx"
Cohesion: 0.06
Nodes (34): App(), Dashboard, ForgotPassword, Login, ProtectedRoute(), PublicRoute(), ResetPassword, AnimatedCounter() (+26 more)

### Community 31 - "react"
Cohesion: 0.16
Nodes (11): BrandButton(), Reveal(), RevealGroup(), AuthContext, BackupSettings(), formatBytes(), STATUS_TAG, Login() (+3 more)

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
Cohesion: 0.22
Nodes (9): API map, Architecture, Authentication and authorization, Data model, Key design decisions, Performance and operational choices, Repository responsibilities, Runtime topology (+1 more)

### Community 36 - "User guide"
Cohesion: 0.25
Nodes (8): Dashboard, Loading and refresh behavior, Recommended daily workflow, Reports and backups, Roles and permissions, Service Requests and Digitization Projects, Update Tasks, User guide

### Community 37 - "Contributing"
Cohesion: 0.40
Nodes (4): Commit guidance, Contributing, Required checks, Workflow

### Community 38 - "UserManagement.jsx"
Cohesion: 0.29
Nodes (8): UpdateFromManageEngine(), BULK_USER_FIELDS, BulkAddUsersModal(), ROLE_COLORS, UserManagement(), userAPI, compactPaginationConfig(), paginationConfig()

### Community 39 - "Security policy"
Cohesion: 0.33
Nodes (5): Application controls, Operational protections, Reporting a vulnerability, Scope, Security policy

### Community 40 - "PRODUCTION.md"
Cohesion: 0.18
Nodes (8): Fields synchronized, ManageEngine API synchronization, OAuth setup, Production checks, First deployment after cloning, Installing future updates, Windows production deployment, Windows Task Scheduler

### Community 41 - "API reference"
Cohesion: 0.22
Nodes (9): API reference, Authentication, Authorization summary, Backups, Dashboard and reports, Health, Imports and synchronization, Service Requests and Digitization Projects (+1 more)

### Community 42 - "exchange-manageengine-code.js"
Cohesion: 0.38
Nodes (6): ENV_PATH, fs, main(), path, removeEnvValue(), upsertEnvValue()

### Community 43 - "resetToken.js"
Cohesion: 0.50
Nodes (4): createResetToken(), crypto, hashToken(), { pool }

### Community 44 - "Product tour"
Cohesion: 0.50
Nodes (4): Administration and resilience, Controlled updates and delivery reporting, Product tour, Work management

### Community 45 - "Engineering highlights"
Cohesion: 0.50
Nodes (4): Correctness and trust, Engineering highlights, Performance on a shared server, Security and operations

### Community 46 - "Frontend"
Cohesion: 0.67
Nodes (3): Client structure, Commands, Frontend

### Community 47 - "Quick start"
Cohesion: 0.67
Nodes (3): Local production-style run, Quick start, Requirements

## Knowledge Gaps
- **332 isolated node(s):** `mysql`, `bcrypt`, `{ pool, DB_NAME }`, `mysql`, `CONNECTION_LIMIT` (+327 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `extractRows()` connect `deloitte-import.js` to `dependencies`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `pdf-parse` connect `dependencies` to `deloitte-import.js`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `mysql`, `bcrypt`, `{ pool, DB_NAME }` to the rest of the system?**
  _332 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06201550387596899 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.041666666666666664 - nodes in this community are weakly interconnected._
- **Should `migrate-sqlite-to-mysql.js` be split into smaller, more focused modules?**
  _Cohesion score 0.1350806451612903 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07126436781609195 - nodes in this community are weakly interconnected._