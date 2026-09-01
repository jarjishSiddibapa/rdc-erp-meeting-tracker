# Security policy

## Scope

This repository contains an internal business application. Do not publish credentials, database exports, personal data, or production logs in issues or pull requests.

## Reporting a vulnerability

Report suspected vulnerabilities privately to the RDC application owner or IT administrator. Include the affected route or screen, reproduction steps, impact, and a safe contact method. Do not test destructive actions against the production database.

## Operational protections

- Keep `backend/.env` only on the machine that runs the application.
- Use a long random `JWT_SECRET` and preserve it during routine deployments.
- Use a dedicated MySQL account with only the required database privileges.
- Keep port `777` restricted to the intended RDC network or reverse proxy.
- Review backup access and retention through the production administrator.
- Run the application with `NODE_ENV=production`; `start-all.bat` sets it explicitly.
- Treat OAuth authorization codes and refresh tokens as secrets. Exchange codes immediately and
  never paste real values into source files, issues, documentation, or screenshots.
- Keep Task Scheduler under a dedicated account that can access only the project, its backup
  directory, MySQL, Node.js, and `mysqldump` as required.
- Use fictional data for repository screenshots and demonstrations.

## Application controls

- Passwords are hashed with bcrypt and never returned by API routes.
- JWTs are verified by Express middleware; category-aware write rules are enforced server-side.
- Login and password-reset routes are rate limited.
- Helmet security headers, a restricted CORS policy, request body limits, and upload size limits
  are enabled centrally.
- Records and users are soft-deleted in normal workflows, preserving audit intent.
- Backup filenames are generated/allowlisted by the server before download or deletion.
