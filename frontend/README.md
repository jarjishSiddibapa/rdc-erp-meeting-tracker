# Frontend

This directory contains the React/Vite client for RDC ERP Meeting Tracker. It is served by the Express backend from `frontend/dist` in production.

## Commands

```powershell
npm install
npm run dev       # Vite development server, normally http://localhost:5173
npm run lint
npm run build     # creates dist/ for the backend to serve
npm run preview
```

The Vite development server proxies `/api` requests to the backend on port `777`. For a production-style verification, build the frontend and open `http://localhost:777` instead of the Vite URL.

## Client structure

- `src/App.jsx` — authentication gates and route shell.
- `src/pages/` — dashboard, SR/Digitization lists, reports, imports, users, backups, and password screens.
- `src/components/` — reusable SR forms, detail views, comments, and date controls.
- `src/services/api.js` — the Axios API surface.
- `src/utils/` — pagination and Excel import/export helpers.

See the repository [development guide](../docs/DEVELOPMENT.md) and [architecture guide](../docs/ARCHITECTURE.md) for the complete system context.
