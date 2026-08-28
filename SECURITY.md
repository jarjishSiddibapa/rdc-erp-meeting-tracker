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
