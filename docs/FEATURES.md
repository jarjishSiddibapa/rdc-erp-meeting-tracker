# Feature reference

This document is the complete product capability inventory for RDC Digitization Review. For
day-to-day instructions, see the [user guide](USER_GUIDE.md). For implementation details, see
the [architecture guide](ARCHITECTURE.md).

## Dashboard and operational visibility

- Current SR totals for all records, pending, overdue, added in seven days, and closed in seven days.
- Adjacent rolling seven-day comparison for pending workload, new SRs, and closures.
- Workload table grouped by `Pending With`, including current pending, on hold, overdue,
  seven-day additions/closures, and percentage share.
- Click-through from an owner or `(Unassigned)` workload to the matching Service Request view.
- Formula tooltips on every metric and table figure.
- Server-side date boundaries and historical status reconstruction for trustworthy comparisons.

## Service Requests

![Service Requests](images/service-requests.png)

- Status model: Open, In Progress, Pending, On Hold, Pending with User, and Closed.
- Separate visual tiles for every status plus overdue; selecting a tile filters the table.
- Server-controlled pagination, sorting, search, column filters, resizable columns, and Excel export.
- Fields for scope, assignment, pending owner, requester, creation date, expected closure,
  category/type, comments, and source-system timestamps.
- Detail view with editing, comment timeline, and field-level change history.
- Administrator controls for close, reopen, and soft delete.
- Manual **Sync SRs from ManageEngine** action that refreshes the table, totals, and filter choices.

## Digitization Projects

![Digitization Projects](images/digitization-projects.png)

- Uses the same reliable record/history engine with category-specific project fields.
- Project name, process owner, pending owner, creation date, target date, comments, and status.
- Category-aware overdue calculation based on Target Date.
- Dedicated viewer permission that grants Digitization editing without granting SR editing.
- Export, filtering, search, status tiles, details, comments, and history.

## ManageEngine ServiceDesk Plus Cloud

- OAuth refresh-token integration with configurable Zoho data-center and portal values.
- Scheduled synchronization every 30 minutes, optional startup run, and guarded manual run.
- Existing local SRs matched to ManageEngine `display_id`.
- Strict update-only behavior: an SR must already exist locally before ManageEngine can change it.
- Untracked remote requests are ignored, regardless of category or status.
- Source status, exact created/closed timestamps, requester, category, and technician mapping.
- Pending side derived from official `unreplied_count`, with explicit pending statuses taking precedence.
- Technician-side work shows Status `Pending` and Pending With as the Assigned To technician;
  user-side work shows `Pending with User` in both fields.
- `Deloitte ERP Support` classified as External; other technicians classified as Internal.
- Missing remote requests remain unchanged and soft-deleted records are never recreated.
- Per-run counts for scanned, matched, updated, unchanged, missing, and errors.
- Update-only CSV parse/apply fallback when API synchronization is unavailable.

## Update Tasks

![Update Tasks](images/update-tasks.png)

### Excel round trip

- Download one workbook with Service Requests and Digitization Projects on separate sheets.
- Add new rows or modify existing rows, then upload the same workbook.
- Match existing records by SR number and update only populated, changed fields.
- Blank cells do not erase local values.
- Comments append rather than overwrite or deduplicate earlier discussion.
- Batched lookups, transactional writes, and accurate imported/updated/skipped counts.

### Deloitte weekly PDF

- Memory-backed PDF upload with a review-only parse stage.
- Per-page classification summary for Work in Progress, Pending with User, and skipped pages.
- Row-level matching and explicit review reasons for missing Track delimiters, malformed or
  multiple ETA values, and ETA dates earlier than the report period read from the cover.
- Suspicious rows fail closed: they remain visible in preview but are excluded from bulk apply.
- Deterministic UTC-safe parsing supports named-month, DMY numeric, and ISO dates and keeps
  `03-Aug-26` as `03-Aug-2026`—the importer never silently changes the source month.
- The complete Expected Closure cell is separated from Comments, so prefixes such as
  `Dev ETA` / `Analysis ETA` and suffixes such as `Dependent on SR` do not pollute comments.
- Identical repeated Request IDs collapse to one operation. When repeats differ, the row with
  the uniquely highest valid Expected Closure Date is kept and older variants are shown in the
  preview. Highest-date ties and duplicates without a valid ETA remain blocked.
- Apply re-reads current SRs inside its transaction, while a MySQL unique guard guarantees one
  active record for each category/SR-number pair.
- Admin confirmation before one transactional apply.
- Deloitte assignment applied consistently; WIP also sets Pending With to Deloitte.

### ManageEngine administration

- Configuration status and latest run details.
- Immediate guarded sync using the same service as the scheduler.
- Visible outcome counts without exposing OAuth credentials.

## Reports

![Reports](images/reports.png)

- Assigned-to-Deloitte report with SR number, creation date, current status, and latest comment.
- Full Expected Closure Date sequence reconstructed from audit history.
- Accurate revision count that excludes the initial first-time date assignment.
- Dynamic ECD columns, pagination, refresh, direct SR details, and Excel export.

## Users, authentication, and permissions

![User Management](images/user-management.png)

- Email/password login with bcrypt password hashes and signed JWTs.
- Session-scoped browser storage: closing the tab ends the local session by design.
- Admin, editor, and viewer roles.
- Optional `can_edit_digitization` permission for a viewer.
- Individual user creation, Excel-based bulk creation, activation/deactivation, and role editing.
- Change-password plus time-limited, single-use password reset links through SMTP.
- Authentication rate limiting and generic reset responses to avoid account discovery.

## Backup and production operations

![Backup Settings](images/backup-settings.png)

- Configurable automatic daily MySQL backup schedule.
- On-demand backup with visible completion status.
- Backup history, file size, trigger source, timestamps, controlled download, and deletion.
- Safe generated-filename allowlist for download/delete routes.
- Health endpoint, graceful shutdown, runtime heartbeat/crash logging, and startup diagnostics.
- Windows Task Scheduler runbook with restart-on-failure and production build/update scripts.

## Data integrity and audit behavior

- One category-aware `srs` table backed by comments and field-level history.
- Soft deletion for operational records and users.
- Diff-only writes: unchanged fields never create false audit events.
- Additive startup migrations for existing production databases.
- Multi-statement bulk operations use explicit transactions.
- Category-aware authorization enforced on the backend, not only hidden in the UI.

## Performance and UX

- Lazy routes, idle/hover prefetch, and click-time Excel loading.
- Native Fetch wrapper with active-request tracking, safe read coalescing, short metadata cache,
  and mutation invalidation.
- Abortable live table requests and debounced automatic search.
- Memoized table columns and batched filter metadata.
- Lazy PDF parser to reduce normal server memory.
- Conservative, configurable MySQL pool for a shared server.
- Immutable caching for hashed assets and low-noise production request logging.
- Responsive navigation, mobile modal safety, reduced-motion support, and consistent loading feedback.
