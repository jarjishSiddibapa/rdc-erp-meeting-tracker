# Graph Report - anesh-sir-erp-meeting-tracker-application  (2026-08-28)

## Corpus Check
- 70 files · ~128,026 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 580 nodes · 882 edges · 33 communities
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b65d1f48`
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
- GreenMonster.jsx
- routes/auth.js
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
- Troubleshooting
- Q: Use https://github.com/Leonxlnx/taste-skill to improve the UI of our web application, keep it smooth and lightweight.
- Q: Make the most of the taste skill and overhaul the web application so it works and looks as amazing as possible.
- Q: Use company color #00B51A and the taste skill to improve fonts, colors, sizes, smoothness, and overall UI quality.
- RDC ERP Meeting Tracker
- users.js
- react
- pull_request_template.md

## God Nodes (most connected - your core abstractions)
1. `react` - 23 edges
2. `useAuth()` - 18 edges
3. `pool` - 13 edges
4. `main()` - 11 edges
5. `authenticate()` - 10 edges
6. `initDb()` - 9 edges
7. `paginationConfig()` - 9 edges
8. `Troubleshooting` - 9 edges
9. `SRDetail()` - 8 edges
10. `Reveal()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `SRPage()` --indirect_call--> `ResizableTitle()`  [INFERRED]
  frontend/src/pages/SRPage.jsx → frontend/src/components/ui/ResizableTitle.jsx
- `ChangePassword()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/pages/ChangePassword.jsx → frontend/src/context/AuthContext.jsx
- `start()` --calls--> `initDb()`  [EXTRACTED]
  backend/server.js → backend/db/database.js
- `provisionUser()` --calls--> `createResetToken()`  [EXTRACTED]
  backend/routes/users.js → backend/utils/resetToken.js
- `start()` --calls--> `initScheduler()`  [EXTRACTED]
  backend/server.js → backend/services/backup.js

## Import Cycles
- None detected.

## Communities (33 total, 0 thin omitted)

### Community 0 - "SRPage.jsx"
Cohesion: 0.17
Nodes (14): ClosureDateCell(), fmt(), fmtDT(), CommentCell(), fmtDT(), buildColumns(), fmt(), SCOPE_COLORS (+6 more)

### Community 1 - "server.js"
Cohesion: 0.06
Nodes (43): ALLOWED_ORIGIN_PATTERNS, ALLOWED_ORIGINS, app, authLimiter, authRoutes, backupRoutes, compression, cors (+35 more)

### Community 2 - "useAuth"
Cohesion: 0.06
Nodes (37): App(), Dashboard, ForgotPassword, Login, ProtectedRoute(), PublicRoute(), ResetPassword, ALL_STATUSES (+29 more)

### Community 3 - "dependencies"
Cohesion: 0.04
Nodes (45): author, dependencies, bcryptjs, better-sqlite3, compression, cors, csv-parse, dotenv (+37 more)

### Community 4 - "migrate-sqlite-to-mysql.js"
Cohesion: 0.14
Nodes (29): assertDefaultAdminConfigured(), bcrypt, createTables(), DEFAULT_ADMIN, ensureDatabaseExists(), initDb(), migrateSRsTable(), migrateUsersCanEditDigitization() (+21 more)

### Community 5 - "DashboardHome.jsx"
Cohesion: 0.13
Nodes (11): AnimatedCounter(), Reveal(), RevealGroup(), TiltCard(), BackupSettings(), formatBytes(), STATUS_TAG, MONTHS (+3 more)

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

### Community 10 - "GreenMonster.jsx"
Cohesion: 0.27
Nodes (10): ANCHOR, anchorToPage(), angleBetween(), caretRelativeX(), computeFaceMove(), getMirror(), GreenMonster(), MIRROR_PROPS (+2 more)

### Community 11 - "routes/auth.js"
Cohesion: 0.14
Nodes (14): { authenticate }, bcrypt, crypto, { EMAIL_REGEX }, express, { hashToken, createResetToken }, jwt, { pool } (+6 more)

### Community 12 - "manageengine-import.js"
Cohesion: 0.16
Nodes (14): { authenticate, requireRole }, CLOSED_STATUSES, crossReference(), express, isClosedFamily(), loadRows(), mapOpenStatus(), multer (+6 more)

### Community 13 - "api.js"
Cohesion: 0.32
Nodes (3): api, authAPI, manageEngineImportAPI

### Community 14 - "UpdateTasks.jsx"
Cohesion: 0.15
Nodes (7): CLASSIFICATION_COLOR, fmtEta(), SHEET_NAMES, TASK_FIELDS, UploadDeloittePdf(), csvImportAPI, deloitteImportAPI

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
Cohesion: 0.33
Nodes (5): rules, react/only-export-components, react/rules-of-hooks, $schema, warn

### Community 22 - "UserManagement.jsx"
Cohesion: 0.29
Nodes (8): UpdateFromManageEngine(), BULK_USER_FIELDS, BulkAddUsersModal(), ROLE_COLORS, UserManagement(), userAPI, compactPaginationConfig(), paginationConfig()

### Community 23 - "Development guide"
Cohesion: 0.20
Nodes (10): Database and migrations, Development guide, Development workflows, Frontend conventions, Hot reload, Prerequisites, Production-style single port, Project map (+2 more)

### Community 24 - "Reports.jsx"
Cohesion: 0.36
Nodes (5): ResizableTitle(), AssignedToEcdReport(), fmt(), STATUS_COLORS, reportsAPI

### Community 25 - "Troubleshooting"
Cohesion: 0.05
Nodes (39): Backend service, Commands, Commit guidance, Contributing, Required checks, Workflow, API map, Architecture (+31 more)

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

### Community 30 - "users.js"
Cohesion: 0.15
Nodes (14): { authenticate, requireRole }, bcrypt, { createResetToken }, express, { generateRandomPassword }, { pool }, provisionUser(), { RDC_EMAIL_REGEX } (+6 more)

### Community 31 - "react"
Cohesion: 0.19
Nodes (6): plugins, BrandButton(), MagneticButton(), ChangePassword(), oxc, react

### Community 32 - "pull_request_template.md"
Cohesion: 0.50
Nodes (3): Data and deployment impact, Verification, What changed?

## Knowledge Gaps
- **280 isolated node(s):** `mysql`, `bcrypt`, `{ pool, DB_NAME }`, `mysql`, `jwt` (+275 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `SRPage.jsx`, `useAuth`, `DashboardHome.jsx`, `GreenMonster.jsx`, `api.js`, `UpdateTasks.jsx`, `SRDetail.jsx`, `UserManagement.jsx`, `Reports.jsx`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `pool` connect `pool.js` to `migrate-sqlite-to-mysql.js`, `deloitte-import.js`, `routes/backup.js`, `routes/auth.js`, `manageengine-import.js`, `srs.js`, `middleware/auth.js`, `csv-import.js`, `users.js`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `frontend/package.json`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `mysql`, `bcrypt`, `{ pool, DB_NAME }` to the rest of the system?**
  _280 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.057971014492753624 - nodes in this community are weakly interconnected._
- **Should `useAuth` be split into smaller, more focused modules?**
  _Cohesion score 0.06462585034013606 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._