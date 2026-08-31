## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

---

## Project Knowledge

Everything below is duplicated in `CLAUDE.md` at the project root (Claude Code reads that file
automatically; other agents may only load this one, hence the duplication — keep both in sync
when either changes materially).

### What this is

Internal ERP tool for RDC Concrete. Tracks two record types through one unified system:
**Service Requests (SR)** and **Digitization Projects** — plus a weekly workflow for
importing Deloitte's status-report PDF and keeping SRs synced against it. Small-to-medium
scale (tens–low hundreds of records, a handful of concurrent users), not internet-scale —
weigh any performance/architecture decision against that reality, not hypothetical scale.

Not a git repository. No automated test suite — all verification happens by exercising the
real running app (see "How changes get verified" below).

### Stack

- **Backend**: Node.js + Express 5, MySQL via `mysql2/promise` (connection pool, no ORM).
  JWT auth (`jsonwebtoken`), `bcryptjs` for passwords, `multer` for uploads, `node-cron` for
  scheduled backups, `nodemailer` for email, `pdf-parse` v2.x for the Deloitte PDF importer.
- **Frontend**: React 19 + Vite 8 + antd v6. `axios` for API calls, `dayjs` for dates,
  `framer-motion` + `three`/`@react-three/fiber` for the login page's animated mascot scene,
  `xlsx` for Excel import/export (dynamically imported at click-time, not bundled eagerly).
- **Hosting**: single-port. The backend (port 777) serves the built frontend
  (`frontend/dist`, via `express.static`) AND the API from the same origin. `frontend/dist`
  must be rebuilt (`npm run build` inside `frontend/`) and the backend restarted for frontend
  changes to appear at `http://localhost:777`.

### Repo layout

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
                                CommentCell.jsx, ClosureDateCell.jsx, LoginScene.jsx (3D mascot)
  components/ui/            — small reusable UI primitives (BrandButton, Reveal, TiltCard, ...)
  services/api.js           — axios wrapper, one *API object per route group
  utils/pagination.js        — shared antd Table pagination config (see gotcha below)
  utils/excelIO.js, exportExcel.js — xlsx read/write helpers, dynamically imported
```

### Data model essentials

- **One table, two categories**: `srs.category` is `'SR'` or `'Digitization'` — same table,
  same routes (`routes/srs.js`), different field sets used per category. Always check
  `category` before assuming which fields are meaningful.
- **Soft delete everywhere**: `is_deleted` flag, never a real `DELETE` on `srs` or `users` in
  normal app flow. `sr_history`/`sr_comments` have FK constraints back to `users.id` and
  `srs.id` — matters when hard-deleting disposable test data.
- **`sr_history`**: every field change is logged, diffed (only when the value actually
  changes). Any code path that changes a field should follow this pattern.
- **Schema migrations**: `db/database.js` uses `CREATE TABLE IF NOT EXISTS` for fresh installs
  plus separate `migrateXxx()` functions (checked via `information_schema.columns`, run from
  `initDb()`) for columns added after the table already existed on production. Follow this
  exact pattern for any new column. Migrations run automatically on backend startup.

### Auth model

- JWT payload is `{ id, role, full_name, can_edit_digitization }` — `req.user` in route
  handlers is this payload, NOT a fresh DB row. `requireRole()` only checks `req.user.role`.
- **Staleness is accepted, not a bug**: role/permission changes require the user to re-login
  before they take effect. Deliberate simplicity choice — don't "fix" without discussing first.
- Roles: `admin`, `editor`, `viewer`. A viewer can be individually flagged
  `can_edit_digitization` to create/edit/comment on Digitization records specifically (SRs
  stay off-limits). Enforced via `canWriteCategory(user, category)` in `routes/srs.js`, not
  router-level `requireRole()`, since category isn't known until the body/row is in hand.
  Close/reopen/delete stay admin-only regardless.
- Session storage is `sessionStorage`, not `localStorage` — closing the tab logs out by design.

### Known gotchas / conventions

- **antd Table pagination — `pageSize` vs `defaultPageSize`**: `pageSize`/`current` are
  controlled props antd resyncs every render. `utils/pagination.js`'s helpers are called
  fresh inline in JSX (unmemoized), so a literal `pageSize: N` silently snaps back on any
  re-render — a real, previously-shipped bug. Always pass `defaultPageSize` unless the table
  is genuinely server-controlled with real `current`/`pageSize`/`onChange` state (only
  legitimate exception: `SRPage.jsx`'s main table).
- **Diffed-update pattern**: any code setting a field to a fixed value as a side effect
  should no-op (skip the history row) if already correct — see `ensureFieldValue()` in
  `deloitte-import.js`.
- **Deloitte PDF import semantics**: any SR in either PDF table ("Work in Progress" or
  "Pending with User") gets `assigned_to = 'Deloitte'`. Only "Work in Progress" rows also get
  `pending_with = 'Deloitte'` — "Pending with User" rows leave `pending_with` untouched (those
  wait on the RDC user, not Deloitte). `/parse` is read-only; `/apply` writes in one
  transaction. `/parse` returns a `pageSummary` (per-page classification) and per-row
  `needsReview` flag so the admin can verify parser coverage.
- **Bundle size**: heavy deps (`xlsx`, lazy routes) are dynamic-imported at click/route time,
  not bundled eagerly — keep new heavy dependencies behind the same pattern.
- **Table re-render cost**: antd/rc-table treats a new `columns` array reference as changed —
  memoize column builders (`useMemo`/`useCallback`) in table-heavy pages.
- **Backend query batching**: prefer `WHERE x IN (...)` + in-memory `Map` lookup over N+1
  per-row queries. Wrap multi-statement bulk writes in a real transaction.
- **"Updated" must mean something actually changed**: `csv-import.js`'s bulk-update endpoint
  only increments `updated` when a field genuinely differed and got written — a re-upload of
  an unchanged export reports `0 updated`, not one per matched row (this was a real, fixed bug;
  the same discipline applies to any result count shown to the admin).
- **Overdue is category-aware**: `status != 'Closed' AND <due date> < CURDATE()`, but the due
  date column differs — `expected_closure_date` for SR, `target_date` for Digitization. Both
  `routes/srs.js` (`GET /` via `?overdue=true`, `GET /stats/summary`) and `routes/stats.js`
  (`catStats`, SR-only) compute this server-side; never derive it client-side against the
  wrong field for Digitization.
- **This dev sandbox's Browser pane stalls `requestAnimationFrame` when not actively
  displayed/composited** (confirmed via a direct rAF probe timing out). Causes two non-bugs to
  watch for when verifying UI here: `AnimatedCounter.jsx` (DashboardHome's StatCards) sticks at
  `0` instead of animating up, and `Dashboard.jsx`'s `AnimatePresence` page-transition exit
  never completes, so the previous page's DOM can stay stacked under the new one — text reads
  can return both pages concatenated, and a naive element query can click a stale element from
  the old page. Trust a direct API fetch and non-animated DOM state over anything animated;
  scope queries narrowly (e.g. to a container with text unique to the target page) rather than
  assuming the app is broken when a click "does nothing."

### How changes get verified

No automated test suite — verification means exercising the real running app:

1. Start the backend (`cd backend && node server.js`), confirm port 777 is actually listening
   before assuming it's up.
2. **Disposable-test-record pattern**: create throwaway users/SRs directly via a one-off
   `mysql2` script, exercise real endpoints via `fetch` + a real JWT from `/api/auth/login`,
   verify, then hard-delete (clean up `sr_history`/`sr_comments` FK references first).
3. Frontend: after `npm run build`, verify against `http://localhost:777` (not the Vite dev
   server) to match production serving. Use a disposable admin test account, not the real
   seeded `DEFAULT_ADMIN` credentials in `db/database.js`, unless explicitly asked to.
4. Always clean up disposable test data afterward — this is the user's real working database.

### Feature history (why things are shaped this way)

Most-recent-relevant-first:

- **Automatic ManageEngine Cloud synchronization** — `services/manageengine-sync.js` refreshes
  OAuth access tokens and updates existing SRs every 30 minutes (plus an optional startup run).
  It matches local `sr_number` against ManageEngine `display_id`, never creates missing SRs,
  never overwrites descriptions, and leaves not-found records unchanged. Pending side comes
  from the official `unreplied_count` field (>0 = Technician, 0 = User), with explicit pending
  statuses taking precedence. Exact source timestamps and the raw source status are stored in
  `manageengine_*` columns; real field changes are written to `sr_history` with a null system
  actor. Credentials and the offline refresh token live only in `backend/.env`.
- **Proper dashboarding stat tiles + Overdue** — `SRPage.jsx`'s stat-tile row went from a
  partial 4-tile set (Total/Open/On Hold/Closed) to a full 8-tile breakdown (Total + every
  status + Overdue) — the old set silently hid whole status buckets (e.g. a "Pending with
  User" caseload had zero tile of its own). Each tile filters on click and color-matches its
  status `Tag`. `DashboardHome.jsx` gained a matching Overdue tile. Needed new backend support:
  `overdue=true` on `GET /srs`, plus `overdue` on `GET /srs/stats/summary` and
  `GET /stats/dashboard` (category-aware, see gotcha above).
- **Full application count/figure audit** — every dashboard/stat/report figure cross-verified
  against live ground-truth SQL; found and fixed one real bug (`csv-import.js`'s Updated
  counter, see gotcha above), everything else matched exactly.
- **Viewer Digitization-edit permission** — `users.can_edit_digitization` + category-aware
  backend authorization, lets an admin grant one viewer edit rights over Digitization only.
- **Deloitte PDF import trust/transparency** — page-by-page classification summary + per-row
  `needsReview` flagging in `/parse`, so the admin isn't trusting the parser blindly.
- **Pending With = Deloitte for WIP rows** — the importer set `assigned_to` but not
  `pending_with` for Work in Progress rows; fixed so both reflect reality.
- **Full-codebase optimization pass** — backend N+1/transaction fixes, frontend
  `useMemo`/`useCallback` fixes, lazy-loading + dynamic `xlsx` import (~68% bundle cut),
  dead-code removal. Also fixed here: the pagination `pageSize` bug, and a Dashboard bug
  showing "Pending With" people with zero *current* pending SRs.
- **Dashboard refinements** — SR/Digitization lists default to active-only; home screen's
  Closed tiles removed; auto-refresh after closing an SR; "(Unassigned)" made clickable.
- **Reports page / Assigned-to-Deloitte tracking** — `srs.assigned_to` column, ECD-history
  report, wheel-scroll fixed to only pan horizontally on Shift+wheel.
- **Login-page input stutter fix** — mirror-div caret tracking was forcing synchronous
  layout every keystroke; fixed with a cached, minimal-property mirror element.
- **"Upload Deloitte PDF"** lives inside **Update Tasks** as a second tab, not a Reports
  sub-panel — deliberate placement correction from the user.
- **Excel-based bulk update ("Update Tasks")** — diffed field-by-field; comments always
  append, never dedupe/overwrite.
