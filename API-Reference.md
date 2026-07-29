# Stellar FX — Backend API Reference

For Member 3 (frontend) and Member 4 (integration/auth). All routes are under `web/src/app/api/`, base path `/api`.

**Note on auth:** none of these routes are protected yet — JWT middleware exists (`middleware/auth.ts`) but isn't wired in. Treat all routes as open for now during development; this will change once Member 4's auth is ready.

**Note on money fields:** all amounts (`amountUsdc`, `amountPhp`, `totalUsdc`) are returned as **strings**, not numbers — they're stored as `BigInt` in the smallest unit (7 decimal places, Stellar convention) and don't serialize to JSON as native numbers. When sending amounts in a request body, also send them as strings.

---

## Employees

### `POST /api/employees`
Creates a new employee record.

**Body:**
```json
{
  "companyId": "cuid-string",
  "fullName": "Juan Dela Cruz",
  "email": "juan@example.com",
  "stellarWallet": "G... (56-char Stellar public key)"
}
```

**Response `201`:**
```json
{ "employee": { "id": "...", "companyId": "...", "fullName": "...", "email": "...", "stellarWallet": "...", "role": "EMPLOYEE", "createdAt": "..." } }
```

**Errors:** `400` invalid input (see `details.fieldErrors` for which field failed), `500` server error.

### `GET /api/employees?companyId=...`
Lists employees, optionally filtered by company.

**Response `200`:**
```json
{ "employees": [ { ...same shape as above... } ] }
```

---

## Payroll Runs

### `POST /api/payroll-runs`
Creates a payroll run with one or more line items.

**Body:**
```json
{
  "companyId": "cuid-string",
  "items": [
    { "employeeId": "cuid-string", "amountUsdc": "50000000" }
  ]
}
```
(`amountUsdc` is a string in smallest units — `"50000000"` = 5 USDC)

**Response `201`:** the created `PayrollRun` with nested `items` (flat object, not wrapped — see note below).
```json
{
  "id": "...",
  "companyId": "...",
  "status": "PENDING",
  "totalUsdc": "50000000",
  "createdAt": "...",
  "completedAt": null,
  "items": [
    { "id": "...", "payrollRunId": "...", "employeeId": "...", "amountUsdc": "50000000", "amountPhp": null, "status": "PENDING", "createdAt": "...", "updatedAt": "..." }
  ]
}
```
**Important:** the response is the run object directly — there is no `payrollRun` wrapper key. Access items via `response.items`, not `response.payrollRun.items`.

**Errors:** `400` invalid input or an employee doesn't belong to the given company, `500` server error.

### `GET /api/payroll-runs?companyId=...`
Lists payroll runs for a company.

### `GET /api/payroll-runs/:id`
Full detail of one run, including nested line items and each item's `employee` and `transaction` (if any).

---

## Payroll History

### `GET /api/payroll-history?employeeId=...` or `?companyId=...`
Returns payroll item history filtered by one or the other (pass exactly one).

---

## SEP-24 / Stellar Payment Flow

These routes drive the actual USDC → PHP conversion and payout for a single `PayrollItem`. Call them in this order:

### `POST /api/payroll-items/:id/initiate-withdraw`
Starts the SEP-24 withdraw with the anchor for this payroll item.

**Preconditions:**
- Item must be in `PENDING` status (returns `409` otherwise — already in progress or done)
- The platform's Stellar wallet must have actually received the USDC for this item on-chain (checked via Horizon) — returns `409` with `confirmed: false` if not yet arrived. *(Dev/test only: set `SKIP_ONCHAIN_CONFIRMATION_CHECK=true` in `.env` to bypass this — never enable in a deployed/demo environment.)*

**Response `200`:**
```json
{ "interactiveUrl": "https://anchor.example.com/...", "anchorTransactionId": "..." }
```
`interactiveUrl` is the anchor's own hosted form — open it (iframe or new tab) so someone can enter PHP payout details. This is not something we build; it's the anchor's UI.

**Errors:** `404` item not found, `409` wrong status or USDC not yet confirmed, `502` anchor/Stellar-related failure, `500` other server error.

### `GET /api/payroll-items/:id/check-status`
Checks this item's anchor transaction status and updates it if changed.

**Response `200`:**
```json
{ "itemId": "...", "previousStatus": "CONVERTING", "newStatus": "CONVERTING", "anchorStatus": "pending_anchor", "changed": false }
```
Item status values: `PENDING` → `CONVERTING` → `DISBURSING` → `DISBURSED` (or `FAILED` at any point).

### `GET /api/payroll-items/poll-pending`
Bulk version of the above — checks every item currently `CONVERTING` or `DISBURSING` in one call. Intended to be hit by a scheduled job (not yet configured) every 1-2 minutes, rather than called from the frontend directly.

**Response `200`:**
```json
{ "checked": 5, "changed": 2, "results": [ { "itemId": "...", "previousStatus": "...", "newStatus": "...", "anchorStatus": "...", "changed": true } ] }
```

### `POST /api/payroll-items/:id/confirm-onchain`
Final confirmation step — checks if the anchor's PHP payout has actually landed in the employee's Stellar wallet, and if so marks the item `DISBURSED`.

**Preconditions:** item must be `DISBURSING`, and `amountPhp` must already be known (set once the anchor reports the converted amount).

**Response `200`:**
```json
{ "confirmed": true, "transactionHash": "..." }
```
or, if nothing's found yet:
```json
{ "confirmed": false, "message": "No matching on-chain payment found yet — try again shortly" }
```
**Note (unconfirmed assumption, flagged for follow-up):** this assumes the anchor pays out PHP on-chain to the employee's wallet. If `testanchor.stellar.org` actually pays out off-chain (bank/e-wallet), this route won't find a match — this is a known open question, not necessarily a bug if it happens.

---

### `POST /api/payroll-items/:id/retry`
Resets a `FAILED` item back to `PENDING` so `initiate-withdraw` can be called on it again (e.g. after a transient anchor error or a resolved KYC/info issue).

**Preconditions:** item must be in `FAILED` status (returns `409` otherwise).

**Response `200`:**
```json
{ "message": "Item reset to PENDING — call initiate-withdraw again to retry" }
```

**Note:** this does not resume the old anchor transaction — a fresh `initiate-withdraw` call starts an entirely new one. The old transaction id remains visible in `StatusHistory` for audit purposes.

---

## Status Values Reference

**`PayrollItem.status`** (`ItemStatus` enum):
| Status | Meaning |
|---|---|
| `PENDING` | Created, withdraw not yet initiated |
| `CONVERTING` | Anchor is converting USDC → PHP |
| `DISBURSING` | Anchor finished converting, payout in progress |
| `DISBURSED` | Confirmed paid to employee |
| `FAILED` | Failed at any stage |

Every status change is logged to `StatusHistory` with a timestamp and note — useful for audit/debugging, ask if you need an endpoint exposing this (not built yet, data exists in the DB).

---

## Known Gaps (as of 2026-07-29)

- No `POST /companies` route yet — companies are created manually via Prisma Studio for now. Flag if the frontend needs this.
- No auth/authorization on any route yet — coming once Member 4's JWT middleware is wired in.
- `confirm-onchain` design assumption not yet verified (see note above).