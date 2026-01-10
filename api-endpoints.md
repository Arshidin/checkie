# API Endpoints Specification

## Base URL
```
Production: https://api.checkie.com
Development: http://localhost:3000
```

## Authentication
All endpoints except `/api/auth/*` and `/api/widget/*` require Bearer token.

```
Authorization: Bearer <access_token>
```

---

## Auth Endpoints

### POST /api/auth/register
Create new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:** `201 Created`
```json
{
  "data": {
    "user": {
      "id": "cuid...",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### POST /api/auth/login
**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { ... }
  }
}
```

### POST /api/auth/refresh
**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response:** `200 OK`
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### POST /api/auth/logout
Revoke refresh token.

### POST /api/auth/forgot-password
**Request:**
```json
{
  "email": "user@example.com"
}
```

### POST /api/auth/reset-password
**Request:**
```json
{
  "token": "reset-token",
  "password": "newpassword123"
}
```

### GET /api/auth/me
Get current user.

---

## Users Endpoints

### GET /api/users/me
### PATCH /api/users/me
### PATCH /api/users/me/password
### DELETE /api/users/me

---

## Stores Endpoints

### GET /api/stores
List user's stores.

**Response:**
```json
{
  "data": [
    {
      "id": "store_123",
      "name": "My Store",
      "slug": "my-store",
      "role": "OWNER"
    }
  ]
}
```

### POST /api/stores
Create store.

**Request:**
```json
{
  "name": "My Store",
  "defaultCurrency": "USD"
}
```

### GET /api/stores/:storeId
### PATCH /api/stores/:storeId
### DELETE /api/stores/:storeId

### GET /api/stores/:storeId/stats
**Response:**
```json
{
  "data": {
    "totalRevenue": 12500.00,
    "totalPayments": 150,
    "activeSubscriptions": 25,
    "balance": 8500.00
  }
}
```

---

## Pages Endpoints

### GET /api/stores/:storeId/pages
**Query params:**
- `status`: DRAFT | ACTIVE | ARCHIVED
- `pricingType`: FIXED | PAY_WHAT_YOU_WANT | SUBSCRIPTION
- `page`: number (default: 1)
- `limit`: number (default: 20)

### POST /api/stores/:storeId/pages
**Request:**
```json
{
  "name": "Premium Course",
  "slug": "premium-course",
  "pricingType": "FIXED",
  "price": 99.00,
  "currency": "USD",
  "headline": "Learn to code",
  "buttonText": "Buy Now"
}
```

### GET /api/stores/:storeId/pages/:pageId
### PATCH /api/stores/:storeId/pages/:pageId
### DELETE /api/stores/:storeId/pages/:pageId

### POST /api/stores/:storeId/pages/:pageId/publish
Change status to ACTIVE.

### POST /api/stores/:storeId/pages/:pageId/archive
Change status to ARCHIVED.

### POST /api/stores/:storeId/pages/:pageId/duplicate
Create copy of page.

---

## Variants Endpoints

### GET /api/stores/:storeId/pages/:pageId/variants
### POST /api/stores/:storeId/pages/:pageId/variants
**Request:**
```json
{
  "name": "Size",
  "isRequired": true,
  "options": [
    { "name": "Small", "priceModifier": 0 },
    { "name": "Large", "priceModifier": 10.00 }
  ]
}
```

### PATCH /api/stores/:storeId/pages/:pageId/variants/:variantId
### DELETE /api/stores/:storeId/pages/:pageId/variants/:variantId

### POST .../variants/:variantId/options
### PATCH .../variants/:variantId/options/:optionId
### DELETE .../variants/:variantId/options/:optionId

---

## Custom Fields Endpoints

### GET /api/stores/:storeId/pages/:pageId/custom-fields
### POST /api/stores/:storeId/pages/:pageId/custom-fields
**Request:**
```json
{
  "name": "company_name",
  "label": "Company Name",
  "type": "TEXT",
  "isRequired": true,
  "placeholder": "Enter company name"
}
```

### PATCH .../custom-fields/:fieldId
### DELETE .../custom-fields/:fieldId
### PATCH .../custom-fields/reorder
**Request:**
```json
{
  "order": ["field_1", "field_3", "field_2"]
}
```

---

## Embeds Endpoints

### GET /api/stores/:storeId/pages/:pageId/embeds
### POST /api/stores/:storeId/pages/:pageId/embeds
**Request:**
```json
{
  "type": "POPUP",
  "settings": {
    "buttonText": "Buy Now",
    "buttonColor": "#333333"
  }
}
```

### GET .../embeds/:embedId/code
**Response:**
```json
{
  "data": {
    "type": "POPUP",
    "html": "<script src=\"https://widget.checkie.com/popup.js\"></script>...",
    "previewUrl": "https://widget.checkie.com/preview/embed_123"
  }
}
```

---

## Payments Endpoints

### GET /api/stores/:storeId/payments
**Query params:**
- `status`: PENDING | COMPLETED | REFUNDED | etc.
- `pageId`: filter by page
- `customerId`: filter by customer
- `from`: ISO date
- `to`: ISO date
- `page`, `limit`

### GET /api/stores/:storeId/payments/:paymentId

### GET /api/stores/:storeId/payments/export
**Query params:**
- `format`: csv | xlsx
- `from`: ISO date
- `to`: ISO date

**Response:** File download

---

## Subscriptions Endpoints

### GET /api/stores/:storeId/subscriptions
### GET /api/stores/:storeId/subscriptions/:subscriptionId

### POST .../subscriptions/:subscriptionId/cancel
**Request:**
```json
{
  "cancelAtPeriodEnd": true,
  "reason": "Too expensive"
}
```

### POST .../subscriptions/:subscriptionId/pause
### POST .../subscriptions/:subscriptionId/resume

---

## Refunds Endpoints

### GET /api/stores/:storeId/refunds

### POST /api/stores/:storeId/payments/:paymentId/refund
**Request:**
```json
{
  "amount": 50.00,
  "reason": "REQUESTED_BY_CUSTOMER",
  "reasonDetails": "Customer changed mind"
}
```

### GET /api/stores/:storeId/refunds/:refundId

---

## Payouts Endpoints

### GET /api/stores/:storeId/payouts

### POST /api/stores/:storeId/payouts
**Request:**
```json
{
  "amount": 1000.00,
  "method": "BANK_TRANSFER",
  "destination": {
    "bankName": "Chase",
    "accountNumber": "****1234",
    "routingNumber": "****5678"
  }
}
```

### GET /api/stores/:storeId/payouts/:payoutId

---

## Balance Endpoints

### GET /api/stores/:storeId/balance
**Response:**
```json
{
  "data": {
    "available": 8500.00,
    "pending": 1200.00,
    "currency": "USD"
  }
}
```

### GET /api/stores/:storeId/balance/transactions
**Query params:**
- `type`: PAYMENT_RECEIVED | REFUND | PAYOUT_REQUESTED | etc.
- `from`, `to`, `page`, `limit`

### GET /api/stores/:storeId/balance/report
**Query params:**
- `period`: day | week | month | year
- `from`, `to`

---

## Customers Endpoints

### GET /api/stores/:storeId/customers
### GET /api/stores/:storeId/customers/:customerId
### GET .../customers/:customerId/payments
### GET .../customers/:customerId/subscriptions

---

## Coupons Endpoints

### GET /api/stores/:storeId/coupons
### POST /api/stores/:storeId/coupons
**Request:**
```json
{
  "code": "SAVE20",
  "discountType": "percent",
  "discountValue": 20,
  "maxUses": 100,
  "expiresAt": "2026-12-31T23:59:59Z",
  "pageIds": ["page_1", "page_2"]
}
```

### PATCH /api/stores/:storeId/coupons/:couponId
### DELETE /api/stores/:storeId/coupons/:couponId

---

## Webhooks Endpoints (Merchant Management)

### GET /api/stores/:storeId/webhooks
### POST /api/stores/:storeId/webhooks
**Request:**
```json
{
  "url": "https://example.com/webhooks/checkie",
  "events": ["payment.completed", "subscription.cancelled"],
  "description": "Main webhook"
}
```

### PATCH /api/stores/:storeId/webhooks/:webhookId
### DELETE /api/stores/:storeId/webhooks/:webhookId
### GET /api/stores/:storeId/webhooks/:webhookId/deliveries

---

## Widget API (Public)

### GET /api/widget/pages/:storeSlug/:pageSlug
Get page data and create checkout session.

**Response:**
```json
{
  "data": {
    "sessionId": "session_123",
    "expiresAt": "2026-01-11T13:00:00Z",
    "page": {
      "name": "Premium Course",
      "headline": "Learn to code",
      "price": 99.00,
      "currency": "USD",
      "variants": [...],
      "customFields": [...]
    },
    "store": {
      "name": "My Store",
      "logoUrl": "..."
    }
  }
}
```

### PATCH /api/widget/sessions/:sessionId
Update session data.

**Request:**
```json
{
  "email": "buyer@example.com",
  "firstName": "Jane",
  "selectedVariants": { "variant_1": "option_2" },
  "customFields": { "company_name": "Acme Inc" }
}
```

### POST /api/widget/checkout
Initiate payment.

**Request:**
```json
{
  "sessionId": "session_123"
}
```

**Response:**
```json
{
  "data": {
    "clientSecret": "pi_xxx_secret_yyy",
    "paymentId": "payment_123",
    "requiresAction": false
  }
}
```

### GET /api/widget/sessions/:sessionId/status
**Response:**
```json
{
  "data": {
    "status": "COMPLETED",
    "payment": {
      "id": "payment_123",
      "amount": 99.00
    }
  }
}
```

### POST /api/widget/validate-coupon
**Request:**
```json
{
  "sessionId": "session_123",
  "code": "SAVE20"
}
```

**Response:**
```json
{
  "data": {
    "valid": true,
    "discountType": "percent",
    "discountValue": 20,
    "newAmount": 79.20
  }
}
```

---

## Customer Portal (Public)

### POST /api/portal/request-access
**Request:**
```json
{
  "email": "buyer@example.com",
  "storeId": "store_123"
}
```

### GET /api/portal/verify/:token
Returns JWT for portal access.

### GET /api/portal/purchases
Requires portal JWT.

### GET /api/portal/subscriptions
### POST /api/portal/subscriptions/:id/cancel

---

## PSP Webhooks

### POST /api/webhooks/stripe
Stripe webhook endpoint. Verifies signature.

---

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "You don't have access to this store",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Page not found",
  "error": "Not Found"
}
```

### 429 Too Many Requests
```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded",
  "error": "Too Many Requests",
  "retryAfter": 60
}
```

---

## Rate Limits

| Endpoint Group | Limit |
|----------------|-------|
| Auth endpoints | 5 req/min per IP |
| API endpoints | 100 req/min per user |
| Widget endpoints | 30 req/min per IP |
| Webhooks | No limit (signature verified) |

---

*API Specification v1.0*
