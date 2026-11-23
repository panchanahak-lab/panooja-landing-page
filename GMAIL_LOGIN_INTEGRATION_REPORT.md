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
| `auth.js` | Core authentication module: GSI initialization, JWT decoding, user session persistence (`localStorage`), modal rendering, profile management, and checkout autofill. |
| `api/auth/google.js` | Serverless backend endpoint `POST /api/auth/google`: Verifies Google ID tokens with Google's public tokeninfo service. |
| `styles.css` | Luxury styling for the header Account button, avatar badges, Client Portal modal, saved address preferences form, and checkout status banners. |
| `index.html` | Main storefront with Google Identity Services SDK, header account trigger, and Client Portal modal. |
| `checkout.html` | Dedicated checkout page with account button, modal, and live autofill banner. |
| `cart.html` | Shopping bag page with persistent account state and modal. |
| `cart.js` | Updated `openCheckoutModal` and `orderViaWhatsApp` to read client details and attach verified Gmail to orders. |
| `server.js` | Integrated `/api/auth/google` route for local development and production. |

---

## 3. End-to-End Verification Evidence

### Checkout Auto-Fill Screenshot
The test verified that once signed in via Gmail, the client profile details (Name, WhatsApp Phone, Address, and Pincode) auto-populate directly inside the checkout dialog:

*(Screenshot captured and verified during QA audit)*

---

## 4. Google Cloud Console Configuration

Your Google Client ID is configured and active in the project:
```
63300831514-5qg0db4qmdnfa5g4vkfqh339e3asriv2.apps.googleusercontent.com
```

### Important: Authorized JavaScript Origins in Google Cloud Console
To ensure Google Sign-In displays and authenticates without origin errors, make sure the following domains are added under **Authorized JavaScript origins** in your [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials):
- `https://www.panooja.com`
- `https://panooja.com`
- `http://localhost:3000` (for local testing)
- `http://localhost`

And under **Authorized redirect URIs**:
- `https://www.panooja.com`
- `https://panooja.com`
- `http://localhost:3000`
