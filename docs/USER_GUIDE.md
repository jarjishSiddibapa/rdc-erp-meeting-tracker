# User guide

This guide explains the screens, figures, and daily workflows in RDC Digitization Review.
For the exhaustive capability inventory, see the [feature reference](FEATURES.md).

All screenshots use fictional demo records captured from the current production build.

## Recommended daily workflow

1. Open **Dashboard** and review Pending Now, Overdue Now, and workload share.
2. Select an owner or `(Unassigned)` to open the matching Service Requests.
3. Use the status tiles and filters to focus the list; open an SR number for history/comments.
4. Run **Sync SRs from ManageEngine** when an immediate refresh is needed between scheduled runs.
5. Use **Reports** for Deloitte Expected Closure Date movement and **Update Tasks** for controlled bulk work.

## Dashboard

![Dashboard overview](images/dashboard-overview.png)

The dashboard is designed for a quick current-state read:

- **Total SRs** — all non-deleted Service Requests, open or closed.
- **Pending Now** — every SR whose status is not `Closed`.
- **Overdue Now** — a non-closed SR whose Expected Closure Date is before today.
- **Added (7 Days)** — SRs raised in the current rolling seven-day window.
- **Closed (7 Days)** — SRs closed in the current rolling seven-day window.

The compact comparison row keeps historical context without repeating it in every table cell:

- **Pending workload:** start-of-period snapshot → now.
- **SRs added:** previous seven-day window → current seven-day window.
- **SRs closed:** previous seven-day window → current seven-day window.

Hover an information icon to see the exact formula. The row beneath the comparison title shows the two date ranges used by the calculation.

The table is the current workload by **Pending With**. It shows one current number per column: Pending Now, On Hold, Overdue, Added (7d), Closed (7d), and the person's share of the current pending workload. Historical-only owners are intentionally omitted from this current-workload table; their totals remain in the comparison row.

## Service Requests and Digitization Projects

| Service Requests | Digitization Projects |
| --- | --- |
| ![Service Requests](images/service-requests.png) | ![Digitization Projects](images/digitization-projects.png) |

Use the left navigation to switch between the two record categories. Both use the same underlying `srs` table, but Digitization Projects have their own category-specific fields and permissions.

- Filter by status, owner, assignment, dates, and other available metadata.
- Select a row to view details, field history, and comments.
- Select a status tile to use it as a filter. The Overdue tile uses the correct category date.
- Use **Export Excel** for a filtered/current data export.
- Editors can create and update records they are allowed to edit.
- Closing, reopening, and deleting are administrator actions. Deletes are soft deletes.

## Roles and permissions

![User management](images/user-management.png)

| Role | Access |
| --- | --- |
| Admin | Full administration, user management, imports, backups, and close/reopen/delete actions |
| Editor | Create and edit records, comments, and normal operational workflows |
| Viewer | Read-only access; an admin can optionally grant a viewer permission to edit Digitization Projects only |

Role or permission changes take effect after the user signs in again because permissions are carried in the login token.

## Update Tasks

![Update Tasks workflow](images/update-tasks.png)

The **Update Task Data** tab provides a controlled round trip:

1. Download the current workbook. It contains separate `Service Requests` and `Digitization Projects` sheets.
2. Edit existing rows or add new rows in Excel.
3. Upload the same workbook. Existing rows are matched by `Sr No`; changed fields are updated and logged, while blank cells leave existing values untouched.

Comments are appended rather than replacing earlier comments. An unchanged re-upload reports zero updated rows.

The **Upload Deloitte PDF** tab parses the weekly report first. Review the report period, page classifications, row counts, and any row marked **Review - skipped** before applying. Hover the parsed Expected Closure Date to see the exact source-cell text. Dates are read exactly as written—`03-Aug-26` is August 3 and is never silently changed to September. Named-month, DMY numeric, and ISO date formats are supported and calendar-validated. A malformed/multiple ETA, missing Track delimiter, or ETA earlier than the report period gets an explicit review reason and is excluded from bulk apply. Identical repeated Request IDs are collapsed automatically. When the same Request ID appears with different dates, the row with the uniquely highest valid Expected Closure Date is kept and the older variants are shown in preview. If the highest date is tied or no valid date can rank the duplicates, the SR is shown as **Conflict - skipped** and cannot be applied until it is verified manually. The **Update from ManageEngine** tab shows the automatic API sync state and its latest counts; administrators can also run it immediately. Each API sync refreshes only SR numbers already present in this tracker. Untracked ManageEngine requests are ignored, regardless of category or status. For quicker access, administrators can use **Sync SRs from ManageEngine** directly on the Service Requests page; the table, status tiles, and filter choices refresh when the sync completes. The CSV parse-and-apply workflow remains available as an update-only manual fallback.

## Reports and backups

| Delivery reporting | Backup operations |
| --- | --- |
| ![Assigned-to-Deloitte report](images/reports.png) | ![Backup settings](images/backup-settings.png) |

- **Reports** provides the Assigned-to-Deloitte/ECD-history view. Each ECD column is one real
  date the SR held; Changes counts revisions after the initial value.
- **Backup Settings** shows the backup schedule and history, allows an administrator to run a
  backup, and provides controlled download/delete actions.
- Password reset emails require the SMTP settings in `backend/.env`.

## Loading and refresh behavior

Fast cached interactions do not flash a loading screen. When a request takes long enough to be
noticeable, the application shows the shared loading indicator. Searching after five characters
is debounced, and changing a filter cancels obsolete table requests so older data cannot replace
the latest result.
