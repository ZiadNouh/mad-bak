// ==============================================================================
// Mad-Bak Core Types & Contracts
// Source of truth: PRD.md & IMPLEMENTATION_PLAN.md
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. Role & Identity Hierarchy (PRD §6, Implementation Plan Phase 1)
// ------------------------------------------------------------------------------
export type UserRole = 'DEVELOPER' | 'BAKERY_ADMIN' | 'RUNNER' | 'CUSTOMER';

export interface AuthUser {
  userId: string;
  phone: string;
  role: UserRole;
  fullName?: string;
}

// ------------------------------------------------------------------------------
// 2. Order Lifecycle & Statuses (PRD §5.1, Implementation Plan Phase 1)
// ------------------------------------------------------------------------------
export type OrderStatus =
  | 'QUEUED'
  | 'BAKING'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED_CREDITED';

export type FulfillmentMode = 'SCHEDULED_BATCH';

// ------------------------------------------------------------------------------
// 3. Product Catalog & Inventory Enums (PRD §4.1, §4.3, Implementation Plan Phase 1)
// ------------------------------------------------------------------------------
export type ProductCategory =
  | 'FINO_BREAD'
  | 'TRADITIONAL_BREAD'
  | 'PASTRY'
  | 'DAIRY'
  | 'SWEETS_AND_DRY';

export type ProductVisibility = 'AVAILABLE' | 'SOLD_OUT' | 'HIDDEN';

export type PricingModel = 'PER_PIECE' | 'PER_WEIGHT';

export type PricingUnit =
  | 'PIECE'
  | 'QUARTER_KG'
  | 'HALF_KG'
  | 'THREE_QUARTERS_KG'
  | 'KG';

// ------------------------------------------------------------------------------
// 4. Payment & Reconciliation Enums (PRD §7.3, §7.4, Implementation Plan Phase 1)
// ------------------------------------------------------------------------------
export type PaymentStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export type PaymentMethod = 'INSTAPAY' | 'ADMIN_ADJUSTMENT';

export type ReconciliationMode =
  | 'AUTOMATED_NOTIFICATION'
  | 'MANUAL_BAKERY_ADMIN';

export type ParseStatus = 'OK' | 'FAILED';

// ------------------------------------------------------------------------------
// 5. Unified Egyptian Address Model (PRD §3.1, §3.2)
// ------------------------------------------------------------------------------
export interface AddressInput {
  street: string;
  subStreet?: string | null;
  building: string;
  floor?: string | null;
  apartment?: string | null;
  landmark?: string | null;
  additionalDetails?: string | null;
}

export interface AddressSnapshot {
  street: string;
  subStreet: string | null;
  building: string;
  floor: string | null;
  apartment: string | null;
  landmark: string | null;
  additionalDetails: string | null;
}

// ------------------------------------------------------------------------------
// 6. Standardized API Response Contracts (PRD §2.2 NFR-10, §11)
// ------------------------------------------------------------------------------
export interface ApiResponseSuccess<T = unknown> {
  success: true;
  data: T;
  error?: never;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiResponseError {
  success: false;
  error: ApiErrorDetail;
  data?: never;
}

export type ApiResponse<T = unknown> = ApiResponseSuccess<T> | ApiResponseError;

// ------------------------------------------------------------------------------
// 7. PRD §11 API Error Code Dictionary & Mapping
// ------------------------------------------------------------------------------
export const ERROR_CODES = {
  // Authentication & Profile
  PHONE_TAKEN: {
    status: 400,
    message: 'This phone number is already registered. Try logging in.',
  },
  STREET_REQUIRED: {
    status: 400,
    message: 'Street name is required.',
  },
  BUILDING_REQUIRED: {
    status: 400,
    message: 'Building number or building name is required.',
  },
  CUSTOMER_NOT_FOUND: {
    status: 404,
    message: 'Customer account with given phone number not found.',
  },
  UNAUTHORIZED: {
    status: 401,
    message: 'Missing or invalid JWT cookie.',
  },
  FORBIDDEN: {
    status: 403,
    message: 'Insufficient role for this endpoint.',
  },
  RATE_LIMITED: {
    status: 429,
    message: 'Too many attempts. Please try again later.',
  },

  // Password Reset / OTP
  OTP_EXPIRED: {
    status: 400,
    message: 'This reset link has expired. Please ask the bakery to generate a new one.',
  },
  OTP_USED: {
    status: 400,
    message: 'This link has already been used. Request a new one from the bakery.',
  },
  OTP_LOCKED: {
    status: 429,
    message: 'Too many incorrect attempts.',
  },

  // Order Lifecycle & Basket Rules
  EMPTY_BASKET: {
    status: 400,
    message: 'Please add at least one item to your basket.',
  },
  ZERO_QUANTITY: {
    status: 400,
    message: 'Order item reduced to 0 or total basket count is 0.',
  },
  CUTOFF_PASSED: {
    status: 400,
    message: 'The cutoff time for this delivery day has passed.',
  },
  ORDER_LOCKED: {
    status: 400,
    message: 'Order is locked and currently being prepared in the bakery for morning delivery.',
  },
  ORDER_WINDOW_CLOSED: {
    status: 400,
    message: 'Orders are closed for this delivery cycle.',
  },
  ORDER_EXISTS: {
    status: 400,
    message: 'Customer already has an active order for this delivery date.',
  },
  ALREADY_CANCELLED: {
    status: 400,
    message: 'This order is already cancelled.',
  },
  CANNOT_CANCEL_NON_FINO: {
    status: 400,
    message:
      'Cancellation or reduction is strictly restricted to Fino bread. Non-fino products are final once ordered.',
  },

  // Products & Stock
  INSUFFICIENT_STOCK: {
    status: 400,
    message: 'Requested item quantity or weight exceeds available product stock.',
  },
  INVALID_PRICING_TYPE: {
    status: 400,
    message: 'Invalid pricing model or weight fraction requested.',
  },
  PRODUCT_HIDDEN: {
    status: 400,
    message: 'This item is currently unavailable.',
  },
  PRODUCT_UNAVAILABLE: {
    status: 400,
    message: 'Product is out of stock or marked unavailable.',
  },

  // Wallet, Fees & Payments
  INSUFFICIENT_WALLET: {
    status: 400,
    message:
      'Your wallet balance is insufficient for this operation. Please top up your wallet.',
  },
  AMOUNT_TOO_LOW: {
    status: 400,
    message: 'Top-up amount is below the configured minimum.',
  },
  REJECTED_DUPLICATE: {
    status: 400,
    message: 'This receipt was already submitted. Check your payment history.',
  },
  UNREADABLE_RECEIPT: {
    status: 422,
    message:
      'Could not clearly read the InstaPay receipt. Please upload a clear, full screenshot of your confirmation.',
  },
  INVALID_RECEIPT: {
    status: 422,
    message: 'Uploaded screenshot is not a valid InstaPay confirmation receipt.',
  },
  RECIPIENT_MISMATCH: {
    status: 400,
    message:
      'Receipt indicates transfer was sent to a different handle than bakery InstaPay address.',
  },
  INSTAPAY_ALERT_ALREADY_MATCHED: {
    status: 400,
    message: 'InstaPay push notification has already been matched to a prior payment.',
  },
  DEVICE_SECRET_INVALID: {
    status: 401,
    message: 'Invalid or missing x-device-secret header on webhook endpoint.',
  },
  ADJUSTMENT_REASON_REQUIRED: {
    status: 400,
    message: 'Mandatory reason string required for manual wallet adjustments.',
  },
  ALREADY_PROCESSED: {
    status: 400,
    message: 'Payment has already been approved or rejected.',
  },
  FEE_SPLIT_MISMATCH: {
    status: 400,
    message: 'Platform + labor + fuel fees must equal the convenience fee.',
  },
  UPLOAD_FAILED: {
    status: 500,
    message: 'Image upload failed. Please try again.',
  },

  // Admin Batch Settlement (Phase 8/9)
  DATE_REQUIRED: {
    status: 400,
    message: 'Delivery date query parameter is required.',
  },
  NO_ORDERS_TO_SETTLE: {
    status: 400,
    message: 'No baking or dispatched orders found to settle for this date.',
  },
  ORDERS_ALREADY_SETTLED: {
    status: 400,
    message: 'All orders for this date are already delivered.',
  },

  // Internal Fallback
  INTERNAL_SERVER_ERROR: {
    status: 500,
    message: 'An unexpected internal error occurred.',
  },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

