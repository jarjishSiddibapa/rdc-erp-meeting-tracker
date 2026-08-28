# User guide

This guide explains the screens and the figures shown in the RDC ERP Meeting Tracker.

## Dashboard

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

Use the left navigation to switch between the two record categories. Both use the same underlying `srs` table, but Digitization Projects have their own category-specific fields and permissions.

- Filter by status, owner, assignment, dates, and other available metadata.
- Select a row to view details, field history, and comments.
- Editors can create and update records they are allowed to edit.
- Closing, reopening, and deleting are administrator actions. Deletes are soft deletes.

## Roles and permissions

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

The **Upload Deloitte PDF** tab parses the weekly report first. Review the page and row classifications before applying the changes. The **Update from ManageEngine** tab follows the same parse-then-apply pattern for CSV exports.

## Reports and backups

- **Reports** provides the Assigned-to-Deloitte/ECD-history view.
- **Backup Settings** shows the backup schedule and history, allows an administrator to run a backup, and provides controlled download/delete actions.
- Password reset emails require the SMTP settings in `backend/.env`.
