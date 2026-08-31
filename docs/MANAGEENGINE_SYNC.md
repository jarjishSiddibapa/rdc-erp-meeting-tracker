# ManageEngine API synchronization

The application can refresh every existing Service Request from ManageEngine ServiceDesk Plus Cloud every 30 minutes. It never creates an SR from the API and never overwrites the local description.

## Fields synchronized

| Local field | ManageEngine source |
| --- | --- |
| Status | `status.name`, normalized to the application's status names |
| Creation date and exact time | `created_time` |
| Closed date and exact time | `completed_time` |
| Created By | `created_by.name`, falling back to `requester.name` |
| Type | `category.name` |
| Assigned To | `technician.name` |
| Internal / External | External only when the technician is `Deloitte ERP Support`; Internal otherwise |
| Pending Side | User or Technician |
| Pending With | The requester name when waiting on the user; the technician name when waiting on the technician |

Pending Side uses ManageEngine's `unreplied_count`: a value greater than zero means the technician has requester replies awaiting a response. Zero means the technician replied last, so the next action is with the user. An explicit ManageEngine status such as `Pending with User` takes precedence. Closed tickets have no pending side.

Every changed field receives an `sr_history` entry with a blank actor, identifying it as a system update. Unchanged SRs only receive a new `manageengine_last_synced_at` timestamp. Missing remote tickets are left unchanged; absence is never interpreted as closure.

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

Copy the printed refresh token into `backend/.env`, delete `MANAGEENGINE_AUTH_CODE`, and configure:

```dotenv
MANAGEENGINE_SYNC_ENABLED=true
MANAGEENGINE_SYNC_INTERVAL_MINUTES=30
MANAGEENGINE_SYNC_RUN_ON_START=true
MANAGEENGINE_REFRESH_TOKEN=your-refresh-token
MANAGEENGINE_PORTAL=
MANAGEENGINE_EXTERNAL_TECHNICIAN=Deloitte ERP Support
MANAGEENGINE_TIME_ZONE=Asia/Kolkata
```

`MANAGEENGINE_PORTAL` is needed only when the ServiceDesk URL contains `/app/<portal>/`; enter the `<portal>` segment shown in ESM Directory → Service Desk Instances. The token response normally supplies the correct API domain automatically. Set `MANAGEENGINE_API_DOMAIN` only when that needs an explicit override.

Restart `start-all.bat` after changing `.env`. Open **Update Tasks → Update from ManageEngine** to see configuration status, the latest run, and the manual **Sync now** action.

## Production checks

1. Back up MySQL.
2. Run `update-production.bat` or pull, run `build.bat`, and restart the scheduled task.
3. Confirm `/api/health` is healthy.
4. In **Update Tasks → Update from ManageEngine**, run one manual sync.
5. Review matched, updated, unchanged, and not-found counts.
6. Open a representative SR and confirm the ManageEngine status, timestamps, pending side, requester/technician, category, and scope.

If the first run reports many not-found SRs, verify `MANAGEENGINE_PORTAL`, the Zoho data center, and whether local `sr_number` values match ManageEngine Request IDs. The job will not modify not-found records.
