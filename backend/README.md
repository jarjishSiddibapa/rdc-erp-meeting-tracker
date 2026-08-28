# Backend service

The backend is an Express 5 service that owns authentication, MySQL access, business rules, imports, backups, and static serving of the built React client.

## Commands

```powershell
npm install
npm start
npm run migrate:mysql   # one-time legacy SQLite migration only; see the development guide
```

The service reads `backend/.env`, initializes the MySQL schema on startup, and listens on port `777` by default. `GET /api/health` is the deployment health check.

Route groups and authorization rules are documented in [Architecture](../docs/ARCHITECTURE.md). Production operations are documented in [PRODUCTION.md](../PRODUCTION.md).
