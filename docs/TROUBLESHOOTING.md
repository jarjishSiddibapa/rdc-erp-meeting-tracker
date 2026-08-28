# Troubleshooting

## A batch window opens and closes immediately

The current scripts pause in manual mode so errors remain visible. Run them from a terminal to capture the exact message:

```powershell
cd C:\path\to\rdc-erp-meeting-tracker
.\build.bat
.\start-all.bat
```

Check `production-build.log` and `production-startup.log` in the project root. Common causes are missing Node.js on `PATH`, a missing `backend/.env`, missing dependencies, or a missing `frontend/dist/index.html`.

## The site opens but the old UI is still visible

The backend serves `frontend/dist`, not source files. Run `build.bat`, restart `start-all.bat`, and hard-refresh the browser. Hashed assets are cache-safe, while `index.html` is configured to revalidate.

## Port 777 is already in use

Find the process and stop the stale application before starting another copy:

```powershell
Get-NetTCPConnection -LocalPort 777 -State Listen
Stop-Process -Id <PID>
```

In production, stop the Task Scheduler task first so it does not immediately restart the process.

## MySQL connection or startup failure

Confirm the values in `backend/.env`, that MySQL is running, and that the configured user can connect to the configured database. The backend creates the database when the MySQL account has permission to do so; otherwise create it and grant access before starting the app.

## Login or password reset problems

Verify that the user is active and not soft-deleted. For password-reset mail, check `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`. The startup log reports whether the mailer initialized.

## Backups fail

The backup service needs `mysqldump.exe` available to the account running the backend. Set an absolute `MYSQLDUMP_PATH` when Task Scheduler has a restricted `PATH`, and confirm that the service account can write to `backend/db-backup`.

## Production update refuses to run

`update-production.bat` intentionally stops if tracked files are modified or staged. Review the diff, commit or revert the local change according to your release process, then rerun the update. It uses `git pull --ff-only` so it never creates an accidental merge on the production machine.

## Health check

After every start or update, verify:

```powershell
Invoke-RestMethod http://localhost:777/api/health
```

The response should contain `status: ok`. If it does not, read the startup log and the live console output before opening the application in a browser.
