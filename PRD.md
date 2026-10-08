# Mad-Bak — Product Requirements Document (PRD)
> Hyper-Local Bakery Daily Ordering & Delivery PWA ("Fino to Home" Marketing Identity)

---

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-09-29 | 0.9 | Core payment architecture overhaul: Deprecated and removed all references to Bank SMS, BankAlert, and core-banking reference codes. Payment reconciliation is now based strictly on InstaPay App push notifications (Android listener on bakery phone intercepting `com.egyptianbanks.instapay` notifications). Renamed `BankAlert` → `InstaPayAlert`. Added `PENDING_REVIEW` payment status and bakery admin manual review dashboard (`/admin/payments/review`). Introduced `instapayReconciliationMode` global toggle in `SystemConfig` with two modes: `AUTOMATED_NOTIFICATION` (real-time auto-match, < 3 seconds) and `MANUAL_BAKERY_ADMIN` (every receipt goes to admin 1-tap approval queue). Problematic receipts are never silently dropped; they surface in the review dashboard with screenshot side-by-side for owner tap-to-approve/reject. | Project Owner |
| 2026-09-23 | 0.8 | Implemented Anti-Hoarding & Fino-Only Cancellation Policy: Customer-side pre-cutoff order cancellations and quantity reductions are strictly restricted to Fino bread (`FINO_BREAD`). Non-fino bakery products (pastries, sweets, traditional breads, dairy) are final sale upon order placement to prevent limited-inventory hoarding and last-minute cancellation waste. Mixed orders permit cancelling Fino loaves only while retaining non-fino commitments. | Project Owner |
| 2026-09-23 | 0.7 | Granted BAKERY_ADMIN operational timing controls (cutoff time, morning delivery windows); added rich product catalog management (image upload, description, piece vs weight-based pricing [1/4, 1/2, 3/4, 1 kg], stock quantities); product lifecycle controls (update fields, mark sold out, or hide); and automated real-time inventory depletion/recovery. | Project Owner |
| 2026-09-23 | 0.6 | Enforced strict prepaid order gating (user must have funds in wallet to place/schedule orders; amount deducted immediately; no unpaid or held orders exist); added real-time live/refreshable pre-cutoff demand tracking on Oven Manifest for bakery admins before the cutoff lock. | Project Owner |
| 2026-09-23 | 0.5 | Redesigned payment top-up flow: Zero-Input Customer UX (single-action InstaPay screenshot upload), automated Gemini Vision OCR extraction, bank-verified reconciliation via incoming SMS webhooks (BankAlert ledger) with Anti-Fraud Golden Rule, bakery admin rejected receipts viewer, and Super Admin / Developer emergency wallet balance adjustment with immutable audit log. | Project Owner |
| 2026-09-22 | 0.4 | Made all timing parameters (cutoff, delivery windows) fully configurable in DB; removed in-store pickup (100% morning delivery); unified drop-off execution (runner decides door vs gate drop live on the street); introduced DEVELOPER role with exclusive control over dynamic fees and timing. | Project Owner |
| 2026-09-22 | 0.3 | Redefined address structure into a unified model: street, sub-street (optional), building number or name, floor, apartment, famous sign/landmark, and free-text address description field. | Project Owner |
| 2026-09-22 | 0.2 | Removed full weekly subscription model and fino-only restrictions. Introduced flexible 7-day ordering with 12:00 AM midnight cutoff for morning delivery; expanded basket to full bakery catalog. "Fino to Home" retained as brand/marketing concept. | Project Owner |
| 2026-09-22 | 0.1 | Initial PRD — full rewrite from existing codebase analysis | Project Owner |

---

## 1. Goals & Background Context

### 1.1 Goals

- Give neighborhood households a dead-simple digital ordering platform for daily fresh bread and bakery products (available across all 7 days of the week), eliminating manual phone calls, WhatsApp messages, and cash-at-door friction.
- Deliver 100% of orders fresh to the customer's home every morning — no in-store pickup friction or counter queues.
- Ensure all operational time parameters (daily order cutoff, morning baking start, runner dispatch, delivery windows) are **fully dynamic and configurable by the bakery owner (`BAKERY_ADMIN`)** in the database rather than hardcoded in code (defaulting to 12:00 AM midnight cutoff and 6:30 AM – 8:30 AM delivery).
- Implement a **Dynamic Fee Engine** whose convenience fees and splits are controlled exclusively by the software creator (**`DEVELOPER` / `PLATFORM_OWNER`** role) via high-authority console or database queries, completely restricted from bakery owner modification.
- Empower delivery runners on the street to dynamically choose between doorstep drop or compound/building gate-drop based on real-time street access, security rules, and customer notes, avoiding artificial technical segregation.
- Offer the bakery's entire catalog (fino, baladi bread, pastries, dairy, biscuits, sweets, and savory items) seamlessly in any order with **support for both per-piece and fractional weight-based pricing (1/4 kg, 1/2 kg, 3/4 kg, 1 kg)**.
- Provide bakery owners with **complete product catalog control**: register products with image uploads, title, description, piece/weight pricing, and stock quantity; edit any product field; toggle availability (`AVAILABLE`, `SOLD_OUT`, `HIDDEN`); and track automated real-time inventory depletion as customer orders are placed.
- Leverage **"Fino to Home" (فينو للبيت)** as a high-converting marketing identity and household breakfast hook, while keeping the technical architecture open to the complete bakery product catalog.
- Protect bakery margins with a zero-commission, prepaid-wallet model (no Paymob / Fawry fees), funded exclusively through **InstaPay** with a **Zero-Input Customer UX** (upload screenshot only), automated **Gemini Vision OCR**, and notification-verified automated reconciliation (**`InstaPayAlert` ledger**) enforcing the **Anti-Fraud Golden Rule**.
- Enforce **strict prepaid order gating**: customers can only place orders if they have sufficient money in their wallet upfront (`walletBalance >= order.totalAmount`), which is deducted immediately. Unpaid or held orders are completely eliminated.
- Enforce **Fino-Only Pre-Cutoff Cancellation & Anti-Hoarding Policy**: Prevent inventory lockup on limited-stock products (pastries, sweets, dairy) where a customer could order all remaining units (marking the item `SOLD_OUT` for everyone else) and then cancel right before cutoff. Customer pre-cutoff cancellation and quantity reductions are strictly restricted to **`FINO_BREAD`** (which is baked on demand in large volume). Non-fino items are committed upon placement (final sale).
- Enable **live pre-cutoff demand tracking**: bakery admins and head bakers can view requested/ordered products in real time (live or via manual refresh) throughout the day prior to the cutoff manifest lock to optimize dough preparation and oven shifts.
- Enable bakery admins to view and audit all rejected payment receipts with full OCR extraction details and original screenshot evidence.
- Grant `DEVELOPER` / Super Admin high-privilege authority to directly add or modify customer wallet balances for emergency dispute resolutions, backed by an immutable `WalletAuditLog`.
- Make the platform fully redeployable to any Egyptian neighborhood, city, or bakery without changing a single line of code.
- Provide delivery runners with a reliable, offline-capable run sheet that works inside elevator shafts and stairwells on poor mobile networks.

### 1.2 Background Context

Egyptian households — particularly those with school-aged children — consume fresh fino, bread, and breakfast pastries daily. Neighborhood bakeries already serve these households every morning, but manage customer orders through fragmented, error-prone channels: late-night WhatsApp messages, notebook registers, and cash-at-door collection.

This creates four recurring pain points:

1. **For the household:** Forgetting to call or text the bakery, miscommunications on quantities and items, no visibility into whether tomorrow morning's bread and breakfast items are confirmed.
2. **For the bakery:** Manually counting and compiling orders from WhatsApp chats past midnight, no structured production manifest, money collected ad hoc.
3. **For the delivery runner:** A handwritten route list with no structured sequence, causing wasted morning time and missed drops before school runs.
4. **For the bakery owner:** No financial ledger, no cash-flow visibility, no automated reconciliation.

**Mad-Bak** solves all four by providing a purpose-built, hyper-local digital layer on top of the existing neighborhood bakery relationship:
- **7 Days of the Week Available:** Customers can place or schedule an order for any day of the week. No rigid weekly package or mandatory multi-day commitment.
- **Clear 12:00 AM (Midnight) Cutoff:** To receive an order on Sunday morning, the customer simply places it any time before Sunday 12:00 AM (midnight).
- **Full Product Freedom:** Customers can order standard or large fino, baladi bread, croissants, pâtés, dairy, or sweets in any combination.
- **"Fino to Home" Marketing Spearhead:** Marketed to households as the reliable way to get fresh school fino and breakfast delivered to their door every morning, without technically limiting the catalog to fino.

It is not a third-party marketplace. It is the bakery's own digital system, deployed under their name and brand.

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement |
|---|---|
| FR-01 | Customers register with Egyptian mobile phone number and a structured address (street, optional sub-street, building number or name, floor, apartment, famous landmark/sign, and optional free-text description). |
| FR-02 | Customers log in via phone number and password. |
| FR-03 | Customers can schedule or place orders across all seven days of the week, selecting any products from the full bakery catalog (breads, pastries, dairy, sweets) with custom quantities per day. |
| FR-04 | Customers can modify quantities or cancel Fino bread (`FINO_BREAD`) items in any scheduled/queued order before the configured daily cutoff time (default: 12:00 AM midnight) of that delivery day, receiving an instant wallet refund for cancelled Fino loaves. Non-fino bakery products are final sale upon order placement and cannot be cancelled by customers. |
| FR-05 | Customers place single-day or multi-day advance orders for any of the seven days of the week at any time before the configured daily cutoff time of that delivery day. |
| FR-06 | Customers can order any combination of bakery products in their basket. In open QUEUED orders before cutoff, customers can add new products or modify/cancel Fino bread items; non-fino items are committed and cannot be reduced or removed. |
| FR-07 | All orders are fulfilled via morning DELIVERY to the registered address (no in-store pickup). Delivery convenience fee is dynamic and configured exclusively by DEVELOPER / PLATFORM_OWNER. |
| FR-08 | Customers cancel any pure Fino `QUEUED` order before the configured daily cutoff time and receive an instant wallet refund (items + delivery fee). For mixed orders, customers can cancel only the Fino bread portion; non-fino items remain queued for delivery. |
| FR-09 | Zero-Input Top-Up UX: Customers top up their prepaid wallet exclusively via InstaPay through a single action: uploading a payment receipt screenshot. Customers never manually enter amounts, reference numbers, or transaction IDs. |
| FR-10 | Multimodal OCR Pipeline: The server utilizes the Gemini Vision API to automatically extract the transaction reference number, exact transferred amount (EGP), timestamp, and recipient handle from uploaded receipt screenshots. If extraction fails or confidence is too low, the system prompts for a clearer image without forcing manual input. |
| FR-11 | InstaPay Push Notification Reconciliation & InstaPayAlert Ledger: An immutable `InstaPayAlert` ledger (populated via push notifications intercepted by the Android listener on the bakery phone from the official InstaPay app package `com.egyptianbanks.instapay`) records official credit notifications. When a receipt is processed, the system queries `InstaPayAlert` by IPN reference number and amount. If matched, payment is instantly `APPROVED` and wallet credited atomically (< 3 seconds). In `AUTOMATED_NOTIFICATION` mode, unmatched or problematic receipts fall back to `PENDING_REVIEW` for bakery admin manual approval. |
| FR-12 | Anti-Fraud Golden Rule: No wallet balance is ever credited based solely on an uploaded screenshot. In `AUTOMATED_NOTIFICATION` mode, every wallet credit requires a 1-to-1 match against a verified, immutable `InstaPayAlert` entry from the official InstaPay app push notification stream, or an authorized manual Super Admin adjustment, or a bakery admin tap-to-approve in the review dashboard. |
| FR-13 | Problematic Receipt Admin Review: Receipts with ambiguous/blurry images, mismatched amounts, or no matching `InstaPayAlert` (phone temporarily offline or delayed) are NEVER silently dropped. They enter `PENDING_REVIEW` status; the customer UI displays "Receipt uploaded! Confirmation in progress…". The bakery admin dashboard (`/admin/payments/review`) shows the raw screenshot side-by-side with extracted data, allowing the owner to tap [Approve] or [Reject] manually. Rejected receipts history remains available at `/admin/payments?status=REJECTED`. |
| FR-13b | Operational Mode Toggle: A global `instapayReconciliationMode` configuration in `SystemConfig` controls reconciliation behavior. `AUTOMATED_NOTIFICATION` (default): system auto-matches by IPN reference number; unmatched receipts fall back to the pending admin queue. `MANUAL_BAKERY_ADMIN`: automated wallet crediting is completely paused; ALL uploaded receipts go directly to the bakery owner's dashboard for 1-tap approval/rejection. Toggle is available instantly in `/admin/settings`. |
| FR-14 | Super Admin / Developer Balance Adjustment: DEVELOPER / Super Admin can add or modify any customer's wallet balance for emergency resolutions. Every adjustment requires a mandatory reason and generates an immutable WalletAuditLog record. |
| FR-15 | Strict Prepaid Order Gating: Customers can only place or schedule orders if their wallet balance covers the total amount; the order total is deducted immediately upon order placement. No unpaid or held orders exist in the system. |
| FR-16 | Live Demand & Oven Production Manifest: Bakery admins can view requested/ordered products in real time (live or via refresh) throughout the day prior to cutoff. At the configured daily cutoff time, the manifest locks as the finalized production and runner delivery sheet sorted by address hierarchy. |
| FR-17 | Delivery runners access an offline-capable mobile run sheet that allows tapping "Delivered" with no network connectivity; the runner decides doorstep vs gate drop live on the street based on real-world access. |
| FR-18 | Bakery admins manually pause or reopen the daily order window gate in emergency situations from the admin dashboard. |
| FR-19 | Cron job dynamically enforces the configured daily cutoff time (default 12:00 AM midnight), transitioning QUEUED -> BAKING for that day's morning delivery and finalizing the production manifest. |
| FR-20 | Operational Timing & Dynamic Fees Separation: DEVELOPER / PLATFORM_OWNER exclusively configures dynamic platform fees (convenience fee, platform cut, labor/fuel splits). BAKERY_ADMIN configures operational time parameters (daily cutoff time, morning delivery windows, baking shift start). |
| FR-21 | The system prevents negative wallet balances at both database and application layers. |
| FR-22 | The system rejects any payment receipt whose reference number already exists in the database (or has already been reconciled), immediately and without admin review. |
| FR-23 | The PWA displays a live server-synced countdown timer showing time remaining until the dynamically configured cutoff for the upcoming morning's delivery. |
| FR-24 | Bakery admins batch-assign delivery orders to specific runners by order IDs or address range. |
| FR-25 | Order Mutation Wallet Validation: Any addition of items or quantity increases in an open order immediately validates and deducts the price difference from the wallet balance. If wallet balance is insufficient, the modification is blocked (400 INSUFFICIENT_WALLET). |
| FR-26 | Admin can view a Manifest Summary: aggregate counts across all bakery product SKUs and categories for both live pre-cutoff demand tracking and morning bake execution. |
| FR-27 | Customers view their full order history with per-order status, amounts, and item breakdowns. |
| FR-28 | Customers view their payment submission history with per-payment approval status, OCR extracted details, and rejection reasons. |
| FR-29 | Product Catalog Management: Bakery admins can add new products with image upload, title, description, category, piece vs weight-based pricing, and stock quantity. Supports both per-piece pricing (بالقطعة) and per-weight pricing (بالكيلو) with standard fractional increments (1/4 kg, 1/2 kg, 3/4 kg, 1 kg). |
| FR-30 | Product Lifecycle & Visibility Control: Each product is registered once; bakery admins can update any field (price, title, image, stock) at any time, or toggle visibility between AVAILABLE (active), SOLD_OUT (displayed with sold-out badge; unorderable), and HIDDEN (completely removed from customer catalog). |
| FR-31 | Real-Time Inventory Depletion: Customer orders dynamically decrement the product stock count/weight inside atomic checkout transactions. If stock reaches zero, the product automatically transitions to SOLD_OUT. Pre-cutoff cancellation stock recovery applies strictly to Fino bread. Non-fino inventory is permanently committed upon order placement to prevent stock reservation lockups. |
| FR-32 | Anti-Hoarding & Non-Fino Cancellation Restriction: The system strictly blocks customer cancellation or quantity reduction of any item outside the `FINO_BREAD` category (HTTP 400 `CANNOT_CANCEL_NON_FINO`), protecting the bakery against last-minute cancellation of limited inventory items. |

### 2.2 Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | Mobile-first PWA installable on Android Chrome on low-end devices. |
| NFR-02 | All DB timestamps stored in UTC. All local time evaluations use SystemConfig.timezone (IANA) — never hardcoded strings. |
| NFR-03 | All wallet mutations execute inside prisma.transaction atomic boundaries. Partial writes are impossible. |
| NFR-04 | Prices, quantities, and fees are never trusted from the client. All calculations use server-side DB lookups. |
| NFR-05 | Runner screen: offline-first IndexedDB queue that processes confirmations sequentially (FIFO) when connectivity restores. |
| NFR-06 | All order and wallet mutation endpoints require X-Idempotency-Key: UUID header to prevent duplicate actions on retry. |
| NFR-07 | Target < 1 second API response time on Neon free-tier PostgreSQL for all non-manifest queries. |
| NFR-08 | Platform is deployable to any Egyptian city or neighborhood by changing SystemConfig fields alone — no code changes. |
| NFR-09 | Client JS bundles remain minimal to support low-end Android Chrome. No heavy UI libraries. |
| NFR-10 | All API responses follow: { success: boolean, data?: T, error?: { code: string, message: string } }. |
| NFR-11 | Multimodal OCR extraction latency via Gemini Vision API target < 3.5 seconds; InstaPay push notification webhook ingestion and reconciliation processing < 500 ms; end-to-end wallet credit in `AUTOMATED_NOTIFICATION` mode < 3 seconds. |
| NFR-12 | The `InstaPayAlert` and `WalletAuditLog` tables are append-only and strictly immutable; no updates or deletes are permitted at application layer. |

---

## 3. Address Model

### 3.1 Unified Egyptian Address Structure

To accommodate all residential configurations in Egyptian neighborhoods (numbered street buildings, alleys, villas, and residential compounds) without rigid bifurcations, the system employs a single, unified address model. It captures structured location data for sorting and runner navigation while providing a free-text field for any edge-case descriptions:

| # | Field Name | DB Column | Type | Required | Description & Egyptian Context Examples |
|---|---|---|---|---|---|
| 1 | **Street** (الشارع الرئيسي) | `street` | String | **Yes** | Primary street, avenue, or main compound name. *Examples: "شارع سوريا", "شارع النصر", "شارع التسعين", "كمبوند جرين بلازا"* |
| 2 | **Sub-Street** (الشارع الفرعي) | `subStreet` | String | *Optional* | Side street, cross-street, alley, or compound phase/block (if applicable). *Examples: "متفرع من شارع العروبة", "حارة السلام", "المرحلة الثانية"* |
| 3 | **Building Number or Name** (رقم أو اسم العمارة) | `building` | String | **Yes** | Building number, tower name, or villa designation. *Examples: "14", "عمارة 25A", "برج الصفا والمروة", "Villa 7", "Townhouse 12"* |
| 4 | **Floor Number** (رقم الدور) | `floor` | String | *Optional* | Floor number or level. *Examples: "3", "الأرضي / Ground", "الميزانين"* (optional for standalone single-family villas) |
| 5 | **Apartment Number** (رقم الشقة) | `apartment` | String | *Optional* | Apartment number, office unit, or door code. *Examples: "5B", "شقة 12", "Apt 301"* (optional for standalone villas) |
| 6 | **Landmark / Famous Sign** (علامة مميزة) | `landmark` | String | *Optional* | Prominent sign, shop, mosque, or visible marker next to the building. *Examples: "بجوار صيدلية العزبي", "أمام سوبرماركت سعودي", "فوق بنك مصر", "بجوار المسجد الأخضر"* |
| 7 | **Additional Directions / Free-Text** (تفاصيل إضافية للعنوان) | `additionalDetails` | String | *Optional* | Open free-text field for the customer if the structured format cannot fully describe their location or entry instructions. *Examples: "المدخل الجانبي خلف البوابة الحديدية", "الباب الخشبي على اليمين بعد صالون الحلاقة", "يرجى تسليم الطلب لأمن البوابة"* |

### 3.2 Validation Rules (Zod)

- `street`: Non-empty string, min 2, max 100 characters.
- `subStreet`: Optional string, max 100 characters.
- `building`: Non-empty string, min 1, max 50 characters (accepts both digits and strings like "12A" or "برج الأمل").
- `floor`: Optional string, max 20 characters.
- `apartment`: Optional string, max 20 characters.
- `landmark`: Optional string, max 150 characters.
- `additionalDetails`: Optional string, max 300 characters.

### 3.3 Formatted Address Display

For runner run sheets, delivery receipts, and admin manifests, the system renders a clean, human-readable concatenated address string:

`
[street][, subStreet], [building], Floor: [floor], Apt: [apartment] | Landmark: [landmark] | Note: [additionalDetails]
`

*Concrete Examples:*
- **Urban Street Building:** `"شارع دمشق, متفرع من شارع سوريا, عمارة 14B, Floor: 3, Apt: 6 | Landmark: بجوار صيدلية العزبي"`
- **Compound Resident:** `"كمبوند ميفيدا, المرحلة 2 - بلوك C, Villa 15 | Landmark: أمام الحديقة المركزية | Note: يرجى تسليم الطلب لأمن البوابة"`
- **Complex Alley / Landmark-Based Address:** `"شارع المحطة, حارة الشيخ علي, منزل الحاج محمود, Floor: 1, Apt: 1 | Landmark: بجوار مسجد النور | Note: الباب الأخضر بجوار شجرة التين"`

### 3.4 Manifest Sort Order

Morning delivery orders on the Oven Production Manifest and runner run sheet are sequenced hierarchically:

```
1. street ASC
2. subStreet ASC NULLS FIRST
3. building ASC
4. floor ASC NULLS FIRST
5. apartment ASC NULLS FIRST
```

---

## 4. Operational Time Windows & Gate Flags

### 4.1 Design Principle: Dynamic Configuration Over Hardcoded Clocks

All operational timings in Mad-Bak are **dynamic configuration parameters** stored in `SystemConfig`. While platform-level infrastructure and financial commission parameters are strictly reserved for the software creator (**`DEVELOPER` / `PLATFORM_OWNER`**), the daily operational time windows are **fully configurable by the bakery owner (`BAKERY_ADMIN`)** via `/admin/config` to match their oven shift realities:

| Config Parameter | Default Value | Managed By | Description |
|---|---|---|---|
| `dailyCutoffTime` | `"00:00"` (12:00 AM) | `BAKERY_ADMIN` (or `DEVELOPER`) | Daily deadline for placing, modifying, or cancelling that morning's delivery orders. |
| `bakingStartTime` | `"00:30"` (12:30 AM) | `BAKERY_ADMIN` (or `DEVELOPER`) | Start of oven production shift based on locked manifest. |
| `runnerDispatchTime` | `"06:00"` (6:00 AM) | `BAKERY_ADMIN` (or `DEVELOPER`) | Runners pack sorted orders and depart bakery. |
| `deliveryWindowStart` | `"06:30"` (6:30 AM) | `BAKERY_ADMIN` (or `DEVELOPER`) | Start of morning doorstep delivery window. |
| `deliveryWindowEnd` | `"08:30"` (8:30 AM) | `BAKERY_ADMIN` (or `DEVELOPER`) | End of morning delivery window (before school/work). |
| `timezone` | `"Africa/Cairo"` | `DEVELOPER` only | IANA timezone used for all local time evaluations and cron jobs. |
| `instapayReconciliationMode` | `AUTOMATED_NOTIFICATION` | `BAKERY_ADMIN` (instant toggle in `/admin/settings`) | Controls how uploaded receipts are reconciled. `AUTOMATED_NOTIFICATION`: system auto-matches incoming InstaPay push notifications by IPN reference; unmatched receipts fall to `PENDING_REVIEW`. `MANUAL_BAKERY_ADMIN`: automated crediting fully paused; every receipt goes to owner 1-tap dashboard regardless of notification status. |

### 4.2 The 7-Day Window & Configurable Daily Cutoff Rule

The system provides complete ordering freedom across all **seven days of the week**:
- Customers can place, modify, or cancel orders for any day of the week (Saturday through Friday).
- Customers can schedule orders days in advance or order on the evening immediately preceding delivery.
- **Dynamic Daily Cutoff:** To receive an order on any given morning, the order must be placed or edited before the configured `dailyCutoffTime` (default: 12:00 AM midnight) of that delivery day.
  - *Example (using default 12:00 AM):* If a customer needs an order delivered on **Sunday morning**, they must place or modify it any time before **Sunday 12:00 AM** (i.e. Saturday night up to 11:59:59 PM).
  - Any order placed at or after the cutoff cannot be fulfilled for that morning; the earliest available delivery date becomes the following day.
- **No Product Restrictions on Ordering:** Orders are not limited to fino bread; customers can include any products from the full bakery catalog (fino, baladi, croissants, pastries, dairy, sweets, etc.).
- **Anti-Hoarding & Fino-Only Cancellation Policy:** While ordering is open to all products, **cancellations and quantity reductions before the cutoff are strictly restricted to Fino bread (`FINO_BREAD`)**. Non-fino items (pastries, sweets, traditional bread, dairy) are final sale upon order placement. This eliminates inventory hoarding where a customer could purchase all remaining stock of a limited item (forcing it to show `SOLD_OUT` all day to others) and cancel right before midnight when no other customer can buy it.

### 4.3 Gate Flag Reference

| Flag | Default | What It Controls |
|---|---|---|
| `isOrderWindowOpen` | `true` | Master cutoff gate for upcoming morning delivery. When false: no edits or new orders accepted for today's morning cycle; `QUEUED` orders transition to `BAKING`. |
| `isAdvanceOrderingOpen` | `true` | Controls whether customers can place/edit scheduled orders for future days beyond the immediate next morning. |

### 4.4 Default Operational Schedule & Cron Lifecycle

*(Note: Exact hours below represent default values; all trigger times evaluate dynamically from `SystemConfig`)*

| Event | Default Time (Cairo) | Trigger Mechanism | Action |
|---|---|---|---|
| Daily Order Cutoff | `dailyCutoffTime` (12:00 AM) | Dynamic Server Cron | Locks orders for today's delivery: batch transitions today's `QUEUED` -> `BAKING`; generates the Oven Production Manifest. |
| Morning Baking Shift | `bakingStartTime` (12:30 AM) | Operations | Bakers produce fresh bread and pastries based on finalized manifest. |
| Morning Runner Dispatch | `runnerDispatchTime` (6:00 AM) | Operations | Runners load sorted orders into delivery pouches/vehicles. |
| Morning Delivery Window | `deliveryWindowStart` – `deliveryWindowEnd` (6:30 – 8:30 AM) | Operations | Runners complete deliveries before households begin school and work. |

**Admin override:** The bakery admin can manually pause or reopen the daily order gate for emergency bake management (e.g. oven capacity reached, ingredient shortage).

**Cron fail-safe:** If the scheduled cron fails to trigger, the bakery admin sees the gate still open in their dashboard and can trigger the batch lock manually with one tap.

### 4.5 Customer-Facing Countdown Timer

The PWA displays a live server-synced countdown banner on the customer dashboard:

`
Time to order for tomorrow morning: 2h 45m   [Review Basket]
`

Reads from `/api/cutoffs/next`, dynamically calculating the remaining duration until `SystemConfig.dailyCutoffTime`. Refreshes every 60 seconds.

---

## 5. Order Lifecycle

### 5.1 Order Statuses (100% Home Delivery Model)

Mad-Bak operates exclusively as a **direct delivery service**. There is no in-store pickup or counter collection:

| Status | Description |
|---|---|
| `QUEUED` | Placed and active. Before daily cutoff, customer can add new items or modify/cancel Fino bread loaves. Non-fino items are committed upon placement and cannot be cancelled by customer. |
| `BAKING` | Locked at daily cutoff time. No mutations allowed. Manifest finalized for morning production. |
| `DISPATCHED` | Runner is en route during the morning delivery window. |
| `DELIVERED` | Runner confirmed successful drop. Drop-off execution (doorstep vs building/compound gate) is decided on the ground by the runner based on live street access, building security, and customer notes. |
| `CANCELLED_CREDITED` | Cancelled before the daily cutoff. Applicable to pure Fino orders (full refund of items + delivery fee) or manual admin cancellations. For mixed orders, Fino items are removed and refunded while non-fino items remain in `QUEUED`. |

> **Address Snapshot Rule:** At the moment an `Order` is created, the system copies all 7 address fields (`street`, `subStreet`, `building`, `floor`, `apartment`, `landmark`, `additionalDetails`) from the customer's `User` record directly onto the `Order` row as snapshot columns. Subsequent changes to the customer's profile address have no effect on existing or in-flight orders. The manifest and runner run sheet always read the snapshotted address stored on the `Order`.

### 5.2 State Transitions

```
DELIVERY:     QUEUED -> BAKING -> DISPATCHED -> DELIVERED
Cancellation: QUEUED -> CANCELLED_CREDITED  (Pure Fino orders only, before daily cutoff)
Partial Edit: QUEUED -> QUEUED (Fino loaves reduced/removed; delta credited back to wallet; non-fino items remain)
```

Customer attempts to cancel or reduce non-fino items return HTTP 400 `CANNOT_CANCEL_NON_FINO`. Any modification or cancellation attempt after the daily cutoff returns HTTP 400 `ORDER_LOCKED`.

---

## 6. User Roles & Authority Hierarchy

The platform implements a strict four-tier role hierarchy that clearly separates technical/financial control from daily bakery operations:

| Role | Target User | Authority & Scope |
|---|---|---|
| **`DEVELOPER`** *(Platform Owner / God-Mode / Super Admin)* | **Software Creator / Programmer** | **Highest authority in the system.** Exclusively controls all dynamic financial parameters (delivery convenience fees, platform cut, labor/fuel splits), multi-tenant deployment settings, system diagnostics, and direct database queries. **Emergency Balance Authority:** Can directly add or modify any customer's wallet balance (e.g. resolving cash disputes, telecom SMS failures, or test balance adjustments) with a mandatory audit reason. Holds system-level override capability over all operational parameters. Bakery owners have ZERO access to financial fee splits or wallet balance overrides. |
| **`BAKERY_ADMIN`** *(Bakery Owner / Operator)* | **Bakery Owner & Managers** | **Operational and catalog management.** Controls operational schedule timing parameters (`dailyCutoffTime`, `bakingStartTime`, `runnerDispatchTime`, `deliveryWindowStart`, `deliveryWindowEnd`); full product catalog management (adding products with image uploads, title, description, category, piece vs weight-based pricing [1/4, 1/2, 3/4, 1 kg], stock quantities; editing any product field; toggling visibility between `AVAILABLE`, `SOLD_OUT`, and `HIDDEN`; monitoring real-time inventory depletion); reviews pending payment receipts and inspects the historical audit log of rejected receipts (with OCR details and screenshots); views live demand preview and locked oven manifests; assigns orders to runners; emergency pause toggle for daily order gate. **Explicitly restricted from altering delivery fees, fee splits, or overriding customer wallet balances.** |
| **`RUNNER`** | **Delivery Staff** | Accesses assigned morning run sheet (`/ops/runner`); delivers orders; determines doorstep vs gate drop live based on real-time street access; taps to confirm delivery (`DISPATCHED -> DELIVERED`) with full offline sync. |
| **`CUSTOMER`** | **Neighborhood Household** | Account registration, address management, 7-day ordering & scheduling, order editing/cancellation before cutoff, zero-input wallet top-up via screenshot, and order tracking. |

---

## 7. Financial Model & Dynamic Fee Engine

### 7.1 Dynamic Pricing & Fee Ownership

A foundational principle of Mad-Bak is that **delivery fees and platform revenue splits are dynamic and controlled strictly by the software creator (`DEVELOPER` role)**. The local bakery owner (`BAKERY_ADMIN`) has zero authority to set, adjust, or view platform commission cuts or convenience fees.

| Fee / Item | Default Value | Authority / Configurator | Description |
|---|---|---|---|
| **Delivery Convenience Fee** | 5.00 EGP per delivery | **`DEVELOPER` exclusively** | Applied to every morning delivery order. 100% of orders are delivered to the registered address. |
| **Platform / Software Fee** | 2.50 EGP | **`DEVELOPER` exclusively** | Direct software revenue retained by the platform owner. |
| **Delivery Labor Pool** | 2.00 EGP | **`DEVELOPER` exclusively** | Allocated to runner compensation pool. |
| **Vehicle / Fuel Reserve** | 0.50 EGP | **`DEVELOPER` exclusively** | Reserve for delivery fleet maintenance and fuel. |
| **Minimum Wallet Top-Up** | 50.00 EGP | **`DEVELOPER` exclusively** | Minimum credit reload allowed per transaction. |
| **Bakery Product Catalog Prices** | Variable per item / fraction | `BAKERY_ADMIN` (Bakery Owner) | Configured per piece (e.g. 2.00 EGP fino) or per weight fraction (1/4 kg, 1/2 kg, 3/4 kg, 1 kg for biscuits, Kahk, sweets). |

*(Validation invariant: `platformFee + laborPoolFee + fuelReserveFee === convenienceFee`)*
*(Authority note: The `DEVELOPER` exclusively controls the dynamic platform fee split and emergency wallet balance adjustments. The `BAKERY_ADMIN` controls product catalog pricing, stock inventory, and daily operational timing windows).*

### 7.2 Developer Control Mechanisms

The `DEVELOPER` can modify these dynamic parameters at any time through two authorized channels:
1. **Developer Admin Console (`/admin/developer`):** A high-security, role-gated panel accessible exclusively with the `DEVELOPER` JWT role.
2. **Direct Database Queries / Environment Config:** Direct mutation of the `SystemConfig` singleton table (e.g. via Prisma Studio or SQL console).

The bakery owner's dashboard UI does not render fee inputs or commission split controls.

### 7.3 Zero-Input InstaPay Top-Up & Automated Ingestion Pipeline

To provide a seamless, error-free customer experience, Mad-Bak relies exclusively on **InstaPay** for wallet top-ups with a **Zero-Manual-Input** customer UX:

1. **InstaPay Exclusive:** All payments are transferred to the bakery's registered InstaPay IPA handle (e.g. `bakery@instapay` or mobile number). Card processors and payment aggregators (Paymob, Fawry) are deliberately excluded to eliminate 2–3% transaction fees and protect thin bakery margins.
2. **Zero-Input Customer UX:**
   - The customer never manually types reference numbers, amounts, or transaction IDs.
   - The top-up interface (`/wallet/topup`) presents the bakery's InstaPay handle with a 1-tap "Copy Handle" button, minimum top-up requirement, and a single primary action: **Upload Transfer Receipt Screenshot**.
3. **Automated Cloud Upload & Multimodal OCR Extraction:**
   - The client uploads the receipt screenshot to Cloudinary or ImageKit via the PWA, returning a secure CDN URL.
   - The server triggers the **Gemini Vision API** (multimodal OCR) with a strictly typed JSON schema prompt to extract:
     - `referenceNumber`: IPN Reference Number (InstaPay Reference ID).
     - `amount`: Exact transferred amount in EGP (numeric float).
     - `timestamp`: Date and time of transfer.
     - `recipientHandle`: Recipient address / handle shown on the receipt.
4. **Extraction Quality Assurance & Error Handling:**
   - The server validates extracted fields against the bakery's configured InstaPay address (`recipientHandle`) and minimum top-up amount (`amount >= minTopupAmount`).
   - If the screenshot is blurry, cropped, incomplete, or not an InstaPay receipt, the server **never silently drops or auto-rejects the receipt**. See Section 7.4 for the problematic receipt fallback flow.
   - **Crucial Rule:** The system **never falls back to manual digit entry** by the user. Integrity and speed depend on authentic screenshot processing.
5. **Android Push Notification Listener (Ground-Truth Source):**
   - A dedicated Android smartphone at the bakery runs a background listener that intercepts push notifications from the official InstaPay app package (`com.egyptianbanks.instapay`).
   - For each inbound credit notification, the listener extracts: **IPN Reference Number**, **Amount (EGP)**, **Timestamp**, and **Sender**, then immediately posts to `POST /api/webhooks/instapay-notification` authenticated with an `x-device-secret` header.
   - The server persists each notification as an append-only, immutable row in the `InstaPayAlert` table (`id`, `ipnReference`, `amount`, `sender`, `receivedAt`, `matchedPaymentId`, `isMatched`).

### 7.4 Notification-Verified Reconciliation, Problematic Receipt Fallback & The Anti-Fraud Golden Rule

While user input is frictionless and fully automated, the platform enforces strict notification-level financial controls:

#### The Anti-Fraud Golden Rule
> [!IMPORTANT]
> **No wallet balance is EVER credited based solely on an uploaded screenshot.** Screenshots can be altered, photoshopped, or fabricated. Every wallet credit requires either: (a) a 1-to-1 match against a verified, immutable `InstaPayAlert` entry originating directly from the official InstaPay app push notification stream (`com.egyptianbanks.instapay`), or (b) a bakery admin manual tap-to-approve in the review dashboard, or (c) an authorized manual Super Admin adjustment.

#### The InstaPayAlert Ledger & Android Push Notification Listener
- A dedicated Android smartphone at the bakery intercepts real-time push notifications from the official **InstaPay app** (`com.egyptianbanks.instapay`).
- The listener posts extracted fields to `POST /api/webhooks/instapay-notification` with `x-device-secret`:
  ```json
  {
    "ipnReference": "IPA1234567890",
    "amount": 250.00,
    "sender": "Ahmed Mohamed",
    "receivedAt": "2026-09-29T14:32:05Z"
  }
  ```
- The server stores this in an append-only, immutable `InstaPayAlert` table (`id`, `ipnReference`, `amount`, `sender`, `receivedAt`, `matchedPaymentId`, `isMatched`).

#### Operational Mode Toggle (`instapayReconciliationMode`)
The global `SystemConfig.instapayReconciliationMode` enum governs reconciliation behavior:

| Mode | Behavior |
|---|---|
| `AUTOMATED_NOTIFICATION` *(default)* | System automatically matches inbound InstaPay push notification to uploaded receipt by IPN reference number and credits wallet in real time (< 3 seconds). Unmatched or problematic receipts automatically fall back to the `PENDING_REVIEW` queue for bakery admin manual review. |
| `MANUAL_BAKERY_ADMIN` | Automated wallet crediting is **completely paused**. InstaPay push notifications are still logged to `InstaPayAlert` for bookkeeping, but **every uploaded receipt goes directly to the bakery owner's dashboard** for manual 1-tap approval or rejection — regardless of whether a matching notification exists. |

The bakery owner can switch modes instantly via a toggle in `/admin/settings` (e.g. when the listener phone is dead or the owner wants total manual control).

#### Dual-Path Reconciliation Flow (`AUTOMATED_NOTIFICATION` mode)
1. **Immediate Match (InstaPay notification arrived before or during upload):**
   - The server queries `InstaPayAlert` where `ipnReference = extracted.referenceNumber`, `amount = extracted.amount`, and `isMatched = false`.
   - If found: Inside an atomic transaction (`prisma.$transaction`):
     - `InstaPayAlert.matchedPaymentId` is set to `Payment.id`, `isMatched = true`.
     - `Payment.status` is set to `APPROVED`, `reconciledAt = NOW()`.
     - `User.walletBalance` is incremented by `amount`.
     - The customer receives instant visual confirmation on screen (< 3 seconds total).
2. **Problematic Receipt Fallback (Notification delayed, phone offline, or image issues):**
   - When any of the following apply: ambiguous/blurry image, inbound notification not yet received (phone temporarily offline or delayed), or amount/details mismatch:
     - The receipt is **NEVER silently dropped or auto-rejected**.
     - `Payment` is created with status `PENDING_REVIEW`, storing extracted OCR fields and screenshot URL.
     - Customer UI displays: *"Receipt uploaded! Confirmation in progress…"*
     - The problematic receipt appears in the bakery admin dashboard at `/admin/payments/review` with the **raw screenshot image side-by-side** with extracted data, allowing the bakery owner to tap **[Approve]** or **[Reject]** manually.
   - If a matching `InstaPayAlert` arrives later (phone came back online), the system auto-reconciles the `PENDING_REVIEW` payment to `APPROVED` and credits the wallet — no manual action required.

### 7.5 Bakery Admin Receipt Review Dashboard & Super Admin Overrides

#### Bakery Admin: Problematic Receipt Review Queue
- Bakery admins have full visibility into top-up operations at `/admin/payments`.
- A dedicated **Review Queue** at `/admin/payments/review` displays all receipts in `PENDING_REVIEW` status:
  - Customer name, phone number, and submission timestamp.
  - Raw receipt screenshot displayed **side-by-side** with OCR-extracted JSON data (IPN reference, amount, timestamp, recipient handle).
  - **[Approve]** — Atomic transaction: `Payment.status = APPROVED`, `User.walletBalance += amount`, `WalletAuditLog` entry written. Customer notified.
  - **[Reject]** — Requires selecting/typing a rejection reason; marks `Payment.status = REJECTED`; customer notified.
- A dedicated filter/tab **Rejected Receipts** (`/admin/payments?status=REJECTED`) displays all rejected submissions:
  - Customer name, phone number, and timestamp.
  - Rejection reason: `UNREADABLE_RECEIPT`, `DUPLICATE_REFERENCE`, `RECIPIENT_MISMATCH`, `AMOUNT_TOO_LOW`, or admin manual rejection.
  - OCR extracted metadata vs expected values.
  - High-resolution receipt screenshot thumbnail with zoom capability.
- Allows the bakery admin to quickly assist customers who call about a receipt issue.

#### Super Admin / Developer Emergency Balance Adjustment
- For exceptional edge cases (e.g. telecom outage dropping a bank SMS permanently, customer settling in physical cash directly at the bakery, or resolving customer disputes), the **`DEVELOPER` / Super Admin** role possesses god-mode balance modification authority:
- Console at `/admin/developer/wallets`:
  - Search customer by phone number.
  - View current `walletBalance` and transaction history.
  - Execute balance adjustment (`+/- EGP`).
  - **Mandatory Reason Field:** Submission is blocked without an explicit justification note.
  - Every adjustment writes an append-only record to `WalletAuditLog` (`id`, `adminId`, `customerId`, `previousBalance`, `newBalance`, `delta`, `reason`, `createdAt`).

### 7.6 Wallet & Refund Rules

- **Upfront Prepaid Gating (Zero Held Orders):** Customers cannot place or schedule any order without sufficient wallet balance (`walletBalance >= order.totalAmount`). The full order total is deducted from `walletBalance` immediately at checkout. If balance is insufficient, order creation is blocked with HTTP 400 `INSUFFICIENT_WALLET`. There is no concept of "held" or unpaid orders; every `QUEUED` order is 100% pre-paid and guaranteed.
- Wallet balance never drops below 0.00 EGP (enforced at DB and application layer).
- All cancellations made before the daily cutoff receive an instant atomic refund of `order.totalAmount` (items + delivery fee) credited back to `walletBalance` — never as external cash transfers.
- **Pre-Cutoff Order Modifications:** If a customer adds items or increases quantities before cutoff, the price delta is deducted immediately from `walletBalance`; if insufficient, the edit is blocked. If quantities are decreased, the difference is refunded immediately to `walletBalance`.
- Price snapshots: `OrderItem.unitPrice` and `deliveryFee` are locked at order creation. Future price changes do not retroactively affect existing orders.

---

## 8. User Interface Design Goals

### 8.1 Overall UX Vision

A fast, clean, Arabic-legible interface that feels like the bakery itself: warm, reliable, and local. Customers can place an order for tomorrow morning or schedule their baskets across all 7 days of the week in under 30 seconds. 100% of orders are delivered to homes; runners mark morning drops done with a single thumb tap.

### 8.2 Core Screens

**Customer App**

| Screen | Route | Primary Purpose |
|---|---|---|
| Login | /login | Phone + password sign-in |
| Register | /register | New customer onboarding with 7-field Egyptian address capture |
| Home / Dashboard | / | Tomorrow morning's delivery summary, wallet balance, dynamic cutoff countdown, quick-order CTA |
| 7-Day Order Planner | /planner | Interactive 7-day selector to view, schedule, or edit morning delivery baskets with full catalog products |
| Order Detail & Editor | /orders/[id] | Edit items, adjust quantities, or cancel before the daily cutoff |
| Bakery Product Catalog | /products | Browse full bakery offerings by category (Breads, Pastries, Dairy, Sweets) with instant "Add to Day" action |
| Order History | /orders | All past delivery orders with status badges and quick re-order CTA |
| Wallet | /wallet | Balance display, top-up history, Top Up CTA |
| Top-Up Flow | /wallet/topup | Single-action InstaPay screenshot upload with 1-tap copy of bakery handle, real-time OCR extraction, and instant reconciliation status |

**Admin Dashboard (Bakery Owner — `BAKERY_ADMIN`)**

| Screen | Route | Primary Purpose |
|---|---|---|
| Payment Queue | /admin/payments | Review all payment submissions; tabs for Pending Review, Rejected, and Approved |
| Receipt Review Dashboard | /admin/payments/review | Problematic receipts (`PENDING_REVIEW`): raw screenshot side-by-side with OCR data; [Approve] / [Reject] 1-tap actions |
| Rejected Receipts Log | /admin/payments?status=REJECTED | Full audit log of rejected submissions with OCR metadata, rejection reason, and screenshot zoom |
| Oven Manifest | /admin/manifest | Date-picker -> sorted morning production table |
| Manifest Summary | /admin/manifest/summary | Aggregate product SKU totals for the morning bake |
| Gate Controls | /admin/controls | Manual emergency pause/reopen of the daily order window |
| Product Catalog Mgmt | /admin/products | Full catalog lifecycle: add product with image upload, name, description, piece/weight pricing (1/4, 1/2, 3/4, 1 kg), stock quantity; in-place edit of all fields; toggle visibility (`AVAILABLE`, `SOLD_OUT`, `HIDDEN`) |
| Operational Schedule & Profile | /admin/config | Control daily operational schedule (`dailyCutoffTime`, `bakingStartTime`, `runnerDispatchTime`, `deliveryWindowStart`, `deliveryWindowEnd`), bakery profile display name, and neighborhood |
| Customer Management | /admin/customers | View all registered customers; search by phone; view pending password reset requests and generate reset links (1-tap copy); edit customer phone number after identity verification |
| System Settings | /admin/settings | Instant toggle for `instapayReconciliationMode` (`AUTOMATED_NOTIFICATION` ↔ `MANUAL_BAKERY_ADMIN`); use when listener phone is offline or owner wants full manual control |

**Developer God-Mode Console (`DEVELOPER` Role Only)**

| Screen | Route | Primary Purpose |
|---|---|---|
| Developer Financial Console | /admin/developer/fees | Dynamic control of convenience fee, platform cut, labor/fuel split, min top-up |
| Emergency Balance Console | /admin/developer/wallets | Super Admin emergency customer wallet balance adjustments with mandatory audit log |
| System Infrastructure & DB | /admin/developer/system | Direct query interface, migration logs, system timezone, multi-tenant deployment switcher, emergency schedule overrides |

**Runner Operations**

| Screen | Route | Primary Purpose |
|---|---|---|
| Run Sheet | /ops/runner | Assigned morning delivery list, offline-capable tap-to-confirm |

### 8.3 Design Principles

- Mobile-first, RTL-compatible layouts. Primary customer device is a mid-range Android phone.
- No heavy UI libraries. Keep bundles minimal. Tailwind CSS utility classes only; no component library frameworks (e.g. no Material UI, Chakra UI, or Radix UI).
- Status color coding: QUEUED (blue), BAKING (orange), DISPATCHED (purple), DELIVERED (green), CANCELLED_CREDITED (gray).
- The production lock countdown is a persistent banner, never hidden below the fold.
- WCAG AA compliance. Large tap targets (minimum 44x44px) for runner screen delivery buttons.

---

## 9. Technical Assumptions

| Parameter | Decision | Rationale |
|---|---|---|
| Framework | Next.js App Router + TypeScript | SSR, co-located API routes, Vercel-native deployment |
| Styling | Tailwind CSS | Utility-first, minimal bundle overhead |
| Database | PostgreSQL via Prisma ORM (Neon free tier) | Relational integrity, Prisma transactions for ledger |
| Auth | JWT in HTTP-only cookies | Stateless, no external auth provider dependency |
| Storage | Cloudinary or ImageKit (free tier) | Receipt screenshot hosting, CDN-delivered |
| OCR | Google Gemini Multimodal Vision (gemini-1.5-flash / gemini-2.0-flash) | Structured JSON extraction: referenceNumber, amount, timestamp, recipientHandle |
| InstaPay Sync | Android Push Notification Listener on bakery phone (package: `com.egyptianbanks.instapay`) | Real-time InstaPay push notification interceptor posting extracted IPN reference, amount, timestamp, and sender to `POST /api/webhooks/instapay-notification` with `x-device-secret` for the `InstaPayAlert` ledger |
| Cron | Vercel cron + GitHub Actions fallback | Serverless-native scheduling |
| Offline Sync | IndexedDB via idb library | Runner screen offline queue (FIFO) |
| Deployment | Vercel Hobby (free) | Zero-cost at MVP scale |

---

## 10. Epics & Detailed User Stories

---

### Epic 1: Foundation & Authentication

**Goal:** Establish authentication, registration, and address capture flow.

---

#### Story 1.1 — Customer Registration

**As a** new household customer, **I want to** register with my phone number and home address **so that I can** receive morning bakery deliveries.

**Acceptance Criteria:**
- Form collects: `fullName`, `phone` (01X-XXXX-XXXX format), `password`, and structured address fields:
  1. `street` (required): Primary street name, avenue, or main compound name.
  2. `subStreet` (optional): Side street, cross street, alley, or compound phase/block (if applicable).
  3. `building` (required): Building number, tower name, or villa designation (accepts numbers or names like "12A" or "برج الرواد").
  4. `floor` (required): Floor number (for standalone villas is 0).
  5. `apartment` (required): Apartment number (for standalone villas is 0).
  6. `landmark` (optional): Famous sign or landmark next to the building.
  7. `additionalDetails` (optional): Free-text field if the previous structure cannot fully describe the address or entrance directions.
- Password: minimum 8 characters, at least 1 letter + 1 number.
- Phone must be globally unique.
- Password stored as bcrypt hash.
- On success: JWT HTTP-only cookie (30-day expiry) + redirect to home dashboard.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Phone already registered | 400 PHONE_TAKEN — "This phone number is already registered. Try logging in." |
| Password too short or missing number | Inline Zod validation error before form submit; no server call made |
| street left empty | 400 STREET_REQUIRED — "Street name is required." |
| building left empty | 400 BUILDING_REQUIRED — "Building number or building name is required." |
| Network timeout during submission | Client retries with same X-Idempotency-Key; server checks for existing user by phone before inserting |
| Phone entered with spaces or dashes | Client normalizes to digits-only before submission |

---

#### Story 1.2 — Customer Login

**As a** registered customer, **I want to** log in with my phone and password **so that I can** access my orders, planner, and wallet.

**Acceptance Criteria:**
- Form: phone number + password.
- Success: JWT HTTP-only cookie (30-day session) + redirect to dashboard.
- Failure: generic message "Invalid phone number or password." (never reveal which field is wrong).
- "Forgot password?" link below the form.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Wrong password 5 times in 15 minutes | 429 RATE_LIMITED — "Too many attempts. Try again in 15 minutes." |
| Phone not registered | Same generic failure message (no account enumeration) |
| Session cookie expired | Redirect to /login?expired=1; show banner "Your session expired. Please log in again." |
| Two devices logged in simultaneously | Both sessions valid; JWT is stateless |
| Admin or Runner logs in from /login | Same endpoint; role-based redirect after login (BAKERY_ADMIN -> /admin, RUNNER -> /ops/runner) |

---

#### Story 1.3 — Password Reset via Admin-Generated Link

**As a** customer who forgot their password, **I want to** request a password reset link from the bakery **so that I can** regain access without requiring SMS or email.

> **Design Rationale (No-SMS Alternative):** Instead of sending OTPs via a paid SMS gateway, the bakery admin generates a single-use, time-limited reset token in one tap and shares the resulting URL verbally, via personal WhatsApp, or written on a note. This is free, requires zero third-party integrations, and is perfectly suited to the hyper-local bakery context where customers already have a direct relationship with the owner.

**Acceptance Criteria:**
- Customer taps "Forgot password?" on the login screen and enters their registered phone number.
- If the phone is found, the system generates a **time-limited (30-minute), single-use reset token** (random UUID stored in `PasswordResetToken` table with `isUsed = false`, `expiresAt = NOW() + 30min`) and shows the confirmation screen: *"Request received! Contact the bakery to get your reset link."*
- The bakery admin sees **pending reset requests** in `/admin/customers` (customer name, phone, request timestamp). Tapping **[Generate Reset Link]** copies a unique one-time URL (`/reset-password?token=<uuid>`) to clipboard.
- Admin shares the URL with the customer via personal WhatsApp message, phone call, or in person — no programmatic sending required.
- Customer opens the reset URL in their browser, enters and confirms a new password.
- On success: new JWT HTTP-only cookie issued; all prior sessions invalidated; token marked `isUsed = true` (permanently consumed).

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Phone not registered | Silent success — "If this number is registered, contact the bakery to get your reset link." (no account enumeration) |
| Reset link opened after 30 minutes | 400 OTP_EXPIRED — "This reset link has expired. Please ask the bakery to generate a new one." |
| Reset link used a second time | 400 OTP_USED — "This link has already been used. Request a new one from the bakery." |
| Admin generates new token while a previous unexpired one exists | Previous token immediately invalidated (`isUsed = true`); only the newest token is valid. |
| Customer cannot reach the bakery immediately | Token is valid for 30 minutes; customer can contact bakery any time within that window. Admin can regenerate at any time. |

---

#### Story 1.4 — Profile & Address Update

**As a** logged-in customer, **I want to** update my name and address **so that** deliveries reach my current home.

**Acceptance Criteria:**
- Editable fields: `fullName`, and all 7 address fields (`street`, `subStreet`, `building`, `floor`, `apartment`, `landmark`, `additionalDetails`).
- Phone number is **not self-editable** by the customer. To change their registered phone number, the customer contacts the bakery; a `BAKERY_ADMIN` or `DEVELOPER` updates the phone in `/admin/customers/{id}/edit` after verifying the customer's identity. The old phone number is released immediately upon save.
- Password change requires entering the current password first.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Customer changes address after today's order was locked (BAKING) | Address on User record updates for future orders. Locked morning order retains its original snapshotted address on the manifest. |
| Customer clears building or street | 400 BUILDING_REQUIRED / 400 STREET_REQUIRED — Mandatory address fields cannot be cleared. |

---

### Epic 2: 7-Day Flexible Ordering & Scheduling

**Goal:** Allow customers to schedule, adjust, or pause orders across all seven days of the week for any bakery products, with a configurable daily cutoff (default: 12:00 AM midnight) for morning delivery.

---

#### Story 2.1 — 7-Day Order Planner & Advance Scheduling

**As a** customer, **I want to** view all 7 days of the week and schedule orders for any day(s) with any bakery products (fino, other breads, pastries, dairy, sweets), **so that I can** ensure morning breakfast delivery to my home without a rigid weekly package.

**Acceptance Criteria:**
- Interactive 7-day selector showing all days of the week (Saturday through Friday).
- Customer can choose any day or combination of days (from a single day to daily recurring).
- Per active day: customer selects any items from the bakery catalog with desired quantities (no bread-only or fino-only restriction).
- All scheduled orders are fulfilled via morning doorstep delivery to the user's registered address.
- Advance orders can be scheduled days ahead or placed on the evening right before delivery.
- **Configurable Daily Cutoff Rule:** Changes for any specific delivery day can be saved or edited any time before the configured daily cutoff time (default: 12:00 AM midnight) of that delivery day.
- Scheduled orders are created in `QUEUED` status.
- **Strict Prepaid Gate:** Customer cannot confirm or schedule any order without sufficient wallet balance (`walletBalance >= order.totalAmount`). The full order amount is deducted from `walletBalance` immediately upon order creation.
- Countdown timer to the next daily cutoff is prominently displayed.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Customer attempts to schedule/save order for tomorrow after the daily cutoff | 400 ORDER_LOCKED — "The cutoff for tomorrow morning has passed. Earliest delivery date is now {nextDay}." |
| Day selected with 0 items in basket | 400 EMPTY_BASKET — "Please add at least one item to your basket for this day." |
| Customer edits an existing scheduled order before cutoff | Upsert/update: items, quantities, and totals updated in `QUEUED` order; wallet balance recalculated. |
| Customer attempts to place or schedule order with insufficient wallet balance | 400 INSUFFICIENT_WALLET — Order placement blocked; user is prompted to top up their wallet first. |
| User orders exclusively pastries or dairy (no fino) | Allowed; system permits any mix of catalog products. "Fino to Home" is a marketing hook, not a system restriction. |

---

#### Story 2.2 — Modify Upcoming Order Before Cutoff

**As a** customer, **I want to** adjust item quantities or add products before the daily cutoff **so that I can** adapt to changing family breakfast needs.

**Acceptance Criteria:**
- Allowed only while order status is `QUEUED` and server time is before the configured daily cutoff time of that order's delivery day.
- Customer can add, increase, decrease, or remove any catalog items.
- Server recalculates item total and delivery fee, validating wallet coverage.
- If modification increases order total and exceeds available wallet balance: 400 INSUFFICIENT_WALLET.
- If modification decreases order total: price difference is refunded immediately to `walletBalance`.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Quantities reduced to 0 items | 400 EMPTY_BASKET — "Order must contain at least 1 item. Use the Cancel button to cancel this delivery." |
| Modification attempted after daily cutoff of delivery day | 400 ORDER_LOCKED — "Order is locked and currently being prepared in the bakery for morning delivery." |
| Added product went out of stock during session | 400 PRODUCT_UNAVAILABLE — Server validates current stock inside transaction. |
| Double-tap submission | Handled via X-Idempotency-Key; second request returns cached 200 response without duplicate charges. |

---

#### Story 2.3 — Cancel Delivery & Fino-Only Cancellation Policy (Anti-Hoarding Rule)

**As a** customer traveling or eating outside, **I want to** cancel or reduce my fino bread before the daily cutoff and receive an instant wallet refund, **while understanding that** non-fino bakery products are final commitments upon order placement to prevent stock hoarding.

**Acceptance Criteria:**
- **Anti-Hoarding Domain Rationale:** Non-fino products (pastries, croissants, sweets, dairy, cakes) have finite batch quantities. If customers could reserve limited stock and cancel at 11:59 PM before the cutoff, other customers would be prevented from purchasing them all day, leaving the bakery with unsold, unrecoverable inventory. Fino bread, conversely, is baked on-demand in mass batches after midnight based on finalized demand, so fino cancellations incur zero wasted stock or hoarding penalty.
- **Three Order Cancellation Scenarios:**
  1. **Pure Fino Orders (Order contains only `FINO_BREAD` items):**
     - Customer can tap "Cancel Order" or "Skip Day" on any `QUEUED` order before the daily cutoff.
     - Confirmation dialog displays full refund amount (items + delivery fee).
     - On confirm: `order.status` -> `CANCELLED_CREDITED`, full amount atomically refunded to `User.walletBalance`. Fino stock restored.
  2. **Mixed Orders (Order contains Fino bread + Non-Fino items):**
     - Customer **can** reduce quantity or remove the Fino bread items before cutoff.
     - Customer **cannot** remove or cancel the non-fino items.
     - On removing Fino items: Wallet is credited atomically for the Fino loaf price difference; Fino stock restored.
     - The order remains active in `QUEUED` status with the non-fino items and delivery convenience fee (morning delivery will proceed).
     - If the customer attempts to cancel the entire order, the UI displays: *"This order contains non-fino products (e.g. croissants/sweets) which cannot be cancelled once ordered. You can remove your fino bread, but non-fino items will be delivered."*
  3. **Pure Non-Fino Orders (Order contains zero `FINO_BREAD` items):**
     - "Cancel Order" action is disabled/hidden. Tooltip and banner state: *"Orders containing only non-fino items cannot be cancelled once placed."*
     - Any direct API call to cancel returns HTTP 400 `CANNOT_CANCEL_NON_FINO`.
- If part of a recurring 7-day schedule, only that specific day's eligible Fino items are cancelled; future scheduled days remain active.
- Admin Override: A `BAKERY_ADMIN` or `DEVELOPER` can manually cancel non-fino items in emergency situations from `/admin/manifest`.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Customer attempts to cancel order containing non-fino items | System blocks cancellation with 400 `CANNOT_CANCEL_NON_FINO`. UI guides customer to cancel only fino items if present. |
| Customer reduces fino loaves from 10 to 5 before cutoff | Allowed. 5 loaves refunded to wallet atomically; fino stock incremented by 5; order remains active. |
| Customer attempts to reduce croissant quantity from 4 to 2 | 400 `CANNOT_CANCEL_NON_FINO` — "Non-fino items cannot be reduced or cancelled after order placement." |
| Cancel attempt after daily cutoff | 400 `ORDER_LOCKED` — "Order is locked for baking and cannot be cancelled." |
| Order already cancelled (double tap) | First call succeeds; second returns 400 `ALREADY_CANCELLED` with no double credit. |
| Pure fino order cancelled before cutoff | Status -> `CANCELLED_CREDITED`; full refund of items + delivery fee to wallet. |

---

#### Story 2.4 — Upfront Payment Deduction & Pre-Funded Checkout

**As a** bakery and customer, **I want** all orders to be fully paid upfront from the customer's wallet at the moment of placement **so that** operations are 100% pre-funded and zero unpaid/held orders exist.

**Acceptance Criteria:**
- Placing or scheduling any order requires `User.walletBalance >= order.totalAmount`.
- When order is placed, an atomic transaction deducts `order.totalAmount` from `User.walletBalance` and creates the `DailyOrder` record with status `QUEUED`.
- If `User.walletBalance < order.totalAmount`: Server returns HTTP 400 `INSUFFICIENT_WALLET` — *"Your wallet balance ({balance} EGP) is insufficient for this order ({totalAmount} EGP). Please top up your wallet to place this order."* The order is not created and is never placed on hold.
- When the daily cutoff time is reached: All `QUEUED` orders transition directly to `BAKING` without requiring any secondary balance checks or holding states.
- If an order is cancelled before cutoff, `order.totalAmount` is refunded atomically back to `User.walletBalance`.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Customer selects multiple delivery days with insufficient balance for all | System validates total cost for the transaction. If balance cannot cover all selected days, checkout is blocked with 400 `INSUFFICIENT_WALLET`. |
| Customer wallet balance reaches exactly 0.00 EGP after checkout | Allowed. Wallet balance cannot drop below 0.00 EGP. |
| Customer cancels order before daily cutoff | Instant atomic refund of items + delivery fee credited back to walletBalance (`CANCELLED_CREDITED`). |

---

#### Story 2.5 — Copy Day Basket to Other Days

**As a** customer, **I want to** copy my basket from one selected day to other days in the 7-day planner with a single tap **so that I can** quickly set up recurring orders without re-entering the same items for each day.

**Acceptance Criteria:**
- On any active `QUEUED` order card in the 7-day planner, a **"Copy to other days"** (`نسخ لأيام أخرى`) action button is visible.
- Tapping it opens a multi-select day picker showing the remaining 6 days of the current 7-day window. Days whose daily cutoff has already passed are greyed out and unselectable.
- Customer selects any subset of target days and taps **[Confirm Copy]**.
- For each selected target day the server validates independently:
  1. The target day's `dailyCutoffTime` has not yet passed.
  2. The customer's current `walletBalance` covers the copied order total for that day.
  3. All products in the basket are still `AVAILABLE` with sufficient `stockQuantity`.
- **Target day has no existing order:** A new `QUEUED` order is created with an identical basket; the total is deducted from wallet atomically; inventory is decremented.
- **Target day already has an existing `QUEUED` order:** The system **does not overwrite** it. That day is silently skipped and included in the "Skipped" summary.
- Each successful copy is an independent atomic transaction per day. A failure on one target day does not roll back successful copies already made for other days.
- A summary screen is displayed after the operation: **Created** (list of days), **Skipped — already has order** (list), **Rejected** (list with reason: cutoff passed / insufficient wallet / out of stock).

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Wallet balance covers only some target days | Server processes days in the order selected; stops creating orders once wallet is exhausted. Summary screen shows which days succeeded and which failed with `INSUFFICIENT_WALLET`. |
| A product in the basket went out of stock between selection and confirmation | 400 `INSUFFICIENT_STOCK`; copy aborted for all remaining target days. Customer prompted to modify source basket and retry. |
| All selected target days already have active orders | No new orders created; customer sees: "All selected days already have active orders." |
| Customer selects only one target day | Behaves identically to placing a new order for that day; same wallet deduction and stock check. |
| Source order is modified while copy is in progress | Server always reads basket items from DB at transaction time; any edits made between UI render and submit are reflected. |

---

### Epic 3: Daily Orders & Morning Delivery

**Goal:** Manage the daily order lifecycle from the dynamic cutoff through morning baking, dispatch, and delivery.

---

#### Story 3.1 — View Upcoming Morning Order & Cutoff Countdown

**As a** customer, **I want to** view my upcoming morning order summary and cutoff countdown on the dashboard **so that I am** confident my breakfast is scheduled.

**Acceptance Criteria:**
- Dashboard prominently displays tomorrow morning's `QUEUED` order: list of items with quantities, total amount, delivery address, and live countdown timer to the dynamic daily cutoff.
- If no order is scheduled for tomorrow morning: shows "No delivery scheduled for tomorrow morning" with a prominent "Order for Tomorrow" CTA.
- If past the daily cutoff: displays locked status (`BAKING`, `DISPATCHED`, or `DELIVERED`).

---

#### Story 3.2 — Quick Order for Tomorrow Morning

**As a** customer needing breakfast tomorrow, **I want to** place a quick order any time before the daily cutoff **so that I** receive fresh bakery goods tomorrow morning.

**Acceptance Criteria:**
- Customer can place an order for the immediate next morning at any time before the daily cutoff time (e.g. 10:30 PM for next morning).
- Customer selects items from the complete bakery catalog (fino, pastries, dairy, sweets).
- Wallet balance validated; total (items + dynamic delivery fee) deducted atomically on order placement.
- Order assigned `QUEUED` status with editable window until the daily cutoff.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Placement attempt after daily cutoff | 400 ORDER_LOCKED — "Orders for this morning are closed. Next available delivery is {tomorrow}." |
| Insufficient wallet balance at placement | 400 INSUFFICIENT_WALLET — Shows missing amount and directs to Top Up flow. |
| Wallet covers items but not the delivery fee | 400 INSUFFICIENT_WALLET — Prompts to top up wallet to cover delivery. |

---

#### Story 3.3 — Cancel Tomorrow's Order Before Cutoff (Fino-Only Rule)

**As a** customer, **I want to** cancel tomorrow morning's fino loaves before the daily cutoff and receive an instant wallet refund **so that I** have breakfast flexibility, while non-fino items remain committed.

**Acceptance Criteria:**
- Allowed only while status = `QUEUED` and time < daily cutoff (`dailyCutoffTime`).
- **Pure Fino Orders:** Instant atomic credit of `order.totalAmount` (loaves + delivery fee) back to `User.walletBalance`; status updated to `CANCELLED_CREDITED`; fino stock restored.
- **Mixed Orders:** Customer can cancel/remove fino loaves only; wallet credited for fino loaf difference; non-fino items remain queued for delivery.
- **Pure Non-Fino Orders:** Cancellation blocked with HTTP 400 `CANNOT_CANCEL_NON_FINO`.

---

#### Story 3.4 — Track Morning Delivery Status

**As a** customer waking up in the morning, **I want to** check my order status **so that I** know when my bread and pastries are on their way or dropped at my home.

**Acceptance Criteria:**
- Status updates in real time:
  - `BAKING`: In oven / packaging during the early morning shift.
  - `DISPATCHED`: Runner en route during the configured delivery window.
  - `DELIVERED`: Runner confirmed delivery drop. Drop-off execution (doorstep or building/compound gate) is decided on the ground by the runner based on real-time street access and customer notes.

---

### Epic 4: Full Bakery Catalog & Flexible Basket

**Goal:** Enable bakery admins to manage their complete product catalog with images, descriptions, piece/weight pricing, and stock quantities, while allowing customers to order freely across all bakery items with real-time inventory tracking.

---

#### Story 4.1 — Browse Full Bakery Product Catalog

**Acceptance Criteria:**
- Catalog loaded from `/api/products` for all non-hidden items (`visibility != 'HIDDEN'`).
- Displays product image, Arabic title, English title, description, category, pricing model, and stock badge.
- **Pricing Models Displayed:**
  - **Per Piece (`PER_PIECE`):** Displays unit price (e.g. `2.50 EGP / piece`).
  - **Per Weight (`PER_WEIGHT`):** Displays base price per 1 kg (e.g. `200.00 EGP / kg`) alongside fractional price options: 1/4 kg (50 EGP), 1/2 kg (100 EGP), 3/4 kg (150 EGP), and 1 kg (200 EGP).
- **Stock Badges & Availability:**
  - If `status = 'AVAILABLE'` and `stockQuantity > 0`: Customer sees "In Stock" and active quantity selector / "Add to Basket" CTA.
  - If `status = 'SOLD_OUT'` or `stockQuantity = 0`: Product displays a high-visibility "Sold Out" (`نفد من المخزن`) badge; "Add to Basket" button is disabled.
  - If `status = 'HIDDEN'`: Product is completely omitted from the catalog response and invisible to customers.
- Categories include:
  - `FINO_BREAD`: Standard Fino, Large Fino, Bran Fino. (Hero category for "Fino to Home" marketing campaign).
  - `TRADITIONAL_BREAD`: Baladi bread, Shami bread, toast, whole wheat.
  - `PASTRY`: Croissants, Pâtés, Feteer Meshaltet, Danish, Cinnamon Rolls.
  - `DAIRY`: Cheeses, fresh milk, Greek yogurt, butter.
  - `SWEETS_AND_DRY`: Tea biscuits, Petit Four, Kahk, Basbousa, Barazek (frequently sold per 1/4, 1/2, 3/4, or 1 kg).
- Fast search bar and instant category filtering tabs.

---

#### Story 4.2 — Unified Multi-Product Basket & Unit Selection

**As a** customer, **I want to** combine piece-based and weight-based bakery products into my basket **so that I** get everything my household needs for breakfast in one delivery.

**Acceptance Criteria:**
- Basket supports any combination of items: bread loaves, pastries, dairy, or fractional weight sweets.
- **Unit Selection Mechanics:**
  - For `PER_PIECE` items: Customer selects integer quantity (1, 2, 3...) using + / - steppers.
  - For `PER_WEIGHT` items: Customer selects fractional weight option: 1/4 kg (0.25 kg), 1/2 kg (0.50 kg), 3/4 kg (0.75 kg), or 1 kg multiples (e.g. 1.25 kg, 1.50 kg, 2.00 kg).
- Unit prices locked at insertion time on `OrderItem.unitPrice` and `OrderItem.pricingUnit` (`PIECE`, `QUARTER_KG`, `HALF_KG`, `THREE_QUARTERS_KG`, `KG`).
- Total basket amount calculated as: $\sum (\text{itemPrice} \times \text{fractionOrCount}) + \text{convenienceFee}$.
- All item modifications obey the configurable daily cutoff time (default: 12:00 AM midnight).
- **Non-Fino Commitment Disclaimer:** Each non-fino product card and basket line item clearly displays a commitment badge: *"Final sale — Non-cancellable once ordered"* (`طلب مؤكد لا يمكن إلغاؤه`). The checkout review modal reminds the customer: *"Fino bread can be cancelled before cutoff; non-fino items are committed upon ordering to prevent stock reservation lockup."*

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Product stock reaches 0 before customer checks out | 400 `INSUFFICIENT_STOCK` — Checked inside atomic transaction at checkout; displays notice to customer. |
| Customer adds 1/4 kg of biscuits | Price computes as `pricePerKg * 0.25`; item saved with fractional quantity 0.25. |
| Customer sets item quantity to 0 in unplaced cart | Item removed from basket; order total recalculated. |
| Customer attempts to reduce non-fino item in placed order | 400 `CANNOT_CANCEL_NON_FINO` — Only fino bread items can be reduced/cancelled in placed orders. |
| Product price updated by bakery admin | Existing placed orders retain snapshotted price; new additions use new price. |

---

#### Story 4.3 — Admin Product Registration with Image & Piece/Weight Pricing

**As a** bakery admin (`BAKERY_ADMIN`), **I want to** add new bakery products with an image, title, description, pricing type (per piece or per weight), price, and stock quantity **so that** my bakery's complete selection is available to neighborhood customers.

**Acceptance Criteria:**
- Product creation form at `/admin/products/new`:
  1. `image`: Direct file upload (PNG, JPEG, WebP up to 5 MB) uploaded to Cloudinary/ImageKit CDN, storing persistent URL. Drag-and-drop or device camera snap.
  2. `title`: Arabic product name (required, e.g. "فينو بلدي كبير") + English name (optional).
  3. `description`: Product details, ingredients, or bakery notes (e.g. "محمص طازج يومياً بالسمسم").
  4. `category`: Dropdown selection (`FINO_BREAD`, `TRADITIONAL_BREAD`, `PASTRY`, `DAIRY`, `SWEETS_AND_DRY`).
  5. `pricingModel`: Radio toggle between:
     - `PER_PIECE` (بالقطعة): Sets price per single piece (e.g. 2.50 EGP).
     - `PER_WEIGHT` (بالكيلو): Sets price per 1.0 kg (e.g. 160.00 EGP). System automatically calculates standard Egyptian bakery fractions:
       - 1/4 kg = 25% of base price (e.g. 40.00 EGP)
       - 1/2 kg = 50% of base price (e.g. 80.00 EGP)
       - 3/4 kg = 75% of base price (e.g. 120.00 EGP)
       - 1.0 kg = 100% of base price (e.g. 160.00 EGP)
  6. `stockQuantity`: Initial available inventory. For `PER_PIECE`, integer count (e.g. 200 loaves); for `PER_WEIGHT`, decimal kg (e.g. 15.5 kg).
  7. `visibility`: Default `AVAILABLE` (active).
- Form validates with Zod; required fields highlighted inline.
- On save: creates record in `Product` table and immediately redirects to `/admin/products` with success notification.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Image upload fails during creation | 500 `UPLOAD_FAILED` — Informs admin; form contents preserved. |
| Negative price or zero stock entered | Validation error: Price must be > 0.00 EGP; stock must be >= 0. |
| Bakery admin enters non-standard weight fraction | System enforces standard increments (0.25, 0.50, 0.75, 1.00 kg multiples). |

---

#### Story 4.4 — Product Lifecycle & Visibility: In-Place Editing, Sold Out, and Hidden

**As a** bakery admin, **I want to** register each product once, edit any of its fields at any time, or mark it as Sold Out or Hidden **so that** I maintain catalog accuracy without creating duplicate products or breaking order history.

**Acceptance Criteria:**
- **Single Registration Principle:** Each product is registered once with an immutable `id`. All modifications occur in-place via `PATCH /api/admin/products/{id}`.
- Edit form at `/admin/products/{id}/edit` allows editing:
  - Product image (replace with new upload or keep existing).
  - Title, description, category.
  - Base price (updates apply only to new order placements; historical orders preserve locked snapshot price).
  - Stock quantity (increment/decrement available units).
  - Pricing model (`PER_PIECE` vs `PER_WEIGHT`).
- **Three-Tier Visibility Controls:**
  - `AVAILABLE`: Product is visible in customer catalog and active for ordering.
  - `SOLD_OUT`: Product remains visible in the catalog with a distinct "Sold Out" (`نفد من المخزن`) badge, but "Add to Basket" is disabled. Admin can manually set this state (e.g. afternoon oven exhaustion), or the system automatically applies it when `stockQuantity` reaches 0.
  - `HIDDEN`: Product is completely removed from customer-facing catalog queries and invisible in search. Used for seasonal items (e.g. Ramadan sweets, Kahk el-Eid) or discontinued items. Historical orders linked to this product retain valid relations and receipt displays.
- Quick 1-tap visibility toggle buttons directly on each row in `/admin/products` table: `[Active]`, `[Mark Sold Out]`, `[Hide]`.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Admin marks product HIDDEN while customer has it in open unsubmitted cart | When customer attempts checkout, system returns 400 `PRODUCT_HIDDEN` — "This item is currently unavailable." |
| Admin edits price while customer has item in unplaced basket | Price dynamically re-syncs on checkout; order confirmation displays new price before wallet deduction. |
| Admin hides a product previously ordered by 50 customers | Historical `DailyOrder` and `OrderItem` records retain product name, snapshot unit price, and foreign key; customer order history displays correctly. |

---

#### Story 4.5 — Real-Time Inventory Depletion & Fino Stock Recovery (Anti-Hoarding Rule)

**As a** bakery and customer, **I want** product stock counts and weights to automatically decrease when orders are placed and recover only for fino bread when cancelled before cutoff **so that** limited inventory is protected against last-minute cancellation hoarding.

**Acceptance Criteria:**
- **Atomic Checkout Depletion:**
  - When an order is placed (`POST /api/orders` or scheduled for a delivery day), each order item's quantity or weight is decremented from `Product.stockQuantity` inside the same database transaction (`prisma.$transaction`) that creates the order and deducts wallet funds.
  - Concurrency safety: atomic database query prevents race conditions:
    ```sql
    UPDATE "Product"
    SET "stockQuantity" = "stockQuantity" - $quantity
    WHERE "id" = $productId AND "stockQuantity" >= $quantity AND "visibility" = 'AVAILABLE';
    ```
  - If any item has insufficient stock: transaction aborts completely, wallet deduction is rolled back, and server returns HTTP 400 `INSUFFICIENT_STOCK` with item name and remaining available quantity.
- **Automated Sold Out Transition:**
  - If a purchase reduces `Product.stockQuantity` to exactly `0`, the system automatically updates `visibility = 'SOLD_OUT'`.
- **Pre-Cutoff Stock Recovery Strictly for Fino Bread:**
  - To prevent stock hoarding (e.g. a customer buying all 10 remaining croissants, blocking all other customers, and cancelling right before midnight), **non-fino items cannot be cancelled by customers**.
  - When a customer cancels an eligible pure Fino order or reduces Fino bread quantity before the daily cutoff time (`status = 'QUEUED'`), the exact loaf count is atomically incremented back:
    ```sql
    UPDATE "Product"
    SET "stockQuantity" = "stockQuantity" + $finoQuantity
    WHERE "id" = $finoProductId;
    ```
  - If the Fino product was in `SOLD_OUT` status solely due to zero stock (`stockQuantity = 0`), the recovery of stock automatically restores its status back to `AVAILABLE`.
  - Non-fino inventory is permanently committed upon order placement; no customer cancellation or stock recovery exists for non-fino products.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Customer orders all 10 remaining croissants | Croissant stock drops to 0; marked `SOLD_OUT`. The customer cannot cancel this item (blocked by 400 `CANNOT_CANCEL_NON_FINO`). Bakery is protected against unsold hoarding. |
| Two customers simultaneously order the last 5 fino loaves | Database row lock / atomic decrement allows the first transaction to succeed; the second transaction fails atomically and returns 400 `INSUFFICIENT_STOCK`. |
| Customer cancels 10 fino loaves 5 minutes before 12:00 AM cutoff | Allowed (Fino item). Wallet refunded immediately; 10 fino loaves restored to catalog; available for other customers until cutoff. |
| Customer attempts cancellation after daily cutoff | 400 `ORDER_LOCKED`. Manifest is locked; no stock is restored and no refund is issued. |

---

### Epic 5: Wallet & Payments

**Goal:** Enable seamless prepaid wallet funding via a Zero-Input InstaPay screenshot upload, multimodal Gemini Vision OCR extraction, notification-verified automated reconciliation (`InstaPayAlert` ledger — populated by Android push notification listener on `com.egyptianbanks.instapay`) enforcing the Anti-Fraud Golden Rule, problematic receipt admin review dashboard (`/admin/payments/review`), operational mode toggle (`AUTOMATED_NOTIFICATION` / `MANUAL_BAKERY_ADMIN`), and Super Admin emergency balance controls.

---

#### Story 5.1 — View Wallet Balance & History

**Acceptance Criteria:**
- Current `walletBalance` formatted prominently in EGP (e.g. "125.00 EGP").
- Visual status banner for pending top-ups (e.g. *"Top-up of 100.00 EGP pending bank confirmation"*).
- Payment history list: date, amount, method (`INSTAPAY`), reference number, status (`APPROVED`, `PENDING`, `REJECTED`), and rejection reason if applicable.
- Single prominent CTA: "Top Up Wallet" (`شحن المحفظة`).

---

#### Story 5.2 — Zero-Input InstaPay Top-Up & Automated OCR

**As a** customer, **I want to** top up my wallet by simply uploading my InstaPay transfer screenshot without typing any numbers or amounts, **so that** my wallet is funded with zero effort.

**Acceptance Criteria:**
- Top-up view at `/wallet/topup`:
  - Displays bakery's registered InstaPay IPA handle with a 1-tap "Copy Handle" button.
  - Displays minimum top-up guideline (`minTopupAmount`, default 50.00 EGP).
  - Single action: Upload transfer receipt screenshot (drag-and-drop, photo gallery, or camera snap). Supports JPEG, PNG, WebP up to 10 MB.
  - Zero manual input fields: Customer is never asked to type reference numbers, amounts, or dates.
- PWA displays clear progress state: "Uploading receipt..." -> "Extracting details with AI..." -> "Reconciling with bank...".
- Server uploads image to Cloudinary or ImageKit, securing a persistent CDN image URL.
- Server passes image to Gemini Vision API with a strictly typed JSON schema prompt to extract:
  - `referenceNumber` (InstaPay Reference ID string)
  - `amount` (float in EGP)
  - `timestamp` (ISO string / date)
  - `recipientHandle` (string)
- Automated Validations:
  - If image is unreadable, blurry, or missing critical fields: HTTP 422 `UNREADABLE_RECEIPT` — *"Could not clearly read the InstaPay receipt. Please upload a clear, full screenshot of your confirmation."* (Zero manual fallback).
  - If extracted `recipientHandle` does not match bakery's configured address: HTTP 400 `RECIPIENT_MISMATCH` — *"Receipt shows transfer was sent to a different recipient. Please check the bakery handle."*
  - If extracted `amount < minTopupAmount`: HTTP 400 `AMOUNT_TOO_LOW` — *"Minimum top-up is {minTopupAmount} EGP."*
  - If `referenceNumber` already exists in `Payment` or matched in `BankAlert`: HTTP 400 `REJECTED_DUPLICATE` — *"This receipt was already submitted. Check your payment history."*
- **Immediate Notification Reconciliation Check (`AUTOMATED_NOTIFICATION` mode):**
  - System immediately queries `InstaPayAlert` table where `ipnReference = extracted.referenceNumber`, `amount = extracted.amount`, and `isMatched = false`.
  - **Match Found:**
    - Atomic transaction: `InstaPayAlert.matchedPaymentId = Payment.id`, `InstaPayAlert.isMatched = true`, `Payment.status = APPROVED`, `Payment.reconciledAt = NOW()`, `User.walletBalance += amount`.
    - Client receives instant green confirmation: *"Transfer verified! {amount} EGP added to your wallet."*
  - **Match Not Found / Problematic Receipt (notification delayed, phone offline, or image issues):**
    - Receipt is **NEVER silently dropped or auto-rejected**.
    - `Payment` created with status `PENDING_REVIEW`, storing extracted OCR fields and image URL.
    - Client receives status: *"Receipt uploaded! Confirmation in progress…"*
    - Receipt surfaces in `/admin/payments/review` for bakery admin manual [Approve] / [Reject].
- **`MANUAL_BAKERY_ADMIN` mode:** Skip notification check entirely; every receipt goes directly to `PENDING_REVIEW` admin queue regardless of `InstaPayAlert` status.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Customer uploads blurry or cropped screenshot | Gemini OCR returns low confidence or missing fields → receipt enters `PENDING_REVIEW` (never auto-rejected); bakery admin sees screenshot in review dashboard to manually approve/reject. |
| Customer uploads screenshot of transfer to wrong handle | OCR detects recipient mismatch → 400 `RECIPIENT_MISMATCH`. Record logged as REJECTED immediately (clear fraud signal). |
| Duplicate screenshot uploaded by same or different user | IPN reference number matches existing DB record → 400 `REJECTED_DUPLICATE`. Instant reject. |
| Extracted amount is below minimum top-up | 400 `AMOUNT_TOO_LOW`. Payment record created as REJECTED with note. |
| Cloud upload fails (Cloudinary/ImageKit down) | 500 `UPLOAD_FAILED` — "Upload failed. Please try again." |
| InstaPay notification not yet received (listener phone temporarily offline) | Payment created as `PENDING_REVIEW`. Auto-reconciles to `APPROVED` when the notification arrives; bakery admin can also approve manually in the meantime. |
| Reconciliation mode is `MANUAL_BAKERY_ADMIN` | All receipts go to `PENDING_REVIEW` queue; notifications logged but not used for auto-crediting. |

---

#### Story 5.3 — Incoming InstaPay Push Notification Webhook & Automated Reconciliation

**As the** platform system, **I want to** ingest incoming InstaPay credit push notifications from the bakery's dedicated Android phone **so that** pending payments are auto-reconciled and wallet credits are issued in real time without manual human intervention.

**Acceptance Criteria:**
- Webhook endpoint at `POST /api/webhooks/instapay-notification` protected by `x-device-secret` header.
- Android listener app (intercepting push notifications from package `com.egyptianbanks.instapay`) posts extracted fields:
  ```json
  {
    "ipnReference": "IPA9876543210",
    "amount": 150.00,
    "sender": "Fatma Ali",
    "receivedAt": "2026-09-29T15:20:00Z"
  }
  ```
- Server validates `x-device-secret`; returns 401 `DEVICE_SECRET_INVALID` on mismatch.
- System inserts append-only row into immutable `InstaPayAlert` table.
- Background reconciliation logic runs immediately (only in `AUTOMATED_NOTIFICATION` mode):
  - Searches for `Payment` where `ipnReference = notification.ipnReference`, `amount = notification.amount`, and `status = 'PENDING_REVIEW'`.
  - **Match Found:** Atomic transaction:
    - `Payment.status = APPROVED`, `Payment.reconciledAt = NOW()`
    - `InstaPayAlert.matchedPaymentId = Payment.id`, `InstaPayAlert.isMatched = true`
    - `User.walletBalance += notification.amount`
    - Triggers notification to customer: *"Your wallet has been topped up: +{amount} EGP via InstaPay. New balance: {balance} EGP."*
  - **Match Not Found (Customer has not uploaded screenshot yet):**
    - `InstaPayAlert` remains saved with `isMatched = false`, awaiting customer upload for instant match.
- **In `MANUAL_BAKERY_ADMIN` mode:** Notifications are still logged to `InstaPayAlert` for bookkeeping, but no automatic crediting occurs. Reconciliation happens only via bakery admin manual approval in `/admin/payments/review`.
- **Anti-Fraud Enforcement (The Golden Rule):** No payment status transitions to `APPROVED` and no wallet is credited without either: a verified matching `InstaPayAlert` (automated mode), a bakery admin manual approval, or a `DEVELOPER` super admin adjustment.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| InstaPay push notification arrives before customer uploads screenshot | `InstaPayAlert` saved as unmatched (`isMatched = false`). When customer uploads receipt later, Story 5.2 matches it instantly. |
| Notification payload has unexpected structure or missing fields | Server logs parsing error; `InstaPayAlert` stored with `parseStatus = FAILED` for developer inspection; no crash. |
| Duplicate notification webhook received (Android retry) | Unique constraint on `(ipnReference, amount)` prevents duplicate alert insertion; returns 200 idempotently. |
| Fraudulent screenshot uploaded with fabricated IPN reference | Stays `PENDING_REVIEW`; never matches a real `InstaPayAlert`; bakery admin sees it in review dashboard and rejects. Zero financial risk. |
| `x-device-secret` header missing or invalid | 401 `DEVICE_SECRET_INVALID`. Request rejected immediately. |

---

#### Story 5.4 — Bakery Admin Receipt Review Dashboard & Payments Audit

**As a** bakery admin, **I want to** review problematic receipts in a dedicated dashboard and view the historical audit log of all rejected receipts **so that I can** approve or reject pending payments with 1-tap and assist customers with receipt issues.

**Acceptance Criteria:**
- Admin payments screen at `/admin/payments` provides three clear views:
  1. **Pending Review Queue (`/admin/payments/review`):** All payments with status `PENDING_REVIEW`, sorted oldest first.
     - Raw receipt screenshot displayed prominently **side-by-side** with OCR-extracted data (IPN reference, amount, timestamp, recipient handle).
     - Displays: customer name, phone, submission timestamp, elapsed wait time.
     - **[Approve]** button: Atomic transaction — `Payment.status = APPROVED`, `User.walletBalance += amount`, `WalletAuditLog` entry written, customer notified.
     - **[Reject]** button: Requires selecting/typing a rejection reason; marks `Payment.status = REJECTED`; customer notified.
     - "Re-Check Notifications": Manually re-queries `InstaPayAlert` ledger for any late-arriving notifications; auto-approves if match found.
  2. **Approved Payments Tab (`/admin/payments?status=APPROVED`):** Full history of approved top-ups with IPN reference and reconciliation source (auto-matched or admin-approved).
  3. **Rejected Receipts Tab (`/admin/payments?status=REJECTED`):**
     - Full audit log of all rejected receipts.
     - Displays: Customer name, phone, submission timestamp, rejection reason (`UNREADABLE_RECEIPT`, `RECIPIENT_MISMATCH`, `AMOUNT_TOO_LOW`, `REJECTED_DUPLICATE`, or admin manual rejection reason), OCR-extracted JSON metadata, and high-resolution receipt screenshot thumbnail.
     - Searchable by customer phone number and date range.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Bakery admin reviews `PENDING_REVIEW` queue | Side-by-side screenshot + extracted data view; 1-tap Approve/Reject. |
| Bakery admin reviews rejected receipts tab | Shows all rejected records with full screenshot evidence and exact OCR error details. |
| Admin rejects a pending payment without reason | Submission blocked; rejection reason is strictly required. |
| Two admins review same pending payment simultaneously | First action commits; second receives 400 `ALREADY_PROCESSED`. |
| Matching `InstaPayAlert` arrives while receipt is in `PENDING_REVIEW` | Auto-reconciled to `APPROVED` atomically; receipt disappears from review queue; bakery admin notified. |

---

#### Story 5.5 — Developer / Super Admin Emergency Balance Adjustment

**As a** DEVELOPER / Super Admin (programmer), **I want to** directly add or modify a customer's wallet balance in emergency scenarios **so that I can** resolve customer disputes, handle offline cash settlements, or fix system edge cases while preserving an immutable audit log.

**Acceptance Criteria:**
- Dedicated console at `/admin/developer/wallets` strictly gated to JWT role `DEVELOPER` (403 FORBIDDEN for `BAKERY_ADMIN` and others).
- Customer search by phone number displaying current `walletBalance`, account status, and top-up/order history.
- Balance adjustment form:
  - `action`: `ADD_CREDIT` (positive or negative delta) or `SET_BALANCE` (override to exact figure).
  - `amount`: Numeric EGP amount.
  - `reason`: Mandatory text string (minimum 10 characters) explaining the emergency rationale (e.g. *"Customer paid 200 EGP in physical cash to bakery owner during bank network outage"*). Form submission blocked if empty.
- Atomic transaction:
  - Updates `User.walletBalance`.
  - Inserts append-only record to `WalletAuditLog`: `{ id, adminId, customerId, previousBalance, newBalance, delta, reason, createdAt }`.
  - Creates a completed `Payment` record with `method = 'ADMIN_ADJUSTMENT'`, `status = 'APPROVED'`.
  - The updated `walletBalance` is immediately visible to the customer on their next wallet screen load (in-app status; no SMS dispatch required).

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Bakery admin attempts to access `/admin/developer/wallets` | 403 FORBIDDEN. Bakery admins cannot alter balances. |
| Adjustment submitted without reason | 400 `ADJUSTMENT_REASON_REQUIRED` — Reason note cannot be blank. |
| Adjustment would result in negative balance | 400 `INSUFFICIENT_WALLET` — Wallet balance cannot be reduced below 0.00 EGP. |
| Concurrent order deduction during manual adjustment | Serialized within Prisma transaction isolation; balance computes accurately. |

---

### Epic 6: Oven Production Manifest

**Goal:** Provide bakery admins and bakers with real-time pre-cutoff visibility into requested product quantities throughout the day (Live Demand Preview), and lock an accurate, sorted production manifest at the daily cutoff time for night baking and morning runner dispatch.

---

#### Story 6.1 — Live Demand Preview & Locked Oven Manifest

**Acceptance Criteria:**
- Manifest screen at `/admin/manifest` with date picker (defaults to upcoming delivery date).
- **Two Operational Modes:**
  1. **Pre-Cutoff (Live Demand Mode):**
     - Prior to the cutoff time, displays all currently `QUEUED` orders placed or scheduled for the selected delivery date.
     - Live/Refreshable: Bakery admins can view requested/ordered products live (via manual 1-tap "Refresh Demand" button or auto-refresh poll every 30s) throughout the daytime and evening before the cutoff.
     - Prominent status indicator banner: `"🟢 Live Demand Preview — {count} orders placed so far. Orders can still be placed, modified, or cancelled until cutoff at {dailyCutoffTime}."`
     - Allows head bakers to monitor dough demand, prep ingredients, and plan oven cycles early.
  2. **Post-Cutoff (Locked Production Manifest):**
     - Automatically freezes once the daily cutoff passes and orders transition from `QUEUED` -> `BAKING`.
     - Prominent banner: `"🔒 Finalized Production Manifest — Locked at {cutoffTimestamp}."`
     - Rows sorted hierarchically for baking and packing: `street ASC, subStreet ASC NULLS FIRST, building ASC, floor ASC NULLS FIRST, apartment ASC NULLS FIRST`.
     - Each row displays: Sequence number, customer name, phone, formatted address (street, sub-street, building, floor, apartment, prominent landmark, and additional directions note), itemized bakery quantities, and total amount.
- 100% of orders are morning home deliveries.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Admin checks manifest at 3:00 PM (before cutoff) | Live Demand Mode active; shows all current `QUEUED` orders placed so far, updating on refresh. |
| Cutoff triggers while admin is viewing live manifest | On next poll or refresh, UI switches to Locked Production Manifest banner; order counts freeze. |
| Date has no orders | Empty state: "No orders placed for this date." |
| Street delivery execution | Formatted address details (building/floor/apt, landmark, and additional notes) are provided so the runner can execute doorstep drop or building/gate drop live on the street based on real-time conditions. |
| Runner assigned to partial manifest | Runner's /ops/runner shows only their assigned orders in same sort order. Full manifest visible to admin. |

---

#### Story 6.2 — Manifest Summary (Live Demand & Production Totals)

**Acceptance Criteria:**
- Summary panel at `/admin/manifest/summary` displays aggregated demand across both operational phases:
  - **Before Cutoff:** Aggregates live quantities across all `QUEUED` orders for today's delivery date (re-computes on refresh as customers place orders).
  - **After Cutoff:** Aggregates finalized quantities across locked orders (`BAKING`, `DISPATCHED`, `DELIVERED`).
- Summary breakdown shows:
  - Total Standard Fino loaves (Hero item)
  - Total Large Fino loaves (Hero item)
  - Total other bread loaves (Baladi, Shami, etc.)
  - Total pastry & viennoiserie units (Croissants, Pâtés, etc.)
  - Total dairy & breakfast staples
  - Total sweets & confectionery units
  - Total morning delivery orders count
  - Total unique street/drop locations (distinct street + building combinations)
  - Itemized SKU-by-SKU table with unit counts for bakery prep.

---

### Epic 7: Runner Operations

**Goal:** Provide runners with an offline-capable run sheet and tap-to-confirm delivery interface for morning drops.

---

#### Story 7.1 — Runner Login & Run Sheet Access

**Acceptance Criteria:**
- Runner logs in with phone + password (role = RUNNER).
- Run sheet at /ops/runner: only orders assigned to this runner for this morning, in manifest sort order.
- Each card: sequence number, customer name, phone, full formatted address (street, sub-street, building, floor, apartment, prominent landmark, and additional directions note), itemized bakery quantities, and total amount.
- 100% of orders are morning home deliveries. Runner uses the customer's full address, landmark, and free-text notes to make real-time street decisions (delivering straight to the apartment door, or dropping at the building/compound entrance if door access is restricted or preferred by customer notes).

---

#### Story 7.2 — Mark Delivery as Delivered (Offline-Capable)

**As a** runner, **I want to** tap to confirm a delivery **so that the bakery admin** knows the order was dropped off, even with no signal.

**Acceptance Criteria:**
- Each DISPATCHED order card: prominent "Mark Delivered" button.
- Tap: optimistic UI — card turns green instantly.
- Background: { orderId, action: 'DELIVERED', timestamp: UTC, idempotencyKey: uuid() } written to IndexedDB queue.
- If online: sync immediately via PATCH /api/ops/orders/{id}/status with X-Idempotency-Key.
- If offline: stays queued in IndexedDB; Background Sync API retries when connectivity restores.
- On 200: remove from IndexedDB queue.
- On 409 (cancelled): remove from queue; show alert "Order was cancelled — skip this drop."
- Idempotency key match on retry: server returns cached 200; no duplicate write.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Runner enters elevator with 10 confirmations buffered offline | All 10 queued in IndexedDB FIFO. Sync one at a time when back online; never parallel. |
| Runner marks Delivered but order was cancelled mid-delivery | 409 conflict; runner sees "Skip this drop" alert; item cleared from IndexedDB. |
| Runner double-taps "Mark Delivered" | Same idempotency key; server returns cached 200; no duplicate status transition. |
| Admin reassigns runner mid-run | Runner refreshes screen; new assignment loads. Previously delivered orders remain marked. |
| Run sheet loaded while fully offline | Service worker serves cached run sheet. Newly assigned orders unavailable until back online. |

---

### Epic 8: Admin Gate Controls & Configuration

---

#### Story 8.1 — Operational Status Panel

**As a** bakery admin, **I want to** see gate flag states and toggle them with one tap **so that I can** control operations in real time.

**Acceptance Criteria:**
- Panel shows gate rows: state (OPEN / CLOSED) + last changed timestamp + changed by (admin name or "Automated"):
  - Daily Order Gate (controls upcoming morning delivery; closes automatically at configurable `dailyCutoffTime`, default 12:00 AM midnight)
  - Advance 7-Day Ordering (controls whether scheduling future days is enabled)
- Each row: [Close Now] or [Reopen] button.
- Closing Daily Order Gate: atomically transitions all today's QUEUED orders to BAKING.
- Re-opening Daily Order Gate: flag flips to true; allows late additions. Existing BAKING orders are NOT rolled back.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Admin closes order window early (e.g. 11:30 PM due to oven capacity) | All QUEUED orders -> BAKING atomically. Customers see ORDER_LOCKED on any new placement for tomorrow morning. |
| Admin reopens order window after closing | Flag = true; new orders and edits accepted. Existing BAKING orders NOT reverted. |
| Two admins toggle same flag simultaneously | Last write wins; no conflict detection needed (stateless boolean). |

---

#### Story 8.2 — Developer Dynamic Fee Console

**As a** DEVELOPER / PLATFORM_OWNER (programmer), **I want to** configure dynamic delivery fees and platform revenue splits via a dedicated developer console or direct queries **so that** the platform financial model is strictly under developer control and cannot be tampered with by the bakery owner.

**Acceptance Criteria:**
- Developer console at `/admin/developer/fees` (strictly restricted to JWT role `DEVELOPER` / `PLATFORM_OWNER`; 403 FORBIDDEN for `BAKERY_ADMIN`):
  - Dynamic Fees: `convenienceFee` (delivery charge per customer order), `platformFee`, `laborPoolFee`, `fuelReserveFee` (system enforces invariant: `platformFee + laborPoolFee + fuelReserveFee === convenienceFee`).
  - Minimum reload: `minTopupAmount` (platform floor).
- Dynamic fees can also be inspected and modified directly via SQL queries or developer scripts.
- Changes take effect immediately for future order calculations. Existing queued/locked orders retain snapshotted pricing.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Bakery admin attempts to access `/admin/developer/fees` | 403 FORBIDDEN; access denied. Bakery admin has zero visibility or editing rights over convenience fee and revenue splits. |
| Fee split doesn't sum to convenienceFee | 400 FEE_SPLIT_MISMATCH — "Platform + labor + fuel fees must equal the convenience fee." |

---

#### Story 8.3 — InstaPay Reconciliation Mode Toggle

**As a** bakery admin, **I want to** instantly toggle the reconciliation mode between automated and fully manual **so that I can** retain control when the listener phone is dead, under maintenance, or when I want to personally approve every top-up.

**Acceptance Criteria:**
- Settings panel at `/admin/settings` (accessible by `BAKERY_ADMIN` and `DEVELOPER`):
  - Prominent toggle switch: **Reconciliation Mode**
    - `AUTOMATED_NOTIFICATION` (default — green): System auto-matches incoming InstaPay push notifications to uploaded receipts; unmatched receipts fall back to `PENDING_REVIEW`.
    - `MANUAL_BAKERY_ADMIN` (red): Automated crediting fully paused. **Every receipt goes directly to the review dashboard** (`/admin/payments/review`) regardless of `InstaPayAlert` status. Notifications are still logged for bookkeeping.
  - Current mode displayed clearly with last-changed timestamp and changed-by identity.
  - Mode change takes effect **instantly** (no cron delay); in-flight `PENDING_REVIEW` items are unaffected.
- When mode is `MANUAL_BAKERY_ADMIN`, the admin dashboard displays a persistent warning banner: *"⚠️ Manual reconciliation mode active. All top-ups require your approval before wallet credit."*

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Owner switches to `MANUAL_BAKERY_ADMIN` while 5 receipts are `PENDING_REVIEW` | Existing `PENDING_REVIEW` items remain in queue; no change to their status. New uploads join queue immediately. |
| Owner switches back to `AUTOMATED_NOTIFICATION` while receipts are in `PENDING_REVIEW` | System immediately re-runs reconciliation against `InstaPayAlert` for each `PENDING_REVIEW` item; auto-approves matches; leaves non-matching in queue for manual review. |
| Listener phone is dead and owner forgets to switch to `MANUAL_BAKERY_ADMIN` | Receipts enter `PENDING_REVIEW` as normal (no matching notification); owner sees them in review dashboard and can approve manually. No data loss. |

---

#### Story 8.4 — Bakery Operational Schedule & Profile Configuration

**As a** BAKERY_ADMIN, **I want to** control operational timing parameters (cutoff time, morning delivery windows, baking shift start) and bakery profile settings in `/admin/config` **so that** the system operates on our bakery's actual production rhythm.

**Acceptance Criteria:**
- Config panel at `/admin/config` (accessible by `BAKERY_ADMIN` and `DEVELOPER`):
  - **Operational Timing Controls:**
    - `dailyCutoffTime`: Time threshold for upcoming morning orders (e.g. `"00:00"` / 12:00 AM). Changing this immediately updates the live customer countdown timer and scheduled cron lock.
    - `bakingStartTime`: Start of morning bake shift (e.g. `"00:30"`).
    - `runnerDispatchTime`: Packaging and runner departure time (e.g. `"06:00"`).
    - `deliveryWindowStart` & `deliveryWindowEnd`: Customer morning delivery window displayed in UI and notifications (e.g. `"06:30"` to `"08:30"`).
  - **Bakery Profile & Identity:**
    - `bakeryName`, `neighborhoodName`, `city`
    - `primaryAreaName` (optional neighborhood/zone display name; shown in UI hints)
  - Product catalog prices, images, and stocks are managed via `/admin/products`.
- **Strict Boundary:** Bakery Admin CANNOT view or edit delivery convenience fees or platform revenue splits on this page.

**Edge Cases:**

| Scenario | Expected Behavior |
|---|---|
| Bakery admin modifies dailyCutoffTime from 00:00 to 23:30 | Customer PWA countdown timer instantly recalculates remaining duration; server cron dynamically re-aligns to new cutoff. |
| Admin sets deliveryWindowStart after deliveryWindowEnd | Validation error: Delivery start time must precede delivery end time. |

---

### Epic 9: Notifications

---

#### Story 9.1 — Customer Notification Triggers

> **Design Rationale (No-SMS Alternative):** All status events are surfaced via **in-app status updates** within the PWA — no third-party SMS gateway is required. The customer sees live status on their Dashboard and Wallet screens on every page open/refresh. This is free, zero-complexity, and sufficient at MVP scale where the bakery serves a small, known neighborhood cohort.

| Event | How Customer Learns | In-App Mechanism |
|---|---|---|
| Wallet top-up APPROVED | Balance instantly visible on `/wallet` | `walletBalance` field updates on next page load or manual refresh; prominent green toast on `/wallet/topup` success response |
| Wallet top-up PENDING\_REVIEW | Status visible on `/wallet` payment history | `Payment.status = PENDING_REVIEW` shown in payment list with "Confirmation in progress…" label |
| Wallet top-up REJECTED | Status visible on `/wallet` payment history | `Payment.status = REJECTED` shown with rejection reason; customer prompted to contact bakery |
| Order PLACED / CONFIRMED | Visible on Dashboard and `/orders` | New `QUEUED` order appears immediately with items, total, and delivery date |
| Order transitions to BAKING | Visible on Dashboard | Order card status badge changes from QUEUED → BAKING on next load after cutoff |
| Order DISPATCHED | Visible on Dashboard | Order card status badge changes to DISPATCHED; delivery window times displayed |
| Order DELIVERED | Visible on Dashboard and `/orders` | Order card status badge changes to DELIVERED with runner confirmation timestamp |
| Order CANCELLED | Visible on Dashboard and Wallet | Order card shows CANCELLED\_CREDITED; refund amount shown on wallet balance and payment history |

---

### Epic 10: Multi-Deployment Readiness

---

#### Story 10.1 — New Deployment Setup

**Acceptance Criteria:**
- Zero hardcoded bakery names, street names, phone numbers, or prices in the codebase.
- All operational timing parameters and fee configurations stored in SystemConfig (singleton row, id=1).
- Deployment checklist:
  1. Provision Neon PostgreSQL database (free tier).
  2. Set environment variables (DATABASE_URL, DIRECT_URL, JWT_SECRET, CRON_SECRET, CLOUDINARY_*, GEMINI_API_KEY, SMS_*).
  3. Run `prisma migrate deploy` and `prisma db seed`.
  4. Deploy to Vercel; configure cron schedule in `vercel.json` (or dynamic cron runner).
  5. Seed DEVELOPER account (supreme programmer authority) and initial BAKERY_ADMIN account.
  6. Programmer configures dynamic platform fees and revenue splits via `/admin/developer/fees` (or direct SQL).
  7. Bakery admin logs into `/admin/config` to set operational schedule parameters and profile, and `/admin/products` to register catalog products with images, piece/weight pricing, and initial stock.

---

## 11. API Error Code Reference

| Code | HTTP Status | Meaning |
|---|---|---|
| PHONE_TAKEN | 400 | Phone number already registered |
| STREET_REQUIRED | 400 | Street name is required |
| BUILDING_REQUIRED | 400 | Building number or building name is required |
| EMPTY_BASKET | 400 | Order basket has no items selected |
| ZERO_QUANTITY | 400 | Order item reduced to 0 or total basket count is 0 |
| CUTOFF_PASSED | 400 | The configured cutoff time ({dailyCutoffTime}, default: 12:00 AM) for this delivery day has passed |
| ORDER_LOCKED | 400 | Order is in BAKING or later — immutable |
| ORDER_WINDOW_CLOSED | 400 | isOrderWindowOpen = false (orders closed for this delivery cycle) |
| ORDER_EXISTS | 400 | Customer already has an active QUEUED order for this delivery date |
| ALREADY_CANCELLED | 400 | Order is already in CANCELLED_CREDITED |
| CANNOT_CANCEL_NON_FINO | 400 | Cancellation or reduction is strictly restricted to Fino bread; non-fino products are final once ordered |
| INSUFFICIENT_WALLET | 400 | Wallet balance too low for this operation |
| INSUFFICIENT_STOCK | 400 | Requested item quantity or weight exceeds available product stock |
| INVALID_PRICING_TYPE | 400 | Invalid pricing model or weight fraction requested |
| PRODUCT_HIDDEN | 400 | Product is currently inactive or hidden from the catalog |
| PRODUCT_UNAVAILABLE | 400 | Product out of stock or marked unavailable |
| REJECTED_DUPLICATE | 400 | Payment reference number already exists in DB or was already reconciled |
| AMOUNT_TOO_LOW | 400 | Top-up amount below configured minimum |
| UNREADABLE_RECEIPT | 422 | Gemini OCR could not clearly parse receipt; prompt user for clearer screenshot |
| INVALID_RECEIPT | 422 | Uploaded screenshot is not a valid InstaPay confirmation receipt |
| RECIPIENT_MISMATCH | 400 | Receipt indicates transfer was sent to a different handle than bakery's InstaPay address |
| INSTAPAY_ALERT_ALREADY_MATCHED | 400 | InstaPay push notification (`InstaPayAlert`) has already been matched to a prior payment |
| DEVICE_SECRET_INVALID | 401 | Invalid or missing `x-device-secret` on `/api/webhooks/instapay-notification` endpoint |
| PENDING_REVIEW | — | Payment status indicating receipt uploaded but awaiting admin manual review (never auto-rejected; always surfaces in `/admin/payments/review`) |
| ADJUSTMENT_REASON_REQUIRED | 400 | Mandatory reason string required for manual wallet adjustments |
| CUSTOMER_NOT_FOUND | 404 | Customer account with given phone number not found |
| UPLOAD_FAILED | 500 | Cloudinary/ImageKit screenshot upload failed |
| ALREADY_PROCESSED | 400 | Payment already approved or rejected |
| OTP_EXPIRED | 400 | Password reset OTP has expired |
| OTP_USED | 400 | OTP already consumed |
| OTP_LOCKED | 429 | Too many incorrect OTP attempts |
| RATE_LIMITED | 429 | Too many login attempts |
| FEE_SPLIT_MISMATCH | 400 | platformFee + laborPoolFee + fuelReserveFee != convenienceFee |
| UNAUTHORIZED | 401 | Missing or invalid JWT cookie |
| FORBIDDEN | 403 | Insufficient role for this endpoint |

---

## 12. Open Questions & Design Decisions

Edit this section and mark decisions as resolved as they are confirmed.

| # | Question | Options | Status |
|---|---|---|---|
| Q1 | Can customers self-edit their phone number (login identifier)? | Resolved: No self-service — phone number changes are **admin-managed**. Customer contacts the bakery; a `BAKERY_ADMIN` or `DEVELOPER` updates the phone in `/admin/customers/{id}/edit` after verifying identity. This approach eliminates any SMS/OTP dependency entirely and is well-suited to the hyper-local context. | Closed |
| Q2 | Should advance scheduled orders deduct wallet immediately upon placement, or only at the daily cutoff time (default: 12:00 AM)? | Resolved: Deduct immediately upon placement (Option A). The user cannot place orders without funds in wallet, eliminating unpaid or held orders. Instant refund on cancellation before cutoff. | Closed |
| Q3 | How should the 7-day ordering interface handle repeating orders? | Resolved: Day-by-day scheduling (Option A) with a 1-tap **"Copy to other days"** action. Each day is an independent order slot; tapping the action clones the selected day's basket to any chosen subset of the remaining days. | Closed |
| Q4 | Should runners receive SMS/push when orders are assigned, or pull-to-refresh only? | Resolved: Pull-to-refresh only (Option B). SMS notifications are excluded from MVP — the added cost and integration complexity outweigh the benefit at current fleet scale. Runners are expected to refresh the manifest app at the start of each shift. | Closed |
| Q5 | Should delivery address be snapshotted on Order at creation, or always read from live User record? | Resolved: Snapshot at creation (Option A). The full 7-field address block is copied onto the `Order` record at placement time. Subsequent edits to the customer's profile address do not affect in-flight or historical orders. | Closed |
| Q6 | What is the primary language for the customer PWA? | Resolved: Arabic primary, English fallback (Option A). All UI strings are Arabic by default; English is used only where an Arabic translation is unavailable. RTL layout is enforced throughout the PWA. | Closed |
| Q7 | Should there be a maximum order quantity or loaf cap per customer per day? | A) No cap (stock-capped only). B) Configurable cap in SystemConfig. | Open |
| Q8 | Should the pending receipt grace period (accepting orders when receipt is PENDING) be explicitly implemented? | Resolved: No grace period — strictly enforced by the Anti-Fraud Golden Rule. In automated mode (`AUTOMATED_NOTIFICATION`), wallet balance is credited upon matching against an incoming `InstaPayAlert` from the official InstaPay app push notification stream (`com.egyptianbanks.instapay`). If unmatched or delayed, the receipt enters `PENDING_REVIEW` where the bakery owner can manually approve or reject it with 1-tap in `/admin/payments/review`. Zero financial risk; customer UI displays 'Confirmation in progress...' | Closed |
| Q9 | Why are pre-cutoff order cancellations and quantity reductions restricted strictly to Fino bread? | Resolved: To prevent inventory hoarding. If a customer orders all remaining units of a limited-stock item (e.g. 10 croissants), the item shows as SOLD_OUT to everyone else all day. Allowing a late cancellation right before cutoff leaves the bakery with unsold, unrecoverable stock. Fino bread is baked on-demand in large volume, so Fino cancellations do not cause stock lockups. | Closed |
| Q10 | How does the platform support in-house couriers and standard daytime retail deliveries alongside morning Fino subscriptions? | Deferred to Post-MVP — On-demand daytime retail delivery (SCHEDULED\_BATCH vs ON\_DEMAND dual-fulfillment) has no story, screen, config param, or lifecycle defined for MVP. MVP scope is exclusively `SCHEDULED_BATCH` morning deliveries. On-demand dispatch is a post-MVP epic requiring its own routes, config parameters (`onDemandStartTime`, `onDemandEndTime`, `minOnDemandOrderAmount`), and order lifecycle. | Open (Post-MVP) |

---

## 13. Out of Scope (MVP)

| Feature | Reason for Deferral |
|---|---|
| Push notifications (Web Push API) | Web Push setup adds complexity and requires persistent service-worker registration; in-app status updates on page load are sufficient at MVP scale |
| Analytics / reporting dashboard | Prisma Studio + manifest data covers operational needs at launch |
| SMS notifications (any trigger) | Adds third-party SMS gateway cost and integration complexity; all customer status is surfaced via in-app PWA updates; all runner coordination is pull-to-refresh |
| On-demand daytime retail delivery | Requires separate order lifecycle (`PREPARING`, `READY`, `PICKED_UP`), runner live dispatch, and new config params; deferred to a dedicated post-MVP epic |
| Multi-bakery admin panel (SaaS management) | Each deployment is independent; multi-tenant admin is a future phase |
| Credit card / Fawry payment integration | Prepaid wallet model protects margins; card payments add ~2% commission |
| Loyalty / points system | Wallet model serves as de-facto loyalty; explicit points deferred |
| Automated supplier procurement / forecasting | Core stock depletion, recovery, and manual catalog updates supported in MVP; vendor procurement deferred |
| Third-Party Delivery Fleet Aggregation (Talabat / Otlob API) | On-demand fulfillment is handled exclusively by the bakery's own in-house couriers; external 3rd-party logistics APIs deferred |
