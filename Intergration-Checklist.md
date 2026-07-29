# Integration Checklist — Backend ↔ Member 4 (Auth/Integration)

For a sync with Member 4 before final integration. Goal: confirm auth wiring, env vars, and role boundaries all line up before demo.

## 1. Where JWT middleware needs to go

`web/src/middleware/auth.ts` has a stub (`requireAuth`, `requireRole`) but **isn't applied to any route yet**. Every route under `web/src/app/api/` currently has zero auth — anyone can call any endpoint.

**Routes that need protection, and who should be allowed to call them:**

| Route | Method | Should require |
|---|---|---|
| `/api/employees` | `POST` | Admin/HR role only |
| `/api/employees` | `GET` | Admin/HR role only |
| `/api/payroll-runs` | `POST` | Admin/HR role only |
| `/api/payroll-runs` | `GET` | Admin/HR role only |
| `/api/payroll-runs/:id` | `GET` | Admin/HR, or the employee viewing their own item within it (needs a rule — see open question below) |
| `/api/payroll-history` | `GET` | Admin/HR (company-wide), or an employee viewing their own history only |
| `/api/payroll-items/:id/initiate-withdraw` | `POST` | Admin/HR only — this moves money |
| `/api/payroll-items/:id/check-status` | `GET` | Admin/HR, or possibly the employee checking their own payment |
| `/api/payroll-items/poll-pending` | `GET` | System/cron only — should NOT be callable by a regular logged-in user at all. Needs a separate auth mechanism (e.g. a shared secret header), not JWT. |
| `/api/payroll-items/:id/confirm-onchain` | `POST` | Admin/HR, or system/cron |
| `/api/payroll-items/:id/retry` | `POST` | Admin/HR only |

**Open question for Member 4:** should an individual employee be able to log in and view their own payroll history/status at all, or is this platform admin-only (HR staff check status, employees get notified separately)? This determines whether we need employee-level JWTs at all, or just one role (admin) protecting everything.

## 2. Env vars Member 4 needs to know exist

These are already required by the backend and should be present wherever the app is deployed:
```
DATABASE_URL
JWT_SECRET
ANCHOR_HOME_DOMAIN
USDC_ASSET_CODE
USDC_ASSET_ISSUER
ANCHOR_PAYOUT_ASSET_CODE
PLATFORM_STELLAR_PUBLIC_KEY
PLATFORM_STELLAR_SECRET_KEY   ← sensitive, handle like any other production secret
STELLAR_NETWORK
```
`SKIP_ONCHAIN_CONFIRMATION_CHECK` — **must NOT be set to `"true"` in any deployed/demo environment.** Dev-only.

## 3. The `poll-pending` route needs a decision

This route is meant to be hit by a scheduler (cron), not a logged-in user. Options:
- **Vercel Cron** (if deploying there) — can restrict by checking a header Vercel sends automatically
- **Shared secret header** — the cron job sends a header like `X-Cron-Secret`, the route checks it matches an env var, independent of the JWT auth system entirely

Needs Member 4's input on which deployment approach the team is using, since that determines which option is even available.

## 4. What happens if middleware wiring changes response shapes?

Currently every route returns `{ error: "..." }` on failure. If Member 4's auth middleware intercepts unauthorized requests, confirm it returns errors in the **same shape** (`{ error: "..." }` with an appropriate status code), so Member 3's frontend doesn't need two different error-handling code paths for "auth failed" vs "backend logic failed."

## 5. `POST /companies` — still doesn't exist

Flagged in prior notes: companies are created manually via Prisma Studio. If Member 4's onboarding flow needs to let a new BPO company sign up and create their own company record, this route needs to be built — currently out of scope, would need to be added if required for the demo.

## 6. Things already working, for confidence going in

- Full CRUD for employees and payroll runs, tested
- Full SEP-24 flow (auth → withdraw → poll status) tested end-to-end against a live anchor
- On-chain confirmation logic built (with one open question about whether the anchor pays out on-chain or off-chain — separate from auth, doesn't block this checklist)
- Complete audit trail (`StatusHistory`) on every status transition, verified with no gaps
- API fully documented in `API-REFERENCE.md` at repo root