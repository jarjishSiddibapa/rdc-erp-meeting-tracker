# RDC ERP Meeting Tracker

Internal ERP application for tracking Service Requests and Digitization Projects, including dashboard reporting, Excel-based bulk updates, Deloitte PDF imports, user administration, and scheduled MySQL backups.

## Technology

- Backend: Node.js, Express, MySQL
- Frontend: React, Vite, Ant Design
- Production serving: Express serves both the API and the built frontend on port `777`

## Local setup

Prerequisites: Node.js, npm, and MySQL.

1. Install dependencies:

   ```powershell
   npm install --prefix backend
   npm install --prefix frontend
   ```

2. Copy `backend/.env.example` to `backend/.env` and enter the local database, JWT, initial administrator, email, and backup settings.

3. Build the frontend:

   ```powershell
   npm run build --prefix frontend
   ```

4. Start the application:

   ```powershell
   npm start --prefix backend
   ```

5. Open `http://localhost:777`.

Database schema creation and migrations run automatically when the backend starts. Runtime databases, SQL backups, logs, generated frontend files, dependency folders, and environment secrets are intentionally excluded from Git.

For the production Windows machine, including the Task Scheduler configuration and safe update procedure, see [PRODUCTION.md](PRODUCTION.md).

## Useful commands

```powershell
npm run lint --prefix frontend
npm run build --prefix frontend
graphify update .
```
