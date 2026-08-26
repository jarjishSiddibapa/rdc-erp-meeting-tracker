# Windows production deployment

The production application uses one long-running process: the Node/Express backend on port `777`. Express serves both `/api/*` and the built React frontend from `frontend/dist`. Do not schedule the Vite development server.

## First deployment after cloning

Install these prerequisites on the production machine:

- Git
- Node.js `20.19+` or `22.12+`
- MySQL, with the production database and user available
- `mysqldump` when scheduled database backups are required

Then open PowerShell or Command Prompt and run:

```powershell
git clone https://github.com/jarjishSiddibapa/rdc-erp-meeting-tracker.git
cd rdc-erp-meeting-tracker
Copy-Item backend\.env.example backend\.env
notepad backend\.env
.\build.bat
```

Configure `backend/.env` before running the build:

- Set `NODE_ENV=production` and normally keep `PORT=777`.
- Use a long random `JWT_SECRET`. Preserve the same secret during later updates unless intentionally invalidating every active login.
- Enter the production MySQL host, port, database, username, and password.
- Configure the initial administrator values. They are used only when the database has no users and by the one-time SQLite migration.
- Configure SMTP values for password-reset and account emails.
- Set `MYSQLDUMP_PATH` if `mysqldump.exe` is not available on the Task Scheduler account's `PATH`.

If this clone replaces an older production folder, copy its existing `backend/.env` into the new checkout instead of generating new credentials. The active MySQL database is not stored in Git. Preserve any existing `backend/db-backup` files separately if their history is required.

After `build.bat` succeeds, test once interactively:

```powershell
.\start-all.bat
```

Open `http://localhost:777/api/health` and confirm it returns `status: ok`. Stop the interactive process with `Ctrl+C` before enabling the scheduled task.

For access from other LAN computers, allow inbound TCP port `777` in Windows Firewall and open `http://<production-machine-ip>:777`.

## Windows Task Scheduler

Keep the existing startup task, but make sure it uses these settings:

- **Program/script:** `C:\Windows\System32\cmd.exe`
- **Arguments:** `/d /c ""C:\path\to\rdc-erp-meeting-tracker\start-all.bat" --scheduled"`
- **Start in:** `C:\path\to\rdc-erp-meeting-tracker`
- **Trigger:** At system startup, preferably delayed by 30 seconds so MySQL and networking can initialize.
- **Security:** Run whether the user is logged on or not, using an account that can read the project, connect to MySQL, write backup/log folders, and run `node.exe` and `mysqldump.exe`.
- **Failure recovery:** Restart every 1 minute after failure. Configure multiple retry attempts.
- **Concurrent runs:** If the task is already running, do not start a new instance.
- **Time limit:** Do not stop the task merely because it has run for a long time; it is the application server.

`start-all.bat` intentionally does not use `start`, open another console, or rebuild files. A manual double-click pauses when the application stops so errors remain visible. Task Scheduler must pass `--scheduled`; in that mode Node remains attached to the task and the batch file returns Node's exit code immediately so Scheduler can detect and restart failures.

If a manual build or start fails, the window remains open and the scripts also record the outcome in `production-build.log` or `production-startup.log` in the project root. These runtime logs are excluded from Git.

## Installing future updates

1. End the scheduled application task and confirm port `777` is no longer listening.
2. From the project folder, run:

   ```powershell
   .\update-production.bat
   ```

3. Start the scheduled task again.
4. Verify `http://localhost:777/api/health`, then refresh the application in a browser.

The update script refuses to merge over tracked local changes, pulls `origin/main` using `--ff-only`, installs the exact dependency versions from both lockfiles with `npm ci`, and rebuilds `frontend/dist`. It does not replace `backend/.env`, the MySQL database, logs, or backup files because those are excluded from Git.
