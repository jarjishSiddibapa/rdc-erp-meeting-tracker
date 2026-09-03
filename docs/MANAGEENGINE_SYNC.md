# ManageEngine API synchronization

The application refreshes existing Service Requests from ManageEngine ServiceDesk Plus Cloud every 30 minutes. Synchronization is strictly update-only: a matching SR number must already exist in this tracker before ManageEngine can change it. Untracked remote requests are ignored regardless of category or status, and local descriptions are never overwritten.

## Fields synchronized

| Local field | ManageEngine source |
| --- | --- |
| Status | `Closed`/`On Hold` stay authoritative; otherwise the pending side becomes `Pending` or `Pending with User` |
| Creation date and exact time | `created_time` |
| Closed date and exact time | `completed_time` |
| Created By | `created_by.name`, falling back to `requester.name` |
| Type | `category.name` |
| Assigned To | `technician.name` |
| Internal / External | External only when the technician is `Deloitte ERP Support`; Internal otherwise |
| Pending Side | User or Technician |
| Pending With | The Assigned To technician name when waiting on the technician; literal `Pending with User` when waiting on the user |

Pending Side uses ManageEngine's `unreplied_count`: a value greater than zero means the technician has requester replies awaiting a response, so local Status is `Pending` and Pending With uses the exact Assigned To technician name. Zero means the technician replied last, so local Status and Pending With both show `Pending with User`. An explicit ManageEngine status such as `Pending with User` takes precedence. `Closed` and `On Hold` remain authoritative workflow statuses; closed tickets have no pending side.

Every changed field receives an `sr_history` entry with a blank actor, identifying it as a system update. Unchanged SRs only receive a new `manageengine_last_synced_at` timestamp. Missing remote tickets are left unchanged; absence is never interpreted as closure.

Matching uses the local `sr_number` against ManageEngine `display_id` (with the remote internal ID accepted as a fallback lookup key). Soft-deleted SRs are excluded and remain untouched. The assigned technician name is stored exactly as ManageEngine returns it. `Deloitte ERP Support` is classified as External; every other technician is classified as Internal.

## OAuth setup

Use the Zoho data center matching the API Console where the client was created. For `api-console.zoho.com`, use `https://accounts.zoho.com`. Other regions use their matching accounts domain.

Generate an authorization code with:

- scope `SDPOnDemand.requests.READ`
- offline access / refresh token enabled
- consent prompt enabled when regenerating a refresh token

Authorization codes are single-use and expire in about two minutes. Immediately place the new code and client credentials in the production machine's untracked `backend/.env`:

```dotenv
MANAGEENGINE_CLIENT_ID=your-client-id
MANAGEENGINE_CLIENT_SECRET=your-client-secret
MANAGEENGINE_AUTH_CODE=the-new-short-lived-code
MANAGEENGINE_ACCOUNTS_URL=https://accounts.zoho.com
```

Then exchange it from the repository root:

```powershell
npm run manageengine:exchange-code --prefix backend
```

The command stores the refresh token directly in the git-ignored `backend/.env`, removes the short-lived authorization code, and never prints the refresh token. Then configure:

```dotenv
MANAGEENGINE_SYNC_ENABLED=true
MANAGEENGINE_SYNC_INTERVAL_MINUTES=30
MANAGEENGINE_SYNC_RUN_ON_START=true
MANAGEENGINE_REFRESH_TOKEN=your-refresh-token
MANAGEENGINE_API_DOMAIN=https://sdpondemand.manageengine.com
MANAGEENGINE_PORTAL=
MANAGEENGINE_EXTERNAL_TECHNICIAN=Deloitte ERP Support
MANAGEENGINE_TIME_ZONE=Asia/Kolkata
```

The exchange script maps the Zoho Accounts region to the matching ServiceDesk Plus product API domain; it deliberately does not use Zoho's generic `www.zohoapis.com` OAuth response as the request endpoint. `MANAGEENGINE_PORTAL` is needed only when the ServiceDesk URL contains `/app/<portal>/`; enter the `<portal>` segment shown in ESM Directory → Service Desk Instances. Override `MANAGEENGINE_API_DOMAIN` only for a custom or different regional service domain.

Restart `start-all.bat` after changing `.env`. Open **Update Tasks → Update from ManageEngine** to see configuration status and the latest run. Administrators can start the same guarded synchronization either with **Sync now** there or with **Sync SRs from ManageEngine** on the Service Requests page.

## Production checks

1. Back up MySQL.
2. Run `update-production.bat` or pull, run `build.bat`, and restart the scheduled task.
3. Confirm `/api/health` is healthy.
4. In **Update Tasks → Update from ManageEngine**, run one manual sync.
5. Review matched, updated, unchanged, and not-found counts.
6. Open a representative SR and confirm the ManageEngine status, timestamps, pending side, requester/technician, category, and scope.

If the first run reports many not-found SRs, verify `MANAGEENGINE_PORTAL`, the Zoho data center, and whether local `sr_number` values match ManageEngine Request IDs. The job will not modify not-found records.
