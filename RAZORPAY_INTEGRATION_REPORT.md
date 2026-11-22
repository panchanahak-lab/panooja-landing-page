# PANOOJA — Razorpay Standard Web Checkout Integration Report

## 1. Executive Summary

Razorpay Standard Web Checkout has been integrated into the **PANOOJA** luxury jewellery e-commerce platform.

The integration provides end-to-end payment processing:
- **Serverless & Node.js backend**: Creates orders securely via Razorpay API and verifies digital signatures via cryptographic HMAC-SHA256 timing-safe comparison.
- **Client-Side UX**: Modal checkout loaded seamlessly on both the slide-out cart drawer and dedicated checkout pages, fully branded with PANOOJA identity and responsive layout.
- **Security & Safety**: Secrets are strictly isolated in `.env` (git-ignored); the frontend receives only the dynamic `key_id` and order ID upon initiating checkout.

---

## 2. Architecture & File Overview

| File Path | Role / Description |
|:---|:---|
| [package.json](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/package.json) | Node.js ESM configuration, `razorpay` (`^2.9.8`), `dotenv` (`^18.0.10`), and `npm start` script. |
| [.env](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/.env) | Environment credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`), excluded from Git via `.gitignore`. |
| [.env.example](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/.env.example) | Public repository template with environment variable placeholders for CI/CD and deployment. |
| [.gitignore](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/.gitignore) | Git exclusions protecting `.env` and `node_modules/`. |
| [api/create-order.js](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/api/create-order.js) | Serverless `POST /api/create-order` endpoint. Validates amount (>= 100 paise), initializes Razorpay order, returns `{ order_id, amount, currency, key_id }`. |
| [api/verify-payment.js](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/api/verify-payment.js) | Serverless `POST /api/verify-payment` endpoint. Computes `HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)` and verifies signatures with `crypto.timingSafeEqual`. |
| [server.js](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/server.js) | Local Node.js HTTP server routing API requests to serverless handlers and serving static assets. |
| [cart.js](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/cart.js) | Frontend client orchestration: validates customer shipping form, fetches order, mounts `Razorpay(options)`, handles success, failure, and dismissal. |
| [index.html](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/index.html) | Main storefront with Razorpay checkout script and drawer checkout button. |
| [checkout.html](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/checkout.html) | Dedicated checkout page with Razorpay script and event listener. |
| [cart.html](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/cart.html) | Standalone cart view with Razorpay script included. |

---

## 3. Endpoints Specification

### 1. Create Order (`POST /api/create-order`)

- **URL:** `/api/create-order`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "amount": 242700,
    "currency": "INR",
    "receipt": "rcpt_1774351658498",
    "customer_name": "Aarav Sharma",
    "customer_phone": "9876543210",
    "delivery_address": "Flat 402, Lotus Heights, MG Road, PIN: 400001"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "ok": true,
    "order_id": "order_U3HLUPkAzrkJvk",
    "amount": 242700,
    "currency": "INR",
    "key_id": "rzp_test_U3H7dGLiy2pKOP"
  }
  ```
- **Validation & Error Codes:**
  - `400 Bad Request`: If `amount < 100` paise (minimum order requirement: ₹1).
  - `401 Unauthorized`: If `RAZORPAY_KEY_ID` or `RAZORPAY_KEY_SECRET` missing from server environment.
  - `500 Internal Server Error`: On Razorpay API failures.

---

### 2. Verify Signature (`POST /api/verify-payment`)

- **URL:** `/api/verify-payment`
- **Method:** `POST`
- **Algorithm:**
  $$\text{Signature} = \text{HMAC-SHA256}(\text{razorpay\_order\_id} + "|" + \text{razorpay\_payment\_id}, \text{RAZORPAY\_KEY\_SECRET})$$
- **Request Body:**
  ```json
  {
    "razorpay_order_id": "order_U3HLUPkAzrkJvk",
    "razorpay_payment_id": "pay_test_12345",
    "razorpay_signature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
  ```
- **Response (200 OK on match):**
  ```json
  {
    "ok": true,
    "message": "Payment verified successfully.",
    "payment_id": "pay_test_12345",
    "order_id": "order_U3HLUPkAzrkJvk"
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: Missing fields, signature length mismatch, or invalid HMAC signature.

---

## 4. Production Deployment Instructions

### Vercel / Netlify Deployment
1. Set the following Environment Variables in your Vercel or Netlify project settings:
   - `RAZORPAY_KEY_ID`: `rzp_test_U3H7dGLiy2pKOP` (or your live key `rzp_live_...`)
   - `RAZORPAY_KEY_SECRET`: `W71B9tjZuHywebqeQJ9ADQge` (or your live secret)
2. Deploy directly from the `main` branch. Both serverless functions (`api/create-order.js` and `api/verify-payment.js`) are located in the standard `api/` directory and will be detected automatically.
