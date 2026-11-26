// auth.js - PANOOJA Luxury Client Authentication via Google / Gmail
// Supports Google Identity Services (GSI) OAuth 2.0 & Instant Gmail Login

(function() {
  'use strict';

  // Configurable Google Client ID (from environment or global config)
  const DEFAULT_GOOGLE_CLIENT_ID = window.PANOOJA_GOOGLE_CLIENT_ID || '63300831514-5qg0db4qmdnfa5g4vkfqh339e3asriv2.apps.googleusercontent.com';
  const STORAGE_KEY = 'panooja_client_user';

  // State
  let currentUser = null;

  // =============================================================
  // USER STORAGE & SESSION MANAGEMENT
  // =============================================================
  function getStoredUser() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn('Unable to access localStorage for user session:', e);
      return null;
    }
  }

  function saveUser(user) {
    currentUser = user;
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Unable to save user session to localStorage:', e);
    }
    updateUI();
  }

  // =============================================================
  // JWT TOKEN DECODER (Google Identity Services credential)
  // =============================================================
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (err) {
      console.error('Failed to parse Google JWT credential:', err);
      return null;
    }
  }

  // =============================================================
  // GOOGLE IDENTITY SERVICES (GSI) INITIALIZATION
  // =============================================================
  function initGoogleIdentity() {
    if (typeof window.google === 'undefined' || !window.google.accounts || !window.google.accounts.id) {
      // SDK not loaded yet, retry shortly
      setTimeout(initGoogleIdentity, 300);
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: DEFAULT_GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: true
      });

      // Render button if container exists
      renderGsiButton();

      // Prompt One Tap if guest (FedCM handles display silently without deprecated status callbacks)
      if (!currentUser) {
        window.google.accounts.id.prompt();
      }
    } catch (err) {
      console.log('Google Identity Services note:', err.message);
    }
  }

  function renderGsiButton() {
    const gsiContainer = document.getElementById('googleGsiBtnContainer');
    if (!gsiContainer || typeof window.google === 'undefined' || !window.google.accounts || !window.google.accounts.id) {
      return;
    }

    try {
      gsiContainer.innerHTML = '';
      window.google.accounts.id.renderButton(gsiContainer, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        shape: 'rectangular',
        text: 'signin_with',
        logo_alignment: 'left',
        width: 300
      });
    } catch (err) {
      console.log('Google button rendering fallback:', err);
    }
  }

  // Handle Google OAuth Credential (from GSI iframe / OneTap)
  async function handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) {
      alert('Google Sign-In was cancelled or encountered an error.');
      return;
    }

    showAuthToast('Verifying with Google server...');

    try {
      // Step 7: Await server-side token validation before authenticating
      const verifyRes = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.ok || !verifyData.user) {
        alert('Google verification failed: ' + (verifyData.error || 'Invalid Google account'));
        return;
      }

      const verifiedUser = {
        ...verifyData.user,
        signedInAt: new Date().toISOString(),
        phone: currentUser ? (currentUser.phone || '') : '',
        address: currentUser ? (currentUser.address || '') : '',
        pincode: currentUser ? (currentUser.pincode || '') : ''
      };

      saveUser(verifiedUser);
      closeAuthModal();
      showAuthToast(`Welcome back, ${verifiedUser.givenName}! Verified with Google.`);

    } catch (err) {
      console.error('Server Google auth error:', err);
      alert('Could not verify Google credentials with the server. Please check your internet connection.');
    }
  }

  // Direct Email / Guest Profile for local device convenience
  function handleDirectGmailLogin(email, name = '') {
    email = (email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address.');
      return false;
    }

    const extractedName = name.trim() || email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const initials = extractedName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

    // Stored as unverified guest profile for local device convenience only
    const guestUser = {
      id: 'guest_' + Date.now(),
      name: extractedName,
      givenName: extractedName.split(' ')[0],
      email: email,
      initials: initials,
      picture: '',
      verified: false, // NOT a verified Google account
      authMethod: 'guest_device_profile',
      signedInAt: new Date().toISOString(),
      phone: currentUser ? (currentUser.phone || '') : '',
      address: currentUser ? (currentUser.address || '') : '',
      pincode: currentUser ? (currentUser.pincode || '') : ''
    };

    saveUser(guestUser);
    closeAuthModal();
    showAuthToast(`Saved guest details for ${guestUser.name} on this device`);
    return true;
  }

  // Sign out
  function handleSignOut() {
    saveUser(null);
    if (typeof window.google !== 'undefined' && window.google.accounts && window.google.accounts.id) {
      try {
        window.google.accounts.id.disableAutoSelect();
      } catch (e) {}
    }
    closeAuthModal();
    showAuthToast('You have been signed out.');
  }

  // Save updated client shipping profile
  function saveClientShippingDetails(phone, address, pincode) {
    if (!currentUser) return;
    currentUser.phone = (phone || '').trim();
    currentUser.address = (address || '').trim();
    currentUser.pincode = (pincode || '').trim();
    saveUser(currentUser);
    showAuthToast('Shipping preferences saved to your account!');
  }

  // =============================================================
  // UI UPDATES & DOM SYNC
  // =============================================================
  function updateUI() {
    currentUser = getStoredUser();

    // 1. Header Account Button
    const navAccountBtn = document.getElementById('navAccountBtn');
    const navAccountLabel = document.getElementById('navAccountLabel');
    const navAccountAvatar = document.getElementById('navAccountAvatar');
    const navAccountIcon = document.getElementById('navAccountIcon');

    if (navAccountBtn) {
      if (currentUser) {
        navAccountBtn.classList.add('logged-in');
        navAccountBtn.setAttribute('title', `Signed in as ${currentUser.name}`);
        if (navAccountLabel) {
          navAccountLabel.textContent = currentUser.givenName || currentUser.name.split(' ')[0];
        }
        if (navAccountAvatar) {
          if (currentUser.picture) {
            navAccountAvatar.innerHTML = `<img src="${currentUser.picture}" alt="${currentUser.name}" class="nav-avatar-img" referrerPolicy="no-referrer" />`;
          } else {
            const initial = (currentUser.initials || currentUser.name[0] || 'P').toUpperCase();
            navAccountAvatar.innerHTML = `<span class="nav-avatar-initial">${initial}</span>`;
          }
          navAccountAvatar.style.display = 'inline-flex';
        }
        if (navAccountIcon) navAccountIcon.style.display = 'none';
      } else {
        navAccountBtn.classList.remove('logged-in');
        navAccountBtn.setAttribute('title', 'Sign in with Gmail');
        if (navAccountLabel) navAccountLabel.textContent = 'Sign In';
        if (navAccountAvatar) navAccountAvatar.style.display = 'none';
        if (navAccountIcon) navAccountIcon.style.display = 'inline-block';
      }
    }

    // 2. Auth Modal Content (Logged-in profile vs Sign-in form)
    renderModalContent();

    // 3. Checkout Form Autofill & Status Banner
    syncCheckoutAutoFill();
  }

  function renderModalContent() {
    const modalBody = document.getElementById('authModalDynamicContent');
    if (!modalBody) return;

    if (currentUser) {
      // Profile View
      const avatarHtml = currentUser.picture
        ? `<img src="${currentUser.picture}" alt="${currentUser.name}" class="profile-avatar-img" referrerPolicy="no-referrer" />`
        : `<div class="profile-avatar-circle">${(currentUser.initials || currentUser.name[0] || 'P').toUpperCase()}</div>`;

      modalBody.innerHTML = `
        <div class="client-profile-card">
          <div class="profile-header">
            ${avatarHtml}
            <div class="profile-info">
              <h4 class="profile-name">${currentUser.name}</h4>
              <p class="profile-email">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                ${currentUser.email}
              </p>
              <div class="profile-badge">
                <span class="badge-dot" style="${currentUser.verified ? 'background: #10B981;' : 'background: #6B7280;'}"></span>
                <span>${currentUser.verified ? 'VERIFIED GOOGLE ACCOUNT · VIP PERKS ACTIVE' : 'GUEST PROFILE (SAVED ON THIS DEVICE)'}</span>
              </div>
            </div>
          </div>

          <div class="profile-perks-box">
            <div class="perk-item">
              <span class="perk-icon">✓</span>
              <div>
                <strong>Exclusive Member Offers</strong>
                <p>Priority access to live festive &amp; WhatsApp concierge perks</p>
              </div>
            </div>
            <div class="perk-item">
              <span class="perk-icon">✓</span>
              <div>
                <strong>Express Delivery &amp; Tracking</strong>
                <p>Instant WhatsApp dispatch notifications</p>
              </div>
            </div>
            <div class="perk-item">
              <span class="perk-icon">✓</span>
              <div>
                <strong>Anti-Tarnish Lifetime Care</strong>
                <p>316L waterproof jewellery guarantee</p>
              </div>
            </div>
          </div>

          <!-- Saved Shipping Preferences -->
          <div class="profile-shipping-section">
            <h5 class="profile-section-title">Saved Delivery Details</h5>
            <form id="saveProfileShippingForm" class="profile-shipping-form" method="post" onsubmit="return false;">
              <div class="form-group">
                <label for="profilePhone">Phone / WhatsApp</label>
                <input type="tel" id="profilePhone" placeholder="10-digit mobile number" value="${currentUser.phone || ''}" pattern="[0-9]{10}" />
              </div>
              <div class="form-group">
                <label for="profileAddress">Delivery Address</label>
                <textarea id="profileAddress" rows="2" placeholder="House/Flat No., Street, Landmark, City, State">${currentUser.address || ''}</textarea>
              </div>
              <div class="form-group">
                <label for="profilePincode">Pincode</label>
                <input type="text" id="profilePincode" placeholder="6-digit pincode" value="${currentUser.pincode || ''}" pattern="[0-9]{6}" />
              </div>
              <button type="submit" class="button button-secondary" style="width: 100%; padding: 10px; font-size: 0.8rem; margin-top: 4px;">
                Save Delivery Preferences
              </button>
            </form>
          </div>

          <!-- Profile Actions -->
          <div class="profile-actions">
            <button type="button" class="button button-primary" id="profileViewBagBtn" style="width: 100%;">
              View Shopping Bag
            </button>
            <button type="button" class="button-signout" id="profileSignOutBtn">
              Sign Out of Account
            </button>
          </div>
        </div>
      `;

      // Event listeners for profile view
      const saveForm = document.getElementById('saveProfileShippingForm');
      if (saveForm) {
        saveForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const phone = document.getElementById('profilePhone').value;
          const address = document.getElementById('profileAddress').value;
          const pincode = document.getElementById('profilePincode').value;
          saveClientShippingDetails(phone, address, pincode);
        });
      }

      const viewBagBtn = document.getElementById('profileViewBagBtn');
      if (viewBagBtn) {
        viewBagBtn.addEventListener('click', () => {
          closeAuthModal();
          if (typeof window.openCartDrawer === 'function') {
            window.openCartDrawer();
          } else {
            window.location.href = '/#shop';
          }
        });
      }

      const signOutBtn = document.getElementById('profileSignOutBtn');
      if (signOutBtn) {
        signOutBtn.addEventListener('click', handleSignOut);
      }

    } else {
      // Sign-In View
      modalBody.innerHTML = `
        <div class="auth-signin-box">
          <div class="auth-intro">
            <p class="auth-eyebrow">PANOOJA CLIENT ACCESS</p>
            <h3 class="auth-title">Sign in with Gmail</h3>
            <p class="auth-desc">
              Connect with your Google account for 1-click checkout, instant VIP perks, and saved order history.
            </p>
          </div>

          <!-- Official Google Identity Services Container -->
          <div class="google-btn-wrapper">
            <div id="googleGsiBtnContainer" class="google-gsi-btn-slot"></div>
          </div>

          <!-- Luxury Gmail 1-Click Form -->
          <div class="auth-divider">
            <span>OR ENTER GMAIL ADDRESS</span>
          </div>

          <form id="directGmailLoginForm" class="direct-gmail-form" method="post" onsubmit="return false;">
            <div class="form-group">
              <label for="directGmailInput">Your Gmail Address</label>
              <div class="input-with-icon">
                <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                <input 
                  type="email" 
                  id="directGmailInput" 
                  placeholder="e.g. yourname@gmail.com" 
                  required 
                  autocomplete="email"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="directNameInput">Your Name (Optional)</label>
              <input 
                type="text" 
                id="directNameInput" 
                placeholder="e.g. Priya Sharma" 
                autocomplete="name"
              />
            </div>

            <button type="submit" class="button button-primary auth-submit-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg>
              Continue with Gmail
            </button>
          </form>

          <!-- Perks Checklist -->
          <div class="auth-perks-list">
            <div class="perk-tag">✓ 10% Off First Purchase</div>
            <div class="perk-tag">✓ Auto-filled Express Delivery</div>
            <div class="perk-tag">✓ Secure &amp; Anti-Tarnish Guarantee</div>
          </div>
        </div>
      `;

      // Trigger GSI button rendering
      setTimeout(renderGsiButton, 50);

      const directForm = document.getElementById('directGmailLoginForm');
      if (directForm) {
        directForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const email = document.getElementById('directGmailInput').value;
          const name = document.getElementById('directNameInput').value;
          handleDirectGmailLogin(email, name);
        });
      }
    }
  }

  // Autofill checkout details when user is signed in
  function syncCheckoutAutoFill() {
    // 1. Slide-out Drawer Checkout Modal
    const drawerName = document.getElementById('checkoutName');
    const drawerPhone = document.getElementById('checkoutPhone');
    const drawerEmail = document.getElementById('checkoutEmail');
    const drawerStreet = document.getElementById('checkoutStreet') || document.getElementById('checkoutAddress');
    const drawerPincode = document.getElementById('checkoutPincode');
    const clientStatusEl = document.getElementById('checkoutClientStatus');

    if (currentUser) {
      if (drawerName && !drawerName.value) drawerName.value = currentUser.name || '';
      if (drawerPhone && !drawerPhone.value && currentUser.phone) drawerPhone.value = currentUser.phone;
      if (drawerEmail && !drawerEmail.value && currentUser.email) drawerEmail.value = currentUser.email;
      if (drawerStreet && !drawerStreet.value && currentUser.address) drawerStreet.value = currentUser.address;
      if (drawerPincode && !drawerPincode.value && currentUser.pincode) drawerPincode.value = currentUser.pincode;

      if (clientStatusEl) {
        const isVerified = currentUser.verified;
        clientStatusEl.innerHTML = `
          <div class="checkout-client-pill">
            <span class="dot-online" style="${isVerified ? 'background: #10B981;' : 'background: #6B7280;'}"></span>
            <span>${isVerified ? '✓ Verified Google Account:' : 'Saved Guest Details:'} <strong>${currentUser.name}</strong> (${currentUser.email})</span>
            <button type="button" class="btn-text-link" id="checkoutSignOutLink">Change</button>
          </div>
        `;
        const link = document.getElementById('checkoutSignOutLink');
        if (link) link.addEventListener('click', handleSignOut);
      }
    } else {
      if (clientStatusEl) {
        clientStatusEl.innerHTML = `
          <div class="checkout-guest-pill">
            <span>Have a Gmail account?</span>
            <button type="button" class="btn-text-link" id="checkoutSignInLink">Sign in with Gmail for 1-click details</button>
          </div>
        `;
        const link = document.getElementById('checkoutSignInLink');
        if (link) link.addEventListener('click', openAuthModal);
      }
    }

    // 2. Dedicated checkout.html page
    const pageName = document.getElementById('pageCheckoutName');
    const pagePhone = document.getElementById('pageCheckoutPhone');
    const pageEmail = document.getElementById('pageCheckoutEmail');
    const pageStreet = document.getElementById('pageCheckoutStreet') || document.getElementById('pageCheckoutAddress');
    const pagePincode = document.getElementById('pageCheckoutPincode');
    const pageClientStatus = document.getElementById('pageCheckoutClientStatus');

    if (currentUser) {
      if (pageName && !pageName.value) pageName.value = currentUser.name || '';
      if (pagePhone && !pagePhone.value && currentUser.phone) pagePhone.value = currentUser.phone;
      if (pageEmail && !pageEmail.value && currentUser.email) pageEmail.value = currentUser.email;
      if (pageStreet && !pageStreet.value && currentUser.address) pageStreet.value = currentUser.address;
      if (pagePincode && !pagePincode.value && currentUser.pincode) pagePincode.value = currentUser.pincode;

      if (pageClientStatus) {
        const isVerified = currentUser.verified;
        pageClientStatus.innerHTML = `
          <div class="checkout-client-pill">
            <span class="dot-online" style="${isVerified ? 'background: #10B981;' : 'background: #6B7280;'}"></span>
            <span>${isVerified ? '✓ Verified Google Account:' : 'Saved Guest Details:'} <strong>${currentUser.name}</strong> (${currentUser.email})</span>
            <button type="button" class="btn-text-link" id="pageCheckoutSignOutLink">Change</button>
          </div>
        `;
        const link = document.getElementById('pageCheckoutSignOutLink');
        if (link) link.addEventListener('click', handleSignOut);
      }
    } else {
      if (pageClientStatus) {
        pageClientStatus.innerHTML = `
          <div class="checkout-guest-pill">
            <span>Have a Gmail account?</span>
            <button type="button" class="btn-text-link" id="pageCheckoutSignInLink">Sign in with Gmail for 1-click details</button>
          </div>
        `;
        const link = document.getElementById('pageCheckoutSignInLink');
        if (link) link.addEventListener('click', openAuthModal);
      }
    }
  }

  // Toast notification
  function showAuthToast(message) {
    const existing = document.getElementById('authToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'authToast';
    toast.className = 'auth-toast';
    toast.innerHTML = `
      <div class="toast-content">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('visible');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Modal open / close
  function openAuthModal() {
    const modal = document.getElementById('authModal');
    const backdrop = document.getElementById('authModalBackdrop');
    if (modal && backdrop) {
      modal.classList.add('open');
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
      renderModalContent();
    }
  }

  function closeAuthModal() {
    const modal = document.getElementById('authModal');
    const backdrop = document.getElementById('authModalBackdrop');
    if (modal && backdrop) {
      modal.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // =============================================================
  // INITIALIZATION & EVENT LISTENERS
  // =============================================================
  document.addEventListener('DOMContentLoaded', () => {
    // Check session
    currentUser = getStoredUser();

    // Setup Header Account Button
    const navAccountBtn = document.getElementById('navAccountBtn');
    if (navAccountBtn) {
      navAccountBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal();
      });
    }

    // Modal Close Triggers
    const closeBtn = document.getElementById('closeAuthModal');
    if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);

    const backdrop = document.getElementById('authModalBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeAuthModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAuthModal();
    });

    // Initial render
    updateUI();

    // Initialize Google Identity Services
    initGoogleIdentity();
  });

  // Expose on window
  window.panoojaAuth = {
    getUser: () => currentUser,
    openModal: openAuthModal,
    closeModal: closeAuthModal,
    signOut: handleSignOut,
    loginWithGmail: handleDirectGmailLogin,
    saveDetails: saveClientShippingDetails
  };

})();
