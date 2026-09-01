# Contributing

This is an internal RDC application. Contributions should preserve the existing audit, security, and deployment model.

## Workflow

1. Create a focused branch from `main`.
2. Make the smallest change that solves the request.
3. Update the relevant documentation when behavior, deployment, or formulas change.
4. Run the validation commands below and exercise the built app when the change is user-visible.
5. Open a pull request using the repository template and explain any migration or operational impact.

## Required checks

```powershell
npm run lint --prefix frontend
npm run build --prefix frontend
npm test --prefix backend
node --check backend/server.js
```

For database or import changes, also verify the real endpoint against a disposable record and remove the test data afterward. Never use production credentials or commit `.env` files.

For user-visible changes, update the relevant guide and screenshot. Repository screenshots must
come from fictional/disposable data; never capture the operational database for documentation.

## Commit guidance

Use short imperative commit subjects, for example `Clarify dashboard period labels`. Keep generated runtime data, database dumps, logs, `node_modules`, and `frontend/dist` out of commits.
