# API reference

The production API is served from the same origin as the frontend under `/api`. Except for the
health and public authentication lifecycle endpoints, send a JWT in:

```http
Authorization: Bearer <token>
```

Successful JSON responses use the natural resource shape for the endpoint. Errors use:

```json
{ "message": "Human-readable explanation" }
```

## Authentication

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Public, rate limited | Authenticate with email/password and return JWT plus user |
| `GET` | `/api/auth/me` | Authenticated | Return the current token identity |
| `POST` | `/api/auth/change-password` | Authenticated | Verify current password and set a new one |
| `POST` | `/api/auth/forgot-password` | Public, rate limited | Request a generic password-reset response |
| `POST` | `/api/auth/reset-password` | Public, rate limited | Consume a time-limited reset token |

## Service Requests and Digitization Projects

Both record categories share `/api/srs`; use `category=SR` or `category=Digitization`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/srs` | Authenticated | Paginated/filterable record list |
| `GET` | `/api/srs/:id` | Authenticated | Record, comments, and history |
| `POST` | `/api/srs` | Category write permission | Create a record |
| `PUT` | `/api/srs/:id` | Category write permission | Diff and update a record |
| `POST` | `/api/srs/:id/comments` | Category write permission | Append a comment |
| `POST` | `/api/srs/:id/close` | Admin | Close a record |
| `POST` | `/api/srs/:id/reopen` | Admin | Reopen a record |
| `DELETE` | `/api/srs/:id` | Admin | Soft-delete a record |
| `GET` | `/api/srs/stats/summary` | Authenticated | Category/status summary for tiles |
| `GET` | `/api/srs/meta/options` | Authenticated | Batched filter choices |
| `GET` | `/api/srs/meta/distinct` | Authenticated | Allowed distinct field values |

Important list parameters include `category`, `page`, `limit`, `status`, `scope`, `type`,
`pendingWith`, `assignedTo`, `search`, `excludeClosed`, `overdue`, `sortField`, and `sortOrder`.
The response is:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

## Dashboard and reports

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/stats/dashboard` | Authenticated | Current SR KPIs, rolling periods, and pending-owner workload |
| `GET` | `/api/reports/assigned-to-ecd` | Authenticated | Expected Closure Date sequence by assignment/category |

`/api/reports/assigned-to-ecd` requires `assignedTo` and accepts `category` (default `SR`).

## Users

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/users` | Admin | List active/non-deleted users |
| `POST` | `/api/users` | Admin | Create one user |
| `POST` | `/api/users/bulk` | Admin | Validate and create users in bulk |
| `PUT` | `/api/users/:id` | Admin | Update identity, role, status, or Digitization permission |

## Imports and synchronization

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/csv-import/execute` | Admin or editor | Transactional SR/Digitization bulk create/update |
| `POST` | `/api/deloitte-import/parse` | Admin | Read-only PDF parse and match preview |
| `POST` | `/api/deloitte-import/apply` | Admin | Apply reviewed Deloitte rows transactionally |
| `GET` | `/api/manageengine-import/sync-status` | Admin | Configuration and latest run state |
| `POST` | `/api/manageengine-import/sync-now` | Admin | Start the guarded API synchronization |
| `POST` | `/api/manageengine-import/parse` | Admin | Parse ManageEngine CSV fallback |
| `POST` | `/api/manageengine-import/apply` | Admin | Close reviewed, already-tracked CSV fallback rows; untracked rows are rejected by design |

PDF and CSV parse endpoints use multipart uploads. Apply endpoints accept the reviewed JSON
result, keeping inspection separate from mutation.

## Backups

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/backup/settings` | Admin | Read schedule |
| `PUT` | `/api/backup/settings` | Admin | Update and reschedule |
| `POST` | `/api/backup/run-now` | Admin | Run `mysqldump` immediately |
| `GET` | `/api/backup/history` | Admin | List backup outcomes |
| `GET` | `/api/backup/download/:filename` | Admin | Download an allowlisted server-generated file |
| `DELETE` | `/api/backup/:filename` | Admin | Remove an allowlisted backup file and soft-delete history |

## Health

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Process and deployment health check |

The health route is intentionally lightweight and excluded from routine production request logs.

## Authorization summary

| Actor | SRs | Digitization | Admin surfaces |
| --- | --- | --- | --- |
| Admin | Full | Full | Users, imports, sync, backups, close/reopen/delete |
| Editor | Create/edit/comment | Create/edit/comment | No admin navigation; bulk execute is backend-authorized |
| Viewer | Read | Read, or edit/comment when explicitly granted | None |

Authorization is checked in Express even when the corresponding frontend control is hidden.
