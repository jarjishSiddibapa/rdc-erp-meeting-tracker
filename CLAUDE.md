# RDC ERP / Meeting Tracker — Project Knowledge

Internal ERP tool for RDC Concrete. Tracks two record types through one unified system:
**Service Requests (SR)** and **Digitization Projects** — plus a weekly workflow for
importing Deloitte's status-report PDF and keeping SRs synced against it. Small-to-medium
scale (tens–low hundreds of records, a handful of concurrent users), not internet-scale —
weigh any performance/architecture decision against that reality, not hypothetical scale.

This is a Git repository with focused backend unit tests. Final verification still exercises
the real production-style build (see "How changes get verified" below).

## Stack

- **Backend**: Node.js + Express 5, MySQL via `mysql2/promise` (connection pool, no ORM).
  JWT auth (`jsonwebtoken`), `bcryptjs` for passwords, `multer` for uploads, `node-cron` for
  scheduled backups, `nodemailer` for email, `pdf-parse` v2.x for the Deloitte PDF importer.
- **Frontend**: React 19 + Vite 8 + antd v6. Native `fetch` for API calls, `dayjs` for dates,
  lightweight CSS transitions plus the SVG/CSS `GreenMonster` login mascot, and `xlsx` for
  Excel import/export (dynamically imported at click-time, not bundled eagerly).
- **Hosting**: single-port. The backend (port 777) serves the built frontend
  (`frontend/dist`, via `express.static`) AND the API from the same origin — there is no
  separate frontend server in production. `frontend/dist` must be rebuilt
  (`npm run build` inside `frontend/`) and the backend restarted for frontend changes to
  appear at `http://localhost:777`. Running `npm run dev` (Vite dev server, port 5173) is
  possible for iterating on frontend-only changes but is not how this app is normally run or
  verified in this project's workflow.

## Repo layout

```
backend/
  server.js              — Express app entrypoint, mounts routes, serves frontend/dist
  db/pool.js              — mysql2 connection pool
  db/database.js          — schema (CREATE TABLE IF NOT EXISTS) + migration functions + seeding
  middleware/auth.js       — authenticate() (JWT verify) and requireRole(...roles)
  routes/
    auth.js                — login, /me, change-password, forgot/reset password
    users.js                — user CRUD (admin only), bulk user creation from Excel
    srs.js                  — SR + Digitization CRUD, list/filter/sort, comments, stats
    stats.js                — dashboard summary stats (category totals, pending-by-person)
    reports.js               — "Assigned to Deloitte" ECD-history report
    deloitte-import.js       — weekly Deloitte PDF parse + apply
    csv-import.js            — bulk Excel import/update for SR + Digitization ("Update Tasks")
    backup.js                — manual/scheduled MySQL backup management
  services/                — mailer.js, backup.js, heartbeat.js
  utils/                    — password.js, resetToken.js, validation.js
  scripts/migrate-sqlite-to-mysql.js — one-time historical migration, not part of normal ops

frontend/src/
  App.jsx                  — routes, lazy-loaded (Login/ForgotPassword/ResetPassword/Dashboard)
  context/AuthContext.jsx   — user/token in sessionStorage (NOT localStorage), login()/logout()
  pages/                    — one file per route/screen (SRPage, Dashboard, DashboardHome,
                                Reports, UpdateTasks, UserManagement, BackupSettings, etc.)
  components/               — SRDetail.jsx (view/edit modal), SRForm.jsx (add/edit form),
                                CommentCell.jsx, ClosureDateCell.jsx
  components/ui/            — small reusable UI primitives (BrandButton, Reveal, TiltCard, ...)
  services/api.js           — native Fetch wrapper, request tracking/cache, one API object per route group
  utils/pagination.js        — shared antd Table pagination config (see gotcha below)
  utils/excelIO.js, exportExcel.js — xlsx read/write helpers, dynamically imported

.claude/launch.json         — dev-server launch config (`npm --prefix backend start`, port 777)
graphify-out/                — knowledge graph of this codebase (see AGENTS.md for usage)
```

## Data model essentials

- **One table, two categories**: `srs.category` is `'SR'` or `'Digitization'` — same table,
  same routes (`routes/srs.js`), different field sets used per category (e.g. `project_name`/
  `process_owner`/`target_date` are Digitization-only; `scope`/`description` are SR-only).
  Always check `category` before assuming which fields are meaningful.
- **Soft delete everywhere**: `is_deleted` flag, never a real `DELETE` on `srs` or `users` in
  normal app flow. `sr_history`/`sr_comments` have FK constraints back to `users.id` and
  `srs.id` — this matters when hard-deleting disposable test data (see verification section).
- **`sr_history`**: every field change is logged (`field_changed`, `old_value`, `new_value`,
  `changed_by`) — this is what powers the SR detail timeline. Any code path that changes a
  field should log a history row, diffed (only when the value actually changes).
- **Schema migrations**: `db/database.js` uses `CREATE TABLE IF NOT EXISTS` for fresh installs
  plus separate `migrateXxx()` functions (checked via `information_schema.columns`, run from
  `initDb()`) for columns added after the table already existed on production — since
  `CREATE TABLE IF NOT EXISTS` doesn't retroactively alter an existing table. Follow this
  exact pattern for any new column (examples: `migrateSRsTable` added `srs.assigned_to`;
  `migrateUsersCanEditDigitization` added `users.can_edit_digitization`). Migrations run
  automatically on backend startup — no manual SQL needed when deploying.

## Auth model

- JWT payload is `{ id, role, full_name, can_edit_digitization }`, signed at login. `req.user`
  in every route handler is this payload, NOT a fresh DB row — `requireRole()` only checks
  `req.user.role` from the token.
- **Staleness is an accepted tradeoff, not a bug**: if an admin changes a user's role or their
  `can_edit_digitization` flag, that user's existing token is stale until they log in again.
  This mirrors how role changes have always worked here — don't "fix" it without discussing
  with the user first, it's a deliberate simplicity choice for a small internal tool.
- Roles: `admin` (full access + user management), `editor` (add/update/close SRs, either
  category), `viewer` (read-only by default). A viewer can be individually flagged
  `can_edit_digitization` by an admin to allow them to create/edit/comment on **Digitization**
  records specifically — Service Requests stay off-limits to them either way. This is enforced
  in `routes/srs.js` via `canWriteCategory(user, category)`, NOT via router-level
  `requireRole()`, because category isn't known until the request body (POST) or the fetched
  row (PUT) is in hand. Close/reopen/delete stay admin-only regardless of this flag.
- Session storage is `sessionStorage`, not `localStorage` — closing the tab logs the user out
  by design (see AuthContext.jsx).

## Known gotchas / conventions (read before touching related code)

- **antd Table pagination — `pageSize` vs `defaultPageSize`**: `pageSize`/`current` are
  *controlled* props antd resyncs from every render. `utils/pagination.js`'s
  `paginationConfig()`/`compactPaginationConfig()` helpers are called fresh inline in JSX
  (unmemoized), so passing a literal `pageSize: N` silently snaps the table back to N on any
  unrelated re-render — this was a real, previously-shipped bug (page-size dropdown looked
  "broken"). Always pass `defaultPageSize`, **unless** the table is genuinely server-side
  controlled with real `current`/`pageSize`/`onChange` wired to component state (the one
  legitimate exception is `SRPage.jsx`'s main table, bound to `pagination.page`/`limit` state).
- **Diffed-update pattern for bulk/derived writes**: any code that sets a field to a fixed
  value as a side effect (e.g. Deloitte-import setting `assigned_to`/`pending_with` to
  `'Deloitte'`) should no-op and skip the history row if the value is already correct — see
  `ensureFieldValue()` / `ensureAssignedToDeloitte()` / `ensurePendingWithDeloitte()` in
  `deloitte-import.js` for the established pattern. Don't write unconditional UPDATEs that
  generate no-op history noise.
- **Deloitte PDF import semantics** (`routes/deloitte-import.js`): any SR appearing in either
  table of the weekly PDF ("Work in Progress" or "Pending with User") gets `assigned_to` set
  to `'Deloitte'`, whether it's an existing SR or newly created from the PDF. Additionally,
  **only "Work in Progress" rows** also get `pending_with` set to `'Deloitte'` (the ticket is
  sitting with them awaiting action) — "Pending with User" rows deliberately leave
  `pending_with` untouched, since those are waiting on the RDC user to respond, not Deloitte.
  The `/parse` endpoint is read-only (matches against live SRs, writes nothing); `/apply` does
  the actual writes inside one transaction. `/parse` also returns a `pageSummary` (per-PDF-page
  classification: which pages were recognized as WIP/Pending/skipped, with row counts) and a
  per-row `needsReview` flag with exact reasons (missing Track token, malformed/multiple ETA,
  or a source ETA before the extracted report period) so the admin can visually verify parser
  coverage rather than trusting it blindly; these rows are excluded from bulk apply. ETA
  accepts named-month, DMY numeric, and ISO forms with UTC-safe validation. The complete trailing Expected Closure cell is separated
  before Comments are derived, preventing prefixes such as `Dev ETA` from entering comment
  history. Surfaced in `UpdateTasks.jsx`'s "Upload Deloitte PDF" tab.
- **SR-number uniqueness / Deloitte duplicate defense**: MySQL's generated
  `active_sr_identity` key enforces one active row per `(category, trimmed sr_number)`; the
  startup migration consolidates legacy active duplicates before adding the unique index.
  Deloitte parsing collapses identical repeated Request IDs. When repeats differ, the row with
  the uniquely highest valid ETA wins; ties at the highest ETA and duplicates with no valid ETA
  remain blocked. `/apply` consolidates again and
  re-reads current rows with `FOR UPDATE`; never trust preview `matched`, `sr_id`, or current
  values as authoritative. ETA parsing is explicit UTC-safe day/month/year parsing and never
  silently changes a source month (for example, `03-Aug-26` remains August).
- **Bundle and interaction performance**: routes are lazy-loaded and prewarmed on idle/hover;
  `xlsx` stays dynamically imported at click time. `services/api.js` coalesces/cache safe reads,
  while live SR list requests pass `AbortSignal` and deliberately bypass coalescing. Keep heavy
  dependencies behind dynamic imports and do not reintroduce WebGL or page-exit animation for
  the data-heavy shell.
- **Table re-render cost**: antd/rc-table treats a new `columns` array reference as "changed"
  and re-renders every visible row. `SRPage.jsx` and `Reports.jsx` memoize their column
  builders (`useMemo`)/callbacks (`useCallback`) for this reason — don't reintroduce an inline
  unmemoized column-builder call in the render body of a table-heavy page.
- **Backend query batching**: prefer `WHERE x IN (...)` + in-memory `Map` lookup over N+1
  per-row queries in any loop that touches the DB (established pattern in `csv-import.js` and
  `deloitte-import.js`'s `matchRows()`). Wrap multi-statement bulk writes in a real transaction
  (`pool.getConnection()` → `beginTransaction()`/`commit()`/`rollback()`/`release()`), not bare
  sequential `pool.execute()` calls.
- **"Updated" must mean something actually changed**: `csv-import.js`'s bulk-update endpoint
  only increments its `updated` counter when `setClauses.length > 0` (a real field differed and
  got written) — re-uploading an unchanged Excel export correctly reports `0 updated`, not one
  per matched row. This was a real bug (fixed), and the same discipline applies anywhere a
  result count is shown to the admin: count outcomes, not just "rows that were looked at."
- **Overdue is category-aware**: "overdue" means `status != 'Closed' AND <due date> < CURDATE()`,
  but the due-date column differs by category — `expected_closure_date` for SR,
  `target_date` for Digitization. Both `routes/srs.js` (`GET /` via `?overdue=true`, and
  `GET /stats/summary`) and `routes/stats.js` (`catStats`, SR-only) compute this server-side;
  never derive "overdue" client-side against the wrong field for Digitization rows.
- **Shared-host runtime budget**: the MySQL pool defaults to five connections and three idle
  connections; tune with `DB_POOL_SIZE`, `DB_POOL_IDLE`, and `DB_POOL_IDLE_TIMEOUT_MS`. The
  Deloitte `pdf-parse` module is intentionally required inside the parse action, not at server
  startup. Production static caching/log filtering depends on `NODE_ENV=production`, which
  `start-all.bat` sets explicitly.
- **Documentation screenshots are always fictional**: capture the real production build against
  a temporary/disposable database, then remove that database immediately. Never publish real SRs,
  user names, operational counts, credentials, logs, or backup contents. The current portfolio
  screenshots live in `docs/images/`; keep README, `docs/FEATURES.md`, and `docs/USER_GUIDE.md`
  aligned when a visible feature changes.

## How changes get verified

Focused backend tests exist, but verification also means exercising the real running app:

1. **Backend**: start via `cd backend && node server.js` (or the launch config). Verify port
   777 is actually listening (`netstat -ano | grep ':777'`) before assuming it's up — in this
   dev environment, background node processes started via `nohup ... & disown` have
   repeatedly died silently between turns; always re-check rather than assume.
2. **Disposable-test-record pattern**: for anything that needs a live user/SR to exercise
   (auth flows, permission checks, PDF import), create throwaway rows directly via a one-off
   `mysql2` script (bcrypt-hash a known password for test users), exercise the real endpoints
   via `fetch` + a real JWT obtained from `/api/auth/login`, verify the response/DB state, then
   hard-delete. Hard-deleting a test user or SR can fail on FK constraints from `sr_history`/
   `sr_comments`/`srs.created_by`/`srs.updated_by` — delete those child rows first (see any
   recent session transcript for the exact cleanup query pattern).
3. **Frontend**: after `npm run build`, use the Browser pane against `http://localhost:777`
   (not the Vite dev server) to match how the app is actually served. Log in with a disposable
   admin test account rather than the real admin credentials found in `db/database.js`'s
   `DEFAULT_ADMIN` (only use those if the user explicitly asks you to use the real seeded
   account).
4. Always clean up disposable users/SRs/uploaded test files after verifying — this project's
   database is the user's real working data, not a sandbox.

## Utility scripts (Windows batch files, project root)

- `start-backend.bat` / `start-frontend.bat` / `start-all.bat` — dev convenience launchers.
- `build.bat` — frontend production build.

## Feature history (why things are shaped this way)

Chronological, most-recent-relevant-first, for context on *why* rather than just *what*:

- **SR uniqueness and deterministic Deloitte duplicate imports** — added a database-enforced active
  SR-number identity, a legacy duplicate consolidation migration, transaction-time rechecks,
  deterministic ETA parsing, highest-ETA duplicate selection, and blocking when dates cannot
  determine one winner.
- **Portfolio-quality documentation** — README now presents the product, architecture,
  integration flows, engineering outcomes, quality gates, and a sanitized product tour.
  `docs/FEATURES.md` inventories the complete feature set and `docs/API_REFERENCE.md` documents
  route groups/authorization. All current screenshots use a temporary fictional database.
- **Low-overhead responsiveness pass** — removed the Three.js/Framer/Axios runtime, kept the
  existing Ant Design visual language, made counters and page switches deterministic, warmed
  route chunks during idle time, cancelled stale SR requests, batched filter metadata, added
  conservative client read caching, deferred the PDF parser, reduced the DB pool, improved
  production asset caching/logging, and added a complete RDC favicon set.
- **Update-only ManageEngine Cloud synchronization** — `services/manageengine-sync.js` refreshes
  OAuth access tokens and updates existing SRs every 30 minutes (plus an optional startup run).
  It matches local `sr_number` against ManageEngine `display_id` and never creates local SRs;
  users explicitly add the requests that require tracking before the integration can update them.
  Untracked and soft-deleted requests are ignored, descriptions are never overwritten, and
  not-found local records stay unchanged. Pending side comes from the official `unreplied_count` field
  (>0 = Technician, 0 = User), with explicit pending statuses taking precedence. Technician-side
  work uses local status `Pending` and the exact Assigned To name in `pending_with`; user-side
  work uses `Pending with User` for both. `Closed` and `On Hold` remain authoritative. Exact source
  timestamps and the raw source status are stored in `manageengine_*` columns; real field
  changes are written to `sr_history` with a null system actor. Credentials and the offline
  refresh token live only in `backend/.env`.
- **Proper dashboarding stat tiles + Overdue** — `SRPage.jsx`'s stat-tile row was replaced from
  a partial 4-tile set (Total/Open/On Hold/Closed) to a full 8-tile breakdown covering every
  status (Open, In Progress, Pending, Pending with User, On Hold, Closed) plus Total and
  Overdue — the old set was silently hiding whole status buckets from view (e.g. an entire
  "Pending with User" caseload had zero tile representation, only inferable by subtracting the
  other three tiles from Total). Each tile is clickable to filter, color-matched to that
  status's `Tag` color in the table below. `DashboardHome.jsx` gained a matching Overdue tile
  (Overdue was previously buried as a column-only figure in the per-person breakdown table).
  Required new backend support: `overdue=true` on `GET /srs`, plus an `overdue` field on both
  `GET /srs/stats/summary` and `GET /stats/dashboard` — see the category-aware gotcha above.
- **Full application count/figure audit** — every dashboard/stat/report figure in the app was
  cross-verified against live ground-truth SQL (Dashboard tiles, Pending-With breakdown
  including per-person On Hold/Overdue/Added/Closed columns, SR/Digitization stat tiles for
  both categories, Reports' Assigned-to-Deloitte ECD sequences, User Management counts). Found
  and fixed one real bug in the process (the `csv-import.js` "Updated" counter, see gotcha
  above); everything else matched exactly. Also identified (not a bug, a UX clarification) that
  the old "Total" tile counting Closed rows while the table hid them by default could look like
  a mismatch — resolved by the tile redesign above rather than by hiding the discrepancy.
- **Viewer Digitization-edit permission** — `users.can_edit_digitization` column + User
  Management checkbox (shown only when role is Viewer) + category-aware backend
  authorization. Lets an admin grant one specific viewer edit rights over Digitization
  Projects without promoting them to full editor.
- **Deloitte PDF import trust/transparency** — page-by-page classification summary and
  per-row `needsReview` flagging added to `/parse`'s response, surfaced in the upload UI, so
  the admin isn't just trusting the parser blindly.
- **Pending With = Deloitte for WIP rows** — the PDF importer was setting `assigned_to` but
  not `pending_with` for Work in Progress rows; fixed so both reflect that the ticket is
  sitting with Deloitte.
- **Full-codebase optimization pass** — backend N+1 query fixes, transaction wrapping,
  frontend `useMemo`/`useCallback` re-render fixes, route-level lazy-loading + dynamic
  `xlsx` import (cut main JS bundle ~68%), dead-code removal. Zero schema changes, zero
  intended behavior change — pure performance/cleanup.
  Also fixed elsewhere in this pass: the antd `pageSize`/`defaultPageSize` pagination bug
  (see gotcha above) and a Dashboard bug where "Pending With" listed people with zero
  *current* pending SRs (fixed the `HAVING` clause in `stats.js`).
- **Dashboard refinements** — SR/Digitization list pages default to active-only (closed SRs
  hidden by default, with status stat-tiles still shown up top); the Dashboard home screen's
  "Total Closed"/"Closed Last Week" tiles removed entirely (that screen is meant to show only
  what's open); auto-refresh after closing an SR; the "(Unassigned)" Pending-With row made
  clickable so blank-Pending-With SRs can be found and fixed.
- **Reports page / Assigned-to-Deloitte tracking** — `srs.assigned_to` column,
  `routes/reports.js`'s ECD-history report, wheel-scroll fixed to only pan horizontally on
  Shift+wheel (was hijacking normal vertical page scroll).
- **Login-page input stutter fix** — `GreenMonster.jsx`'s caret-tracking mirror-div was doing
  a full computed-style rebuild + forced synchronous layout on every keystroke; fixed by
  caching a single reused mirror element and copying only the ~11 CSS properties that affect
  text-width metrics.
- **"Upload Deloitte PDF"** lives as a second tab inside **Update Tasks** (not a separate
  Reports sub-panel) — this was a deliberate placement correction from the user.
- **Excel-based bulk update ("Update Tasks")** — diffed field-by-field: only actually-changed
  fields get written/logged; comments always append (never dedupe/overwrite).

## Where to go for more detail

- `graphify-out/GRAPH_REPORT.md` and the graphify query tools — see `AGENTS.md` for the
  exact protocol (query/path/explain before falling back to broad file reads).
- This file plus `AGENTS.md` are the two canonical agent-facing docs for this project — keep
  both updated together when either changes materially.
