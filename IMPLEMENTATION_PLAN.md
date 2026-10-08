# IMPLEMENTATION_PLAN.md — Mad-Bak
> Source of truth: `PRD.md` | Stack: Next.js App Router + TypeScript + Prisma + PostgreSQL (Neon) + Tailwind CSS
> Rule: ONE checkbox at a time. Edge-case sub-lists are expanded phase-by-phase before coding begins.

---

## PHASE 0 — Project Scaffold, Environment & Git Foundation

- [x] Initialise Next.js App Router project with TypeScript strict mode (`src/` layout, `@/*` path alias)
- [ ] Run `git init`; create initial commit `chore: initialise Next.js project`; push to GitHub; set `main` as default branch
- [ ] Add `.gitignore` (Next.js standard: `.next/`, `node_modules/`, `.env*`, keep `.env.example`)
- [ ] Write `CONTRIBUTING.md` — branch naming (`feat/phase-N-<slug>`, `fix/<slug>`, `chore/<slug>`), commit convention (Conventional Commits), PR checklist, phase tag convention (`git tag v0.phase-N`)
- [ ] Install and configure Prisma ORM; connect to Neon PostgreSQL (`DATABASE_URL` + `DIRECT_URL`)
- [ ] Define and Zod-validate all environment variables at startup (`lib/env.ts`); write `.env.example`
- [ ] Configure `vercel.json` with Vercel Cron schedule for daily cutoff lock (default: `0 22 * * *` UTC = midnight Cairo)
- [ ] Configure Tailwind CSS with built-in `rtl:` / `ltr:` variants (no plugin — native since Tailwind v3); update root `layout.tsx` (`dir="rtl"`, `lang="ar"`)
- [ ] Scaffold role-aware middleware skeleton (`middleware.ts`): JWT verification via `jose` + role gate (DEVELOPER / BAKERY_ADMIN / CUSTOMER); route `matcher` config
- [ ] Write `lib/response.ts` global API response helpers (`success()` / `error()`) + `src/types/index.ts`
- [ ] Configure GitHub Actions CI workflow (`.github/workflows/ci.yml`): `tsc --noEmit` + `eslint` on push to any `feat/*` / `fix/*` branch
- [ ] Configure GitHub Actions fallback cron (`.github/workflows/cron-cutoff.yml`): calls `POST /api/cron/cutoff-lock` authenticated by `CRON_SECRET`
- [ ] Install Husky + lint-staged + `@commitlint/cli` + `@commitlint/config-conventional` + Prettier; configure `.husky/pre-commit` (lint-staged: ESLint + Prettier on staged files) and `.husky/commit-msg` (commitlint: blocks non-conventional messages)
- [ ] **Phase Gate Audit** → merge `feat/phase-0-scaffold` → `main` → `git tag v0.phase-0`

---

## PHASE 1 — Database Schema, Enums, Constraints & Seed

### Enums
- [ ] `UserRole`: DEVELOPER, BAKERY_ADMIN, RUNNER, CUSTOMER
- [ ] `OrderStatus`: QUEUED, BAKING, DISPATCHED, DELIVERED, CANCELLED_CREDITED
- [ ] `ProductCategory`: FINO_BREAD, TRADITIONAL_BREAD, PASTRY, DAIRY, SWEETS_AND_DRY
- [ ] `ProductVisibility`: AVAILABLE, SOLD_OUT, HIDDEN
- [ ] `PricingModel`: PER_PIECE, PER_WEIGHT
- [ ] `PricingUnit`: PIECE, QUARTER_KG, HALF_KG, THREE_QUARTERS_KG, KG
- [ ] `PaymentStatus`: PENDING_REVIEW, APPROVED, REJECTED
- [ ] `PaymentMethod`: INSTAPAY, ADMIN_ADJUSTMENT
- [ ] `ReconciliationMode`: AUTOMATED_NOTIFICATION, MANUAL_BAKERY_ADMIN
- [ ] `ParseStatus`: OK, FAILED (for `InstaPayAlert.parseStatus`)

### Prisma Models
- [ ] `User` — id, fullName, phone (unique), passwordHash, role, walletBalance (Decimal >=0), street, subStreet?, building, floor?, apartment?, landmark?, additionalDetails?, createdAt, updatedAt
- [ ] `Order` — id, userId, status, deliveryDate, fulfillmentMode (SCHEDULED_BATCH), totalAmount, deliveryFee (snapshot), runnerId?, 7 address snapshot columns (street, subStreet, building, floor, apartment, landmark, additionalDetails), createdAt, updatedAt
- [ ] `OrderItem` — id, orderId, productId, productNameAr (snapshot), productNameEn (snapshot), unitPrice (snapshot), pricingUnit, quantity, subtotal
- [ ] `Product` — id, titleAr, titleEn?, description?, category, pricingModel, basePrice, stockQuantity (Decimal), visibility (default AVAILABLE), imageUrl, createdAt, updatedAt
- [ ] `SystemConfig` — singleton (id=1); dailyCutoffTime, bakingStartTime, runnerDispatchTime, deliveryWindowStart, deliveryWindowEnd, timezone (default "Africa/Cairo"), convenienceFee, platformFee, laborPoolFee, fuelReserveFee, minTopupAmount, isOrderWindowOpen, isAdvanceOrderingOpen, instapayReconciliationMode, instapayHandle, bakeryName, neighborhoodName, city, primaryAreaName?
- [ ] `Payment` — id, userId, method, status, amount, ipnReference?, screenshotUrl?, ocrExtractedData (Json?), reconciledAt?, rejectionReason?, createdAt, updatedAt
- [ ] `InstaPayAlert` — id, ipnReference (unique), amount, sender?, receivedAt, isMatched (default false), matchedPaymentId?, parseStatus (default OK); APPEND-ONLY
- [ ] `WalletAuditLog` — id, adminId, customerId, previousBalance, newBalance, delta, reason, createdAt; APPEND-ONLY
- [ ] `PasswordResetToken` — id, userId, token (unique UUID), isUsed (default false), expiresAt, createdAt
- [ ] `IdempotencyRecord` — id, key (unique), statusCode, responseBody (Json), createdAt

### Constraints & Indexes
- [ ] DB check constraint: `User.walletBalance >= 0`
- [ ] DB check constraint: `SystemConfig.platformFee + laborPoolFee + fuelReserveFee = convenienceFee`
- [ ] Unique index: `(User.phone)`
- [ ] Unique index: `(InstaPayAlert.ipnReference)`
- [ ] Unique index: `(IdempotencyRecord.key)`
- [ ] Composite index: `(Order.userId, Order.deliveryDate, Order.status)` for manifest queries
- [ ] Index: `(Payment.status)` for admin review queue

### Immutability Enforcement
- [ ] Prisma Client Extension (`prisma.$extends`) — intercept and throw on any `update`/`delete`/`upsert` targeting `InstaPayAlert` or `WalletAuditLog`
- [ ] PostgreSQL DB-level trigger — hard backstop preventing UPDATE/DELETE on `InstaPayAlert` and `WalletAuditLog` at the database layer

### Seed
- [ ] Seed DEVELOPER account (hashed password, role=DEVELOPER)
- [ ] Seed BAKERY_ADMIN account (hashed password, role=BAKERY_ADMIN)
- [ ] Seed `SystemConfig` singleton (id=1) with all PRD default values (cutoff 00:00, delivery 06:30-08:30, convenienceFee 5.00, platform 2.50, labor 2.00, fuel 0.50, minTopup 50.00, timezone Africa/Cairo, AUTOMATED_NOTIFICATION)
- [ ] **Phase Gate Audit**

---

## PHASE 2 — Authentication & Session Management

- [ ] `POST /api/auth/register` — Zod validation (fullName, phone E.164-normalised, password min-8 + 1-letter+1-number, all 7 address fields), bcrypt hash, JWT HTTP-only cookie (30-day), redirect to dashboard; errors: PHONE_TAKEN, STREET_REQUIRED, BUILDING_REQUIRED
- [ ] `POST /api/auth/login` — phone + password, generic failure message (no account enumeration), role-based redirect (BAKERY_ADMIN→/admin, CUSTOMER→/), rate limit 5 attempts/15min (RATE_LIMITED 429)
- [ ] `POST /api/auth/logout` — clear JWT HTTP-only cookie
- [ ] `POST /api/auth/forgot-password` — silent success regardless of phone existence; if found: create `PasswordResetToken` (UUID, 30-min TTL, isUsed=false); surface pending request in admin /admin/customers
- [ ] `GET  /api/auth/reset-password/[token]` — validate token exists, not expired, not used; errors: OTP_EXPIRED, OTP_USED
- [ ] `POST /api/auth/reset-password/[token]` — validate token + consume (isUsed=true); update passwordHash; issue new JWT; invalidate all prior sessions; errors: OTP_EXPIRED, OTP_USED
- [ ] `GET  /api/auth/me` — return current user profile (role, walletBalance, address fields) from JWT
- [ ] Auth middleware — JWT verify, role extraction, attach req.user; handle expired cookie → UNAUTHORIZED 401
- [ ] **Phase Gate Audit**

---

## PHASE 3 — SystemConfig & Dynamic Parameters API

- [ ] `GET  /api/config/public` — unauthenticated; returns dailyCutoffTime, deliveryWindowStart, deliveryWindowEnd, instapayHandle, bakeryName, minTopupAmount (no financial splits exposed)
- [ ] `GET  /api/cutoffs/next` — unauthenticated; returns ms remaining until next dailyCutoffTime occurrence (IANA-aware using SystemConfig.timezone)
- [ ] `PATCH /api/admin/config` — BAKERY_ADMIN gate; editable: dailyCutoffTime, bakingStartTime, runnerDispatchTime, deliveryWindowStart, deliveryWindowEnd, bakeryName, neighborhoodName, city, primaryAreaName; validation: deliveryWindowStart < deliveryWindowEnd
- [ ] `PATCH /api/admin/developer/fees` — DEVELOPER gate (403 for BAKERY_ADMIN); editable: convenienceFee, platformFee, laborPoolFee, fuelReserveFee, minTopupAmount; enforce: platformFee + laborPoolFee + fuelReserveFee === convenienceFee; error: FEE_SPLIT_MISMATCH
- [ ] `PATCH /api/admin/settings/reconciliation-mode` — BAKERY_ADMIN gate; toggle AUTOMATED_NOTIFICATION <-> MANUAL_BAKERY_ADMIN; instant effect; log changed-by + timestamp
- [ ] **Phase Gate Audit**

---

## PHASE 4 — Product Catalog & Inventory Management

- [ ] `GET  /api/products` — CUSTOMER-accessible; return all products where visibility != HIDDEN; include SOLD_OUT with badge; ordered by category then titleAr
- [ ] `POST /api/admin/products` — BAKERY_ADMIN gate; upload image to CDN (Cloudinary/ImageKit); validate pricingModel, basePrice > 0, stockQuantity >= 0; create Product record; error: UPLOAD_FAILED
- [ ] `PATCH /api/admin/products/[id]` — BAKERY_ADMIN gate; in-place edit of any field; price changes apply to new orders only (existing OrderItem.unitPrice snapshots unaffected)
- [ ] `PATCH /api/admin/products/[id]/visibility` — BAKERY_ADMIN gate; 1-tap toggle AVAILABLE / SOLD_OUT / HIDDEN
- [ ] Automated SOLD_OUT transition — inside order checkout transaction: if stockQuantity reaches 0 after decrement, set visibility=SOLD_OUT
- [ ] Automated AVAILABLE restore — on Fino bread cancellation stock recovery: if visibility=SOLD_OUT and stockQuantity > 0, restore visibility=AVAILABLE; non-fino: no restore
- [ ] **Phase Gate Audit**

---

## PHASE 5 — Core Order Engine (SCHEDULED_BATCH)

- [ ] `POST /api/orders` — CUSTOMER gate; idempotency key required; validate wallet >= totalAmount; atomic conditional stock decrement per item; snapshot 7 address fields from User onto Order; deduct wallet; create Order(QUEUED) + OrderItems with price snapshots; errors: INSUFFICIENT_WALLET, INSUFFICIENT_STOCK, EMPTY_BASKET, ORDER_LOCKED, ORDER_EXISTS, PRODUCT_HIDDEN, PRODUCT_UNAVAILABLE
- [ ] `GET  /api/orders` — CUSTOMER gate; paginated order history with status + items
- [ ] `GET  /api/orders/[id]` — CUSTOMER gate (own orders only); full item breakdown + snapshotted address
- [ ] `PATCH /api/orders/[id]/items` — CUSTOMER gate; validate QUEUED + pre-cutoff; allow add/increase any item, decrease/remove FINO_BREAD only; block decrease/remove non-fino (CANNOT_CANCEL_NON_FINO); recalculate delta; deduct or refund wallet atomically; errors: ORDER_LOCKED, CANNOT_CANCEL_NON_FINO, INSUFFICIENT_WALLET, INSUFFICIENT_STOCK, EMPTY_BASKET
- [ ] `DELETE /api/orders/[id]` — CUSTOMER gate; validate QUEUED + pre-cutoff; pure-Fino scope only; refund totalAmount atomically; recover Fino stock; set CANCELLED_CREDITED; block if non-fino items present; errors: ORDER_LOCKED, CANNOT_CANCEL_NON_FINO, ALREADY_CANCELLED
- [ ] `POST /api/orders/copy` — CUSTOMER gate; idempotency key; source orderId + array of target deliveryDates; per-day: validate cutoff, wallet, stock, no existing QUEUED order; create independently; return summary {created[], skipped_existing[], rejected[{date, reason}]}; sequential (not parallel)
- [ ] Cutoff enforcement utility (`lib/cutoff.ts`) — reads SystemConfig.dailyCutoffTime + timezone from DB; IANA-aware via Intl; used by all order mutation routes
- [ ] **Phase Gate Audit**

---

## PHASE 6 — Cron Job: Daily Cutoff Lock & Manifest Generation

- [ ] `POST /api/cron/cutoff-lock` — secured by CRON_SECRET header; batch-transition all QUEUED orders for today's deliveryDate to BAKING in prisma.$transaction; set isOrderWindowOpen=false; log cutoff timestamp
- [ ] Manifest sort applied at lock time — ORDER BY street ASC, subStreet ASC NULLS FIRST, building ASC, floor ASC NULLS FIRST, apartment ASC NULLS FIRST
- [ ] Cron fail-safe flag — if isOrderWindowOpen=true past dailyCutoffTime, /admin/controls shows warning with manual trigger CTA
- [ ] `POST /api/admin/gate/close` — BAKERY_ADMIN gate; manual early close: batch QUEUED->BAKING for today; set isOrderWindowOpen=false; idempotent
- [ ] `POST /api/admin/gate/open` — BAKERY_ADMIN gate; set isOrderWindowOpen=true; existing BAKING orders NOT reverted
- [ ] **Phase Gate Audit**

---

## PHASE 7 — Wallet, Payments & InstaPay Reconciliation Engine

- [ ] `POST /api/payments/upload` — CUSTOMER gate; idempotency key; upload screenshot to CDN; call Gemini Vision (gemini-2.5-flash) with responseSchema; validate recipientHandle, amount >= minTopupAmount, referenceNumber not duplicate; dual-path reconciliation; errors: UNREADABLE_RECEIPT, RECIPIENT_MISMATCH, AMOUNT_TOO_LOW, REJECTED_DUPLICATE, UPLOAD_FAILED
- [ ] Dual-path reconciliation logic (`lib/reconciliation.ts`) — AUTOMATED_NOTIFICATION: query InstaPayAlert by (ipnReference, amount, isMatched=false); if match: atomic approve + credit + WalletAuditLog; if no match: PENDING_REVIEW; MANUAL_BAKERY_ADMIN: always PENDING_REVIEW
- [ ] `POST /api/webhooks/instapay-notification` — validate x-device-secret (DEVICE_SECRET_INVALID 401); insert InstaPayAlert; if AUTOMATED_NOTIFICATION: find matching PENDING_REVIEW Payment; if found: auto-approve atomically; idempotent on duplicate ipnReference
- [ ] `GET  /api/admin/payments` — BAKERY_ADMIN gate; filterable by status; includes OCR data, screenshot URL, customer name/phone
- [ ] `POST /api/admin/payments/[id]/approve` — BAKERY_ADMIN gate; validate status=PENDING_REVIEW; atomic: APPROVED + walletBalance += amount + WalletAuditLog; error: ALREADY_PROCESSED
- [ ] `POST /api/admin/payments/[id]/reject` — BAKERY_ADMIN gate; rejectionReason required; Payment->REJECTED; errors: ALREADY_PROCESSED, ADJUSTMENT_REASON_REQUIRED
- [ ] `POST /api/admin/payments/[id]/recheck` — BAKERY_ADMIN gate; re-query InstaPayAlert for late notification; if match: auto-approve atomically
- [ ] `POST /api/admin/developer/wallets/adjust` — DEVELOPER gate; ADD_CREDIT or SET_BALANCE; reason required min 10 chars; validate result >= 0; atomic: walletBalance update + WalletAuditLog + Payment(ADMIN_ADJUSTMENT); errors: CUSTOMER_NOT_FOUND, ADJUSTMENT_REASON_REQUIRED, INSUFFICIENT_WALLET
- [ ] Anti-Fraud Golden Rule audit — verify no code path reaches walletBalance+= without: (a) matched InstaPayAlert, (b) admin approve tap, or (c) DEVELOPER adjust
- [ ] **Phase Gate Audit**

---

## PHASE 8 — Admin APIs: Manifest, Runner Assignment & Customer Management

- [ ] `GET  /api/admin/manifest?date=` — BAKERY_ADMIN gate; pre-cutoff: live QUEUED orders; post-cutoff: locked sorted manifest (street, subStreet, building, floor, apartment)
- [ ] `GET  /api/admin/manifest/summary?date=` — BAKERY_ADMIN gate; aggregate by SKU: total units/weights; total order count; total unique street+building combos
- [ ] `POST /api/admin/manifest/assign` — BAKERY_ADMIN gate; accept orderIds[] + runnerId; batch-update Order.runnerId; validates runner role=RUNNER
- [ ] `GET  /api/admin/customers` — BAKERY_ADMIN gate; list all CUSTOMER accounts; searchable by phone; includes walletBalance, pending reset request count
- [ ] `GET  /api/admin/customers/[id]/reset-requests` — BAKERY_ADMIN gate; return pending (unused, non-expired) PasswordResetTokens
- [ ] `POST /api/admin/customers/[id]/generate-reset-link` — BAKERY_ADMIN gate; invalidate existing active token; create new token (UUID, 30-min TTL); return full /reset-password?token=<uuid> URL
- [ ] `PATCH /api/admin/customers/[id]/phone` — BAKERY_ADMIN gate; validate new phone globally unique (PHONE_TAKEN); update User.phone
- [ ] `POST /api/admin/manifest/complete?date=` — BAKERY_ADMIN gate; idempotent batch-transition all BAKING/DISPATCHED orders for `date` → DELIVERED; records `deliveredAt` timestamp on each order; errors: DATE_REQUIRED, NO_ORDERS_TO_SETTLE, ORDERS_ALREADY_SETTLED
- [ ] `PATCH /api/admin/orders/[id]/deliver` — BAKERY_ADMIN gate; single-order BAKING/DISPATCHED → DELIVERED; for partial settlements; idempotent; records `deliveredAt`
- [ ] **Phase Gate Audit** → merge `feat/phase-8-admin-apis` → `main` → `git tag v0.phase-8`

---

## PHASE 9 — Admin Batch Delivery Settlement & Print-Ready Run Sheet

> Runners carry a **printed paper run sheet** prepared at the bakery counter. No runner smartphones or mobile PWA. Delivery confirmation is admin-initiated after the runner returns.

- [ ] `@media print` CSS — print-ready run sheet styles on `/admin/manifest`: A4/thermal layout; high-contrast black-on-white; no navbar/sidebar rendered; `page-break-inside: avoid` per building block; header with bakery name, delivery date, runner name (if assigned), total order count, print timestamp; footer with aggregate SKU totals (e.g. "Total Fino: 47 loaves")
- [ ] Run sheet row layout — per order: seq#, customer full name, floor/apartment label, exact item quantities ("5x Fino 400g", "2x كرواسون"), landmark + additionalDetails as delivery notes, physical checkbox `[ ]` for runner's pen
- [ ] Run sheet grouping — rows grouped by (street → subStreet → building → floor → apartment) with section headers per building block
- [ ] [Print Run Sheet] button — visible only post-cutoff; calls `window.print()`; triggers `@media print` layout
- [ ] "Mark All Delivered" batch action — BAKERY_ADMIN taps after runner returns; confirmation dialog shows order count for the date; calls `POST /api/admin/manifest/complete`; manifest rows update to DELIVERED on success; irreversible with dialog warning
- [ ] Per-row [Mark Delivered] button — for partial rounds (a specific drop couldn't be completed); calls `PATCH /api/admin/orders/[id]/deliver`; optimistic green row on success; reverts on error with toast
- [ ] **Phase Gate Audit** → merge `feat/phase-9-delivery-settlement` → `main` → `git tag v0.phase-9`

---

## PHASE 10 — Customer PWA UI (Arabic RTL, Mobile-First)

> All screens: dir="rtl", Arabic primary, English fallback. Tailwind utility classes only. Mobile-first.

- [ ] `/login` — phone + password; generic error; "Forgot password?" link; role-based redirect
- [ ] `/register` — fullName, phone (auto-normalised), password (inline Zod), 7-field address (street + building required)
- [ ] `/forgot-password` — phone input; silent success; "Contact bakery" instruction
- [ ] `/reset-password?token=` — new password + confirm; OTP_EXPIRED / OTP_USED states; success -> /login
- [ ] `/` (Dashboard) — wallet balance chip; tomorrow QUEUED order card; live countdown banner (60s refresh via /api/cutoffs/next); "Order Tomorrow" CTA if empty; locked status display
- [ ] `/planner` — 7-day grid (Sat-Fri); per-day order card or empty slot; "Copy to other days" multi-select picker + summary result; cutoff-passed days greyed
- [ ] `/products` — category filter tabs; search bar; PER_PIECE price display; PER_WEIGHT fraction selector (1/4, 1/2, 3/4, 1 kg); SOLD_OUT badge + disabled; HIDDEN excluded; "Add to Day" action
- [ ] `/orders` — paginated history; status color badges (QUEUED=blue, BAKING=orange, DISPATCHED=purple, DELIVERED=green, CANCELLED_CREDITED=gray)
- [ ] `/orders/[id]` — full breakdown; snapshotted address; Fino qty stepper; non-fino commitment badge ("طلب مؤكد لا يمكن إلغاؤه"); Cancel button (Fino-only / pure-Fino); ORDER_LOCKED state
- [ ] `/wallet` — balance (EGP formatted); PENDING_REVIEW banner; payment history (date, amount, status, rejection reason); "شحن المحفظة" CTA
- [ ] `/wallet/topup` — InstaPay handle + 1-tap copy; minTopupAmount hint; single upload zone; progress states: "Uploading..." -> "Extracting with AI..." -> "Verifying..." -> success/PENDING_REVIEW; zero manual input
- [ ] `/settings` — edit fullName + 7 address fields; password change (current password required); phone field read-only with "Contact bakery to change" note
- [ ] Service Worker + Web App Manifest — PWA installable on Android Chrome; offline shell; `lang="ar"`, `dir="rtl"`
- [ ] **Phase Gate Audit**

---

## PHASE 11 — Admin Dashboard UI

> All admin routes: role-gated at middleware level. DEVELOPER-only pages return 403/redirect for BAKERY_ADMIN.

- [ ] `/admin/payments` — tabs: Pending Review / Approved / Rejected; searchable by phone + date range
- [ ] `/admin/payments/review` — PENDING_REVIEW queue oldest-first; screenshot + OCR side-by-side; [Approve] / [Reject] (reason required); "Re-Check Notifications" button; elapsed wait time
- [ ] `/admin/payments?status=REJECTED` — full rejected log; OCR metadata + rejection reason + screenshot zoom
- [ ] `/admin/manifest` — date picker; pre-cutoff: live demand banner + "Refresh Demand" button + order count; post-cutoff: locked banner + sorted manifest rows (seq#, name, phone, address, items, total); per-row [Mark Delivered] button; "Mark All Delivered" batch CTA (with confirmation dialog); [Print Run Sheet] button (post-cutoff only, triggers `window.print()` with `@media print` layout)
- [ ] `/admin/manifest/summary` — SKU aggregate table; total orders; unique drop locations count
- [ ] `/admin/controls` — Daily Order Gate + Advance Ordering gate rows; state (OPEN/CLOSED), last-changed, changed-by; [Close Now] / [Reopen]; cron fail-safe warning if stuck open past cutoff
- [ ] `/admin/products` — products table; inline visibility toggle [Active] / [Mark Sold Out] / [Hide]; [Add Product] CTA
- [ ] `/admin/products/new` — image upload; titleAr (required) + titleEn; description; category dropdown; pricingModel radio (PER_PIECE / PER_WEIGHT + auto fraction display); basePrice; stockQuantity
- [ ] `/admin/products/[id]/edit` — same form pre-populated; price change notice
- [ ] `/admin/config` — operational schedule inputs; bakery profile; NO fee fields for BAKERY_ADMIN
- [ ] `/admin/settings` — reconciliation mode toggle; persistent red warning banner in MANUAL mode; last-changed + changed-by
- [ ] `/admin/customers` — searchable list; pending reset count badge; [Generate Reset Link] (copies URL); [Edit Phone] inline form
- [ ] `/admin/developer/fees` — DEVELOPER only; live invariant validation; FEE_SPLIT_MISMATCH inline error; minTopupAmount field
- [ ] `/admin/developer/wallets` — DEVELOPER only; customer search by phone; ADD_CREDIT / SET_BALANCE form; mandatory reason; WalletAuditLog table
- [ ] `/admin/developer/system` — DEVELOPER only; timezone (IANA), instapayHandle, x-device-secret rotation
- [ ] **Phase Gate Audit** → merge `feat/phase-11-admin-ui` → `main` → `git tag v0.phase-11`

---

## PHASE 12 — Cross-Cutting Concerns & Hardening

- [ ] Global API response wrapper enforced on all routes: `{ success: boolean, data?: T, error?: { code: string, message: string } }`
- [ ] All §11 error codes mapped to exact HTTP status codes in central `lib/errors.ts`
- [ ] `X-Idempotency-Key` middleware — required on all order + wallet mutation routes; cache in IdempotencyRecord (24h TTL); duplicate key returns cached response
- [ ] Rate limiting — 5 failed /api/auth/login per phone per 15 min -> RATE_LIMITED 429
- [ ] walletBalance >= 0 application-layer guard in all deduction paths (defence-in-depth on top of DB constraint)
- [ ] Prisma query optimisation — select projections on all non-manifest queries; target NFR-07 (< 1s on Neon)
- [ ] Gemini Vision call timeout 10s; target < 3.5s via responseSchema structured output (NFR-11)
- [ ] Webhook ingestion target < 500ms; async reconciliation if needed (NFR-11)
- [ ] End-to-end wallet credit target < 3s in AUTOMATED_NOTIFICATION when InstaPayAlert pre-exists (NFR-11)
- [ ] All DB timestamps UTC; local-time display uses SystemConfig.timezone via Intl.DateTimeFormat — never hardcoded strings
- [ ] Input sanitisation — whitespace strip; phone digits-only normalisation; address field max-lengths (§3.2 Zod rules)
- [ ] `prisma.$disconnect()` in all serverless route teardowns (prevent Neon connection pool exhaustion)
- [ ] Final PRD cross-check — confirm every FR (FR-01 to FR-32), NFR (NFR-01 to NFR-12), and §11 error code has a corresponding checked checkbox
- [ ] **Phase Gate Audit**

---

## Progress Tracker

| Phase | Description | Status |
|---|---|---|
| 0 | Project Scaffold & Environment | Not Started |
| 1 | Database Schema, Enums, Constraints & Seed | Not Started |
| 2 | Authentication & Session Management | Not Started |
| 3 | SystemConfig & Dynamic Parameters API | Not Started |
| 4 | Product Catalog & Inventory Management | Not Started |
| 5 | Core Order Engine (SCHEDULED_BATCH) | Not Started |
| 6 | Cron Job: Cutoff Lock & Manifest Generation | Not Started |
| 7 | Wallet, Payments & InstaPay Reconciliation | Not Started |
| 8 | Admin APIs: Manifest, Assignment & Customers | Not Started |
| 9 | Admin Batch Delivery Settlement & Print Run Sheet | Not Started |
| 10 | Customer PWA UI (Arabic RTL, Mobile-First) | Not Started |
| 11 | Admin Dashboard UI | Not Started |
| 12 | Cross-Cutting Concerns & Hardening | Not Started |
