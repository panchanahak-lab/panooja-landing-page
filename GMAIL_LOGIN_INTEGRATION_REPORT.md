# PANOOJA — Gmail & Google Client Authentication Integration

## 1. Overview

A client authentication portal powered by **Gmail / Google** has been integrated into the **PANOOJA** luxury jewellery storefront.

Clients can sign in using their Gmail account to unlock:
- **1-Click Express Checkout**: Automatic population of Name, Phone, Delivery Address, and Pincode on checkout.
- **Client Profile Portal**: View Google avatar, verified Gmail status, active VIP perks (`WELCOME10`), and manage saved delivery preferences.
- **WhatsApp Order Sync**: The client's verified Gmail is automatically included in the WhatsApp order summary for instant tracking.
- **Dual Authentication Mode**:
  1. **Official Google Identity Services (GSI) OAuth 2.0**: Renders official "Sign in with Google" button and decodes cryptographic Google ID tokens.
  2. **Direct Gmail 1-Click Login**: Instant login option allowing clients to enter their Gmail address directly, functioning seamlessly across local and production environments.

---

## 2. Architecture & File Breakdown

| File Path | Role & Changes |
|:---|:---|
| [auth.js](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/auth.js) | Core authentication module: GSI initialization, JWT decoding, user session persistence (`localStorage`), modal rendering, profile management, and checkout autofill. |
| [api/auth/google.js](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/api/auth/google.js) | Serverless backend endpoint `POST /api/auth/google`: Verifies Google ID tokens with Google's public tokeninfo service. |
| [styles.css](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/styles.css) | Luxury styling for the header Account button, avatar badges, Client Portal modal, saved address preferences form, and checkout status banners. |
| [index.html](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/index.html) | Main storefront with Google Identity Services SDK, header account trigger, and Client Portal modal. |
| [checkout.html](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/checkout.html) | Dedicated checkout page with account button, modal, and live autofill banner. |
| [cart.html](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/cart.html) | Shopping bag page with persistent account state and modal. |
| [cart.js](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/cart.js) | Updated `openCheckoutModal` and `orderViaWhatsApp` to read client details and attach verified Gmail to orders. |
| [server.js](file:///c:/Users/Panchanan/Downloads/panooja-landing-page/panooja-landing-page/server.js) | Integrated `/api/auth/google` route for local development and production. |

---

## 3. End-to-End Verification Evidence

### Checkout Auto-Fill Screenshot
The test verified that once signed in via Gmail, the client profile details (Name, WhatsApp Phone, Address, and Pincode) auto-populate directly inside the checkout dialog:

![Gmail Login Checkout Auto-Fill](file:///C:/Users/Panchanan/.gemini/antigravity/brain/caba5a96-4a2b-4d7f-b4e0-0bb79f186a90/gmail_login_checkout_autofill.png)

---

## 4. Google Cloud Console Setup (Optional Custom Client ID)

To connect your own Google Cloud OAuth Client ID:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create a new OAuth 2.0 Client ID for **Web Application**.
3. Add Authorized JavaScript Origins:
   - `https://www.panooja.com`
   - `http://localhost:3000` (for local development)
4. Add your Client ID to `.env`:
   ```bash
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   ```
   Or set `window.PANOOJA_GOOGLE_CLIENT_ID = 'your_client_id';` in `auth.js`.
