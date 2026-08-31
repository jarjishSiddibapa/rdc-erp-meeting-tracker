# Development guide

## Prerequisites

- Node.js `20.19+` or `22.12+`
- npm
- MySQL 8-compatible server
- Git

## Setup

```powershell
npm install --prefix backend
npm install --prefix frontend
Copy-Item backend\.env.example backend\.env
notepad backend\.env
```

At minimum, configure `JWT_SECRET`, `DB_HOST`, `DB_USER`, and `DB_NAME`. Configure `DEFAULT_ADMIN_*` when initializing an empty database. SMTP and `MYSQLDUMP_PATH` are optional for local feature work but required for password-reset mail and scheduled backups.

## Development workflows

### Production-style single port

```powershell
npm run build --prefix frontend
npm start --prefix backend
```

Open `http://localhost:777`. Express serves the generated `frontend/dist` directory and the `/api` routes from the same origin.

### Hot reload

Run the backend and frontend in separate terminals:

```powershell
.\start-backend.bat
.\start-frontend.bat
```

Open the Vite URL shown by the frontend process, normally `http://localhost:5173`. API calls are proxied to port `777`.

## Validation before a pull request

```powershell
npm run lint --prefix frontend
npm run build --prefix frontend
npm test --prefix backend
node --check backend/server.js
node --check backend/routes/stats.js
```

Then exercise the real built app at `http://localhost:777`: sign in with a disposable test user, verify the changed screen and relevant API flow, and remove the test data. Focused backend unit tests cover deterministic mappings such as the ManageEngine sync, but real production-serving verification remains required.

## Database and migrations

`backend/db/database.js` creates missing tables and runs additive migrations during startup. New columns must follow the existing `information_schema.columns` check pattern so an existing production database upgrades safely. Do not edit production data manually as part of a feature change.

The `migrate:mysql` script is only for the one-time historical SQLite migration. It is not part of normal startup or deployment.

## Frontend conventions

- Keep heavy packages such as `xlsx` behind dynamic imports.
- Use `defaultPageSize` for ordinary Ant Design tables; only truly server-controlled tables should pass controlled pagination props.
- Memoize column builders in table-heavy pages.
- Check `category` before assuming a field belongs to an SR or Digitization Project.
- Preserve field history when a write changes a value, and skip history rows for no-op updates.

## Project map

See [Architecture](ARCHITECTURE.md) for the runtime and API map, and [Contributing](../CONTRIBUTING.md) for branch and review expectations.
