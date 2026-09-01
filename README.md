# RDC ERP Meeting Tracker

[![CI](https://github.com/jarjishSiddibapa/rdc-erp-meeting-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/jarjishSiddibapa/rdc-erp-meeting-tracker/actions/workflows/ci.yml)

Internal operations application for RDC Concrete. The Meeting Tracker brings Service Requests (SRs), Digitization Projects, status imports, dashboard reporting, user administration, and MySQL backups into one small, focused system.

![RDC dashboard overview](docs/images/dashboard-overview.png)

## What it does

- Track Service Requests and Digitization Projects in one searchable workspace.
- Show current workload, overdue items, seven-day activity, and pending ownership at a glance.
- Import weekly Deloitte PDF status reports with a reviewable parse step before applying changes.
- Download, edit, and re-upload a combined Excel workbook for controlled bulk updates.
- Synchronize existing SRs from ManageEngine Cloud every 30 minutes and automatically add new active Oracle ERP requests, with a manual CSV fallback.
- Keep a field-level history and threaded comments for auditability.
- Manage admin, editor, and viewer access with category-aware permissions.
- Run scheduled MySQL backups from the application or Backup Settings screen.
- Serve the built React application and Express API from one port for simple LAN deployment.

## Screenshots

The screenshots were captured from the current application build. They are intentionally cropped to avoid publishing individual service-request details; the figures shown may change as the operational database changes.

| Login | Bulk update workflow |
| --- | --- |
| ![RDC login screen](docs/images/login.png) | ![Update Tasks workflow](docs/images/update-tasks.png) |

## Quick start

### Requirements

- Node.js `20.19+` or `22.12+`
- npm
- MySQL 8-compatible server and credentials
- Windows is the supported production platform; development also works from PowerShell or Bash.

### Run locally

```powershell
git clone https://github.com/jarjishSiddibapa/rdc-erp-meeting-tracker.git
cd rdc-erp-meeting-tracker
npm install --prefix backend
npm install --prefix frontend
Copy-Item backend\.env.example backend\.env
notepad backend\.env
npm run build --prefix frontend
npm start --prefix backend
```

Open <http://localhost:777>. On first startup, the backend creates missing tables and runs safe schema migrations. If the database has no users, the configured `DEFAULT_ADMIN_*` values seed the first administrator.

For a hot-reload development session, use `start-backend.bat` and `start-frontend.bat`. For the production-style single-port build, use `build.bat` followed by `start-all.bat`.

## Documentation

| Guide | Use it for |
| --- | --- |
| [Production deployment](PRODUCTION.md) | First Windows deployment, Task Scheduler, updates, health checks, and rollback |
| [User guide](docs/USER_GUIDE.md) | Dashboard meanings, roles, imports, comments, and daily workflows |
| [Development guide](docs/DEVELOPMENT.md) | Local setup, commands, migrations, verification, and contribution flow |
| [Architecture](docs/ARCHITECTURE.md) | Runtime topology, data model, API map, and design decisions |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Batch files, port 777, MySQL, stale builds, email, and backups |
| [ManageEngine sync](docs/MANAGEENGINE_SYNC.md) | OAuth setup, synchronized fields, pending-side logic, and production checks |
| [Security policy](SECURITY.md) | Secret handling and private vulnerability reporting |
| [Contributing](CONTRIBUTING.md) | Branch, review, and validation expectations |

## Technology

- **Frontend:** React 19, Vite 8, Ant Design 6, native Fetch, Day.js
- **Backend:** Node.js, Express 5, MySQL via `mysql2/promise`
- **Security:** JWT sessions, bcrypt password hashes, Helmet, CORS allow-list, rate-limited auth routes
- **Operations:** Windows Task Scheduler, `mysqldump`, compressed HTTP responses, structured runtime logs

The production build deliberately avoids a separate frontend server, WebGL/3D UI libraries,
and a second application framework. Route chunks are warmed during browser idle time, stale
table requests are cancelled, short-lived read results are reused, and the PDF parser is
loaded only when an administrator actually parses a PDF. This keeps the shared production
machine quiet without changing the familiar interface.

## Repository layout

```text
backend/             Express API, MySQL schema/migrations, imports, backups
frontend/            React application and production build
docs/                User, development, architecture, and troubleshooting guides
graphify-out/        Maintained codebase knowledge graph outputs
build.bat            Install locked dependencies and build frontend/dist
start-all.bat        Run the production-style single-port server
update-production.bat Pull main, install locked dependencies, and rebuild safely
```

## Security and data boundaries

Never commit `backend/.env`, database dumps, uploads, generated logs, or real credentials. The production MySQL database and runtime folders are deliberately outside Git. The app is intended for the RDC internal network; place it behind the organisation's normal network and firewall controls.

This repository contains internal business software. It is not licensed for public redistribution.
