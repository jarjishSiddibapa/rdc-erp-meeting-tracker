# Backend service

The backend is an Express 5 service that owns authentication, MySQL access, business rules, imports, backups, and static serving of the built React client.

## Commands

```powershell
npm install
npm start
npm test
npm run migrate:mysql   # one-time legacy SQLite migration only; see the development guide
npm run manageengine:exchange-code  # exchange a short-lived OAuth code safely
```

The service reads `backend/.env`, initializes the MySQL schema on startup, and listens on port `777` by default. `GET /api/health` is the deployment health check.

Route groups and authorization rules are documented in [Architecture](../docs/ARCHITECTURE.md)
and the [API reference](../docs/API_REFERENCE.md). Production operations are documented in
[PRODUCTION.md](../PRODUCTION.md).

The focused Node test suite covers deterministic ManageEngine normalization, pending-side
logic, field mapping, and automatic Oracle ERP intake. User-visible or database changes still
receive production-style verification against the built application with disposable data.
