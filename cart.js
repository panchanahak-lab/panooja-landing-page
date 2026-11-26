// cart.js - PANOOJA Storefront Cart Engine, Live Offers & Checkout
const PANOOJA_WHATSAPP_NUMBER = (typeof window !== 'undefined' && window.PANOOJA_CONFIG && window.PANOOJA_CONFIG.WHATSAPP_NUMBER) || '917984528870'; // Official PANOOJA WhatsApp concierge number
const OFFERS_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1yF6fF2S8x5dH3u24uH2DNt8WOl9xZ_UTLA6JNmAWbn1XUroDBjS6M-GPXlSHLLtkSaXTllKNQz-n/pub?gid=2&single=true&output=csv';
const FREE_SHIPPING_THRESHOLD = 799;
const STANDARD_SHIPPING_FEE = 79;

function isOnlinePaymentsEnabled() {
  return Boolean(typeof window !== 'undefined' && window.PANOOJA_CONFIG && window.PANOOJA_CONFIG.ONLINE_PAYMENTS_ENABLED === true);
}

function getPanoojaBusinessHours() {
  return (typeof window !== 'undefined' && window.PANOOJA_CONFIG && window.PANOOJA_CONFIG.BUSINESS_HOURS) || 'Mon–Sat, 10:00 AM – 7:00 PM IST';
}

// Toggle Razorpay UI & payment copy consistently across the storefront
function syncPaymentModeUI() {
  const onlineEnabled = isOnlinePaymentsEnabled();

  const modalWrap = document.getElementById('checkoutActionsWrap');
  const modalWaBtn = document.getElementById('checkoutWhatsappBtn');
  const modalOnlineBtn = document.getElementById('checkoutOnlineBtn');
  if (modalOnlineBtn) {
    modalOnlineBtn.style.display = onlineEnabled ? '' : 'none';
    modalOnlineBtn.disabled = !onlineEnabled;
    if (onlineEnabled && modalWrap && modalWaBtn) {
      modalWrap.insertBefore(modalOnlineBtn, modalWaBtn);
    }
  }

  const pageWrap = document.getElementById('pageCheckoutActionsWrap');
  const pageWaBtn = document.getElementById('pageCheckoutWhatsappBtn');
  const pageOnlineBtn = document.getElementById('pageCheckoutOnlineBtn');
  if (pageOnlineBtn) {
    pageOnlineBtn.style.display = onlineEnabled ? '' : 'none';
    pageOnlineBtn.disabled = !onlineEnabled;
    if (onlineEnabled && pageWrap && pageWaBtn) {
      pageWrap.insertBefore(pageOnlineBtn, pageWaBtn);
    }
  }

  const trustTitle = document.getElementById('trustStripPaymentTitle');
  const trustDesc = document.getElementById('trustStripPaymentDesc');
  if (trustTitle) trustTitle.textContent = onlineEnabled ? 'Secure UPI & Cards' : 'Easy WhatsApp ordering';
  if (trustDesc) trustDesc.textContent = onlineEnabled ? '100% encrypted checkout via Razorpay & WhatsApp' : 'Confirm your order and pay by UPI';

  const faqPayment = document.getElementById('faqPaymentAnswer');
  if (faqPayment) {
    faqPayment.textContent = onlineEnabled
      ? 'We support 100% secure online payments through Razorpay, including UPI (Google Pay, PhonePe, Paytm), Debit/Credit Cards, and Net Banking. You can also complete your order seamlessly via WhatsApp with one click!'
      : 'Order via WhatsApp — we confirm stock and share UPI payment details, and dispatch once payment is received.';
  }

  const modalNote = document.getElementById('checkoutPaymentNote');
  if (modalNote) {
    modalNote.textContent = onlineEnabled
      ? '🔒 100% Encrypted Checkout via Razorpay · Replacement within 7 days for damaged, defective or wrong items. An uncut unboxing video is required.'
      : 'Pay by UPI after we confirm your order on WhatsApp · Replacement within 7 days for damaged, defective or wrong items. An uncut unboxing video is required.';
  }

  const pageNote = document.getElementById('pageCheckoutPaymentNote');
  if (pageNote) {
    pageNote.textContent = onlineEnabled
      ? '🔒 100% Encrypted Checkout via Razorpay'
      : 'Pay by UPI after we confirm your order on WhatsApp';
  }
}

let cart = JSON.parse(localStorage.getItem('panooja_cart')) || [];
let appliedCoupon = localStorage.getItem('panooja_coupon') || null;
let liveOffersMap = new Map();
let liveOffersLoaded = false;
let offersFetchPromise = null;
let lastPromoFeedback = { type: '', message: '' };

function escapeCartHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Self-contained RFC-4180 CSV parser for Offers Sheet
function parseOffersCsvText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some(cell => cell.trim() !== '')) {
        rows.push(row);
      }
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some(cell => cell.trim() !== '')) {
      rows.push(row);
    }
  }
  return rows;
}

function normalizeOfferCategoryGroup(cat) {
  const c = String(cat || '').trim().toLowerCase();
  if (!c || c === 'all' || c === 'all products') return 'all';
  if (c.includes('earring')) return 'earrings';
  if (c.includes('ring')) return 'rings';
  if (c.includes('pendant') || c.includes('chain') || c.includes('necklace')) return 'pendants';
  if (c.includes('kada') || c.includes('bracelet') || c.includes('bangle')) return 'bracelets';
  return c;
}

function doesCartItemMatchOfferCategory(itemCategory, appliesTo) {
  const parts = String(appliesTo || '').split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return true;
  const rawItem = String(itemCategory || '').trim().toLowerCase();
  const itemGroup = normalizeOfferCategoryGroup(itemCategory);
  return parts.some(part => {
    const partGroup = normalizeOfferCategoryGroup(part);
    if (partGroup === 'all') return true;
    return rawItem === part.toLowerCase() || itemGroup === partGroup;
  });
}

function parseOffersFromCsv(csvData) {
  const rows = parseOffersCsvText(csvData);
  const offers = new Map();
  if (!rows || rows.length < 2) return offers;

  const headers = rows[0].map(h => (h || '').trim());
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;

    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (row[idx] || '').trim();
    });

    const code = (obj['Offer Code'] || '').trim().toUpperCase();
    if (!code) continue;

    // Strictly require Live Status === 'Live' (case-insensitive, trimmed)
    const liveStatus = (obj['Live Status'] || '').trim().toLowerCase();
    if (liveStatus !== 'live') continue;

    const rawType = (obj['Discount Type'] || '').trim().toLowerCase();
    let discountType = 'flat_inr';
    if (rawType.includes('percent') || rawType.includes('%')) {
      discountType = 'percentage';
    } else if (rawType.includes('free') || rawType.includes('ship')) {
      discountType = 'free_shipping';
    }

    const discountValue = parseFloat(String(obj['Discount Value'] || '0').replace(/[^0-9.]/g, '')) || 0;
    const minOrderValue = parseInt(String(obj['Min Order Value (INR)'] || obj['Min Order Value'] || '0').replace(/[^0-9]/g, ''), 10) || 0;
    const appliesTo = (obj['Applies To'] || 'All Products').trim() || 'All Products';
    const bannerTitle = (obj['Banner / Offer Title'] || obj['Offer Title'] || '').trim();
    const rawShow = (obj['Show on Website (Yes/No)'] || obj['Show on Website'] || '').trim().toLowerCase();
    const showOnWebsite = rawShow === 'yes';

    offers.set(code, {
      code,
      bannerTitle,
      discountType,
      discountValue,
      minOrderValue,
      appliesTo,
      showOnWebsite,
      liveStatus: 'Live'
    });
  }
  return offers;
}

// Return only coupons where both Live Status === 'Live' and Show on Website (Yes/No) === 'Yes'
function getPublicLiveOffers() {
  return Array.from(liveOffersMap.values()).filter(o => o.liveStatus === 'Live' && o.showOnWebsite === true);
}

// Return featured public offer for the homepage VIP promo section (if any)
function getFeaturedPublicOffer() {
  const publicOffers = getPublicLiveOffers();
  if (publicOffers.length === 0) return null;
  return publicOffers.find(o => o.code === 'WELCOME10') || publicOffers[0];
}

// Update top announcement bar automatically ONLY with public Live offers (Show on Website === Yes)
function updateAnnouncementBarWithOffers() {
  const bar = document.getElementById('liveAnnouncementBar') || document.querySelector('.announcement[data-live-offers="true"]');
  if (!bar) return;

  const publicOffers = getPublicLiveOffers();
  if (publicOffers.length === 0) {
    bar.innerHTML = `<span class="announcement-dot"></span><span class="announcement-offers">WATERPROOF &amp; ANTI-TARNISH JEWELLERY · FREE EXPRESS SHIPPING ABOVE ₹${FREE_SHIPPING_THRESHOLD}</span>`;
    return;
  }

  const segments = publicOffers.map(offer => {
    const title = offer.bannerTitle || `${offer.code} Offer`;
    const alreadyHasCode = title.toUpperCase().includes(offer.code);
    if (alreadyHasCode) {
      return `<span>${escapeCartHtml(title)}</span>`;
    }
    return `<span>${escapeCartHtml(title)} · CODE: <strong>${escapeCartHtml(offer.code)}</strong></span>`;
  });

  bar.innerHTML = `<span class="announcement-dot"></span><span class="announcement-offers">${segments.join('<span class="announcement-sep" aria-hidden="true">·</span>')}</span>`;
}

// Update Homepage Promo Section dynamically from public offers (never reveals Show on Website = No offers)
function syncHomepagePromoSection() {
  const eyebrowEl = document.getElementById('newsletterEyebrow');
  const headingEl = document.getElementById('newsletterHeading');
  const copyEl = document.getElementById('newsletterCopy');
  const submitBtn = document.getElementById('newsletterSubmitBtn');
  const revealedCodeEl = document.getElementById('revealedCouponCode');
  const revealHeadingEl = document.getElementById('couponRevealHeading');
  const couponHintEl = document.getElementById('newsletterCouponHint');

  if (!eyebrowEl && !headingEl && !copyEl) return;

  const featured = getFeaturedPublicOffer();
  if (!featured) {
    if (eyebrowEl) eyebrowEl.textContent = 'PANOOJA JOURNAL';
    if (headingEl) headingEl.textContent = 'Stay in the loop.';
    if (copyEl) copyEl.textContent = 'Join our list for new drops and styling edits.';
    if (submitBtn && !submitBtn.disabled) submitBtn.textContent = 'Join List';
    if (revealedCodeEl) revealedCodeEl.textContent = '';
    return;
  }

  const offerDesc = featured.bannerTitle || (
    featured.discountType === 'percentage' ? `${featured.discountValue}% Off`
      : featured.discountType === 'free_shipping' ? 'Free Express Shipping'
        : `₹${featured.discountValue} Off`
  );
  const minText = featured.minOrderValue > 0 ? ` above ₹${featured.minOrderValue.toLocaleString('en-IN')}` : '';

  if (eyebrowEl) eyebrowEl.textContent = 'WELCOME OFFER';
  if (headingEl) headingEl.textContent = featured.code === 'WELCOME10' ? 'Join our list & save on your first order.' : offerDesc;
  if (copyEl) {
    if (featured.code === 'WELCOME10') {
      copyEl.innerHTML = 'Join our list for new drops and styling edits. Use <strong>WELCOME10</strong> for 10% off your first order above ₹500.';
    } else {
      copyEl.innerHTML = `Join our list for new drops and styling edits. Use <strong>${escapeCartHtml(featured.code)}</strong> (${escapeCartHtml(offerDesc)}${escapeCartHtml(minText)}).`;
    }
  }
  if (submitBtn && !submitBtn.disabled) {
    submitBtn.textContent = featured.discountType === 'percentage'
      ? `Join & Unlock ${featured.discountValue}% Off`
      : featured.discountType === 'flat_inr'
        ? `Join & Unlock ₹${featured.discountValue} Off`
        : 'Join List';
  }
  if (revealedCodeEl) revealedCodeEl.textContent = featured.code;
  if (revealHeadingEl) revealHeadingEl.textContent = offerDesc;
  if (couponHintEl) {
    couponHintEl.textContent = featured.minOrderValue > 0
      ? `Valid on orders above ₹${featured.minOrderValue.toLocaleString('en-IN')}. Automatically saved for your cart!`
      : 'Automatically saved for your cart!';
  }
}

// Fetch live offers CSV on page load (cached within page session, bypassed on browser reload)
function fetchLiveOffers(forceRefresh = false) {
  if (!forceRefresh && offersFetchPromise) {
    return offersFetchPromise;
  }

  offersFetchPromise = (async () => {
    try {
      const url = `${OFFERS_SHEET_CSV_URL}&_t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csvText = await res.text();
      liveOffersMap = parseOffersFromCsv(csvText);
      liveOffersLoaded = true;
    } catch (err) {
      console.error('Live Offers CSV Fetch Error:', err);
      // Keep existing liveOffersMap if any, mark loaded so UI never hangs
      liveOffersLoaded = true;
    }

    updateAnnouncementBarWithOffers();
    syncHomepagePromoSection();
    renderCartDrawer();
    updateCheckoutPreview();
    renderPageCheckout();
    return liveOffersMap;
  })();

  return offersFetchPromise;
}

function saveCart() {
  localStorage.setItem('panooja_cart', JSON.stringify(cart));
  if (appliedCoupon) {
    localStorage.setItem('panooja_coupon', appliedCoupon);
  } else {
    localStorage.removeItem('panooja_coupon');
  }
  updateCartBadge();
  renderCartDrawer();
  updateCheckoutPreview();
  renderPageCheckout();
}

function updateCartBadge() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badges = document.querySelectorAll('#cartCount, #drawerCartCount');
  badges.forEach(b => {
    b.textContent = count;
  });
}

// Calculate discounts based on subtotal, cart items, and live Google Sheet offers
function calculateDiscount(subtotal, cartItems = cart) {
  if (!appliedCoupon) {
    return { code: null, amount: 0, isFreeShip: false, valid: false, pending: false, error: null, savingsText: '' };
  }
  const code = appliedCoupon.toUpperCase().trim();

  if (!liveOffersLoaded) {
    return { code, amount: 0, isFreeShip: false, valid: false, pending: true, error: null, savingsText: '' };
  }

  const offer = liveOffersMap.get(code);
  if (!offer) {
    return {
      code,
      amount: 0,
      isFreeShip: false,
      valid: false,
      pending: false,
      error: 'This coupon code is invalid or expired.',
      savingsText: ''
    };
  }

  if (subtotal > 0 && offer.minOrderValue > 0 && subtotal < offer.minOrderValue) {
    const shortfall = offer.minOrderValue - subtotal;
    return {
      code: offer.code,
      offer,
      amount: 0,
      isFreeShip: false,
      valid: false,
      pending: false,
      error: `Add ₹${shortfall.toLocaleString('en-IN')} more to use ${offer.code}`,
      savingsText: ''
    };
  }

  const appliesToAll = normalizeOfferCategoryGroup(offer.appliesTo) === 'all';
  let eligibleSubtotal = subtotal;

  if (!appliesToAll && subtotal > 0) {
    eligibleSubtotal = (cartItems || []).reduce((sum, item) => {
      if (doesCartItemMatchOfferCategory(item.category, offer.appliesTo)) {
        return sum + ((Number(item.price) || 0) * (Number(item.quantity) || 1));
      }
      return sum;
    }, 0);

    if (eligibleSubtotal <= 0) {
      return {
        code: offer.code,
        offer,
        amount: 0,
        isFreeShip: false,
        valid: false,
        pending: false,
        error: `${offer.code} applies only to ${offer.appliesTo}. Add a matching item to use it.`,
        savingsText: ''
      };
    }
  }

  let amount = 0;
  let isFreeShip = false;

  if (offer.discountType === 'percentage') {
    amount = Math.min(eligibleSubtotal, Math.round(eligibleSubtotal * (offer.discountValue / 100)));
  } else if (offer.discountType === 'free_shipping') {
    isFreeShip = true;
  } else {
    amount = Math.min(eligibleSubtotal, Math.round(offer.discountValue));
  }

  let savingsText = '';
  if (subtotal > 0) {
    if (isFreeShip) {
      const shippingSaved = subtotal < FREE_SHIPPING_THRESHOLD ? STANDARD_SHIPPING_FEE : 0;
      savingsText = shippingSaved > 0
        ? `Coupon ${offer.code} applied — You save ₹${shippingSaved} on shipping!`
        : `Coupon ${offer.code} applied — Free Express Shipping unlocked!`;
    } else {
      savingsText = `Coupon ${offer.code} applied — You save ₹${amount.toLocaleString('en-IN')}`;
    }
  } else if (offer.bannerTitle) {
    savingsText = `Coupon ${offer.code} saved (${offer.bannerTitle})`;
  }

  return {
    code: offer.code,
    offer,
    amount,
    isFreeShip,
    valid: true,
    pending: false,
    error: null,
    savingsText
  };
}

// Open and Close Cart Drawer
function openCartDrawer() {
  document.body.classList.add('cart-open');
  renderCartDrawer();
}

function closeCartDrawer() {
  document.body.classList.remove('cart-open');
}

// Open and Close Checkout Modal
function openCheckoutModal() {
  if (cart.length === 0) {
    alert('Your shopping bag is empty. Please add items before checking out.');
    return;
  }
  closeCartDrawer();
  document.body.classList.add('checkout-modal-open');
  updateCheckoutPreview();

  // Auto-fill client details if signed in via Gmail
  try {
    const user = (window.panoojaAuth && typeof window.panoojaAuth.getUser === 'function') ? window.panoojaAuth.getUser() : null;
    if (user) {
      const drawerName = document.getElementById('checkoutName');
      const drawerPhone = document.getElementById('checkoutPhone');
      const drawerEmail = document.getElementById('checkoutEmail');
      const drawerStreet = document.getElementById('checkoutStreet') || document.getElementById('checkoutAddress');
      const drawerPincode = document.getElementById('checkoutPincode');
      if (drawerName && !drawerName.value) drawerName.value = user.name || '';
      if (drawerPhone && !drawerPhone.value && user.phone) drawerPhone.value = user.phone;
      if (drawerEmail && !drawerEmail.value && user.email) drawerEmail.value = user.email;
      if (drawerStreet && !drawerStreet.value && user.address) drawerStreet.value = user.address;
      if (drawerPincode && !drawerPincode.value && user.pincode) drawerPincode.value = user.pincode;
    }
  } catch (e) {}
}

function closeCheckoutModal() {
  document.body.classList.remove('checkout-modal-open');
}

// Add Item to Cart
function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  const qtyToAdd = product.quantity || 1;

  if (existing) {
    existing.quantity += qtyToAdd;
  } else {
    cart.push({
      id: product.id,
      title: product.title,
      price: product.price,
      img: product.img,
      category: product.category || 'Jewellery',
      quantity: qtyToAdd
    });
  }
  saveCart();
  openCartDrawer();
}

// Render Cart Drawer Contents
function renderCartDrawer() {
  const itemsContainer = document.getElementById('drawerCartItems');
  const emptyState = document.getElementById('drawerCartEmpty');
  const footer = document.getElementById('drawerCartFooter');
  const shippingContainer = document.getElementById('shippingProgressContainer');
  const shippingText = document.getElementById('shippingProgressText');
  const shippingFill = document.getElementById('shippingProgressFill');

  if (!itemsContainer) return;

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountInfo = calculateDiscount(subtotal);

  // Determine Shipping Fee
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || discountInfo.isFreeShip;
  const shippingFee = (subtotal === 0 || isFreeShipping) ? 0 : STANDARD_SHIPPING_FEE;
  const grandTotal = Math.max(0, subtotal - discountInfo.amount + shippingFee);

  // Update Free Shipping Progress Bar
  if (shippingContainer && shippingText && shippingFill) {
    if (subtotal === 0) {
      shippingText.innerHTML = `Add <strong>₹${FREE_SHIPPING_THRESHOLD}</strong> more for FREE Express Shipping! 🚚`;
      shippingFill.style.width = '0%';
      shippingFill.classList.remove('unlocked');
    } else if (subtotal >= FREE_SHIPPING_THRESHOLD || discountInfo.isFreeShip) {
      shippingText.innerHTML = `🎉 <strong>Congratulations!</strong> You've unlocked FREE Express Shipping!`;
      shippingFill.style.width = '100%';
      shippingFill.classList.add('unlocked');
    } else {
      const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
      const percent = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));
      shippingText.innerHTML = `Add <strong>₹${remaining.toLocaleString('en-IN')}</strong> more for FREE Express Shipping! 🚚`;
      shippingFill.style.width = `${percent}%`;
      shippingFill.classList.remove('unlocked');
    }
  }

  // Handle Empty State vs Filled
  if (cart.length === 0) {
    itemsContainer.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    if (footer) footer.style.display = 'none';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (footer) footer.style.display = 'block';

  // Render Items
  itemsContainer.innerHTML = '';
  cart.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = 'drawer-item';
    itemEl.innerHTML = `
      <img src="${item.img}" alt="${item.title}" class="drawer-item-img" referrerPolicy="no-referrer" />
      <div class="drawer-item-info">
        <h4 class="drawer-item-title">${item.title}</h4>
        <div class="drawer-item-price">₹${item.price.toLocaleString('en-IN')}</div>
        <div class="drawer-item-controls">
          <div class="drawer-qty-group">
            <button type="button" class="drawer-qty-btn" data-action="minus" data-id="${item.id}" aria-label="Decrease quantity">−</button>
            <span class="drawer-qty-val">${item.quantity}</span>
            <button type="button" class="drawer-qty-btn" data-action="plus" data-id="${item.id}" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="drawer-remove-btn" data-id="${item.id}">Remove</button>
        </div>
      </div>
    `;
    itemsContainer.appendChild(itemEl);
  });

  // Update Summary Rows
  const subtotalEl = document.getElementById('drawerSubtotal');
  const discountRow = document.getElementById('drawerDiscountRow');
  const discountNameEl = document.getElementById('discountName');
  const discountValEl = document.getElementById('drawerDiscount');
  const shippingEl = document.getElementById('drawerShipping');
  const totalEl = document.getElementById('drawerTotal');

  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;

  if (discountRow) {
    if (discountInfo.valid && discountInfo.amount > 0) {
      discountRow.style.display = 'flex';
      if (discountNameEl) discountNameEl.textContent = discountInfo.code;
      if (discountValEl) discountValEl.textContent = `-₹${discountInfo.amount.toLocaleString('en-IN')}`;
    } else if (discountInfo.valid && discountInfo.isFreeShip) {
      discountRow.style.display = 'flex';
      if (discountNameEl) discountNameEl.textContent = discountInfo.code;
      if (discountValEl) discountValEl.textContent = 'FREE SHIPPING';
    } else {
      discountRow.style.display = 'none';
    }
  }

  if (shippingEl) {
    shippingEl.textContent = shippingFee === 0 ? 'FREE' : `₹${shippingFee}`;
  }

  if (totalEl) totalEl.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;

  syncAllPromoUIs(discountInfo, subtotal);
}

// Synchronize Coupon Input, Applied Tag, Remove Button, Savings Feedback & Public Available Coupons across Drawer & Checkout
function syncAllPromoUIs(discountInfo, subtotal) {
  const promoContainers = [
    {
      tag: document.getElementById('promoAppliedTag'),
      label: document.getElementById('promoCodeLabel'),
      feedback: document.getElementById('promoFeedback'),
      availableWrap: document.getElementById('promoAvailableWrap'),
      availableList: document.getElementById('promoAvailableList'),
      hint: document.getElementById('promoHint')
    },
    {
      tag: document.getElementById('checkoutPromoAppliedTag'),
      label: document.getElementById('checkoutPromoCodeLabel'),
      feedback: document.getElementById('checkoutPromoFeedback'),
      availableWrap: document.getElementById('checkoutPromoAvailableWrap'),
      availableList: document.getElementById('checkoutPromoAvailableList'),
      hint: document.getElementById('checkoutPromoHint')
    },
    {
      tag: document.getElementById('pagePromoAppliedTag'),
      label: document.getElementById('pagePromoCodeLabel'),
      feedback: document.getElementById('pagePromoFeedback'),
      availableWrap: document.getElementById('pagePromoAvailableWrap'),
      availableList: document.getElementById('pagePromoAvailableList'),
      hint: document.getElementById('pagePromoHint')
    }
  ];

  // Public display: ONLY include offers where Live Status is Live AND Show on Website (Yes/No) is Yes
  const publicList = getPublicLiveOffers();
  let hintText = 'Have a private coupon code? Enter it above.';
  if (!liveOffersLoaded) {
    hintText = 'Loading live offers...';
  } else if (publicList.length > 0) {
    hintText = 'Tap an available coupon above or enter a private code.';
  }

  const availableChipsHtml = publicList.map(o => {
    const desc = o.bannerTitle || (o.discountType === 'percentage' ? `${o.discountValue}% off` : o.discountType === 'free_shipping' ? 'Free shipping' : `₹${o.discountValue} off`);
    const isApplied = appliedCoupon && appliedCoupon.toUpperCase().trim() === o.code && discountInfo.valid;
    return `<button type="button" class="available-coupon-chip ${isApplied ? 'is-applied' : ''}" data-coupon-code="${escapeCartHtml(o.code)}">
      <span class="chip-code">${escapeCartHtml(o.code)}</span>
      <span class="chip-desc">${escapeCartHtml(desc)}</span>
      <span class="chip-cta">${isApplied ? 'Applied' : 'Apply'}</span>
    </button>`;
  }).join('');

  // Decide inline feedback message & style
  let feedbackType = '';
  let feedbackMsg = '';

  if (discountInfo.error) {
    feedbackType = 'error';
    feedbackMsg = discountInfo.error;
  } else if (discountInfo.valid && discountInfo.savingsText) {
    feedbackType = 'success';
    feedbackMsg = discountInfo.savingsText;
  } else if (lastPromoFeedback && lastPromoFeedback.message) {
    feedbackType = lastPromoFeedback.type;
    feedbackMsg = lastPromoFeedback.message;
  }

  promoContainers.forEach(ui => {
    if (ui.tag && ui.label) {
      if (appliedCoupon && (discountInfo.valid || discountInfo.pending)) {
        ui.tag.style.display = 'inline-flex';
        ui.label.textContent = discountInfo.code || appliedCoupon;
      } else if (appliedCoupon && discountInfo.error && subtotal > 0) {
        // Show tag with Remove option so user can clear or keep adding items
        ui.tag.style.display = 'inline-flex';
        ui.label.textContent = discountInfo.code || appliedCoupon;
      } else {
        ui.tag.style.display = 'none';
      }
    }

    if (ui.feedback) {
      if (feedbackMsg) {
        ui.feedback.textContent = feedbackMsg;
        ui.feedback.className = `promo-feedback ${feedbackType === 'error' ? 'is-error' : 'is-success'}`;
      } else {
        ui.feedback.textContent = '';
        ui.feedback.className = 'promo-feedback';
      }
    }

    if (ui.availableWrap && ui.availableList) {
      if (liveOffersLoaded && publicList.length > 0) {
        ui.availableWrap.style.display = 'block';
        ui.availableList.innerHTML = availableChipsHtml;
      } else {
        ui.availableWrap.style.display = 'none';
        ui.availableList.innerHTML = '';
      }
    }

    if (ui.hint) {
      ui.hint.textContent = hintText;
    }
  });
}

// Update Checkout Modal Price Preview
function updateCheckoutPreview() {
  const countEl = document.getElementById('checkoutItemCount');
  const subtotalEl = document.getElementById('checkoutSubtotal');
  const discountRow = document.getElementById('checkoutDiscountRow');
  const discountEl = document.getElementById('checkoutDiscount');
  const shippingEl = document.getElementById('checkoutShipping');
  const grandTotalEl = document.getElementById('checkoutGrandTotal');

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountInfo = calculateDiscount(subtotal);
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || discountInfo.isFreeShip;
  const shippingFee = (subtotal === 0 || isFreeShipping) ? 0 : STANDARD_SHIPPING_FEE;
  const grandTotal = Math.max(0, subtotal - discountInfo.amount + shippingFee);

  if (countEl) countEl.textContent = count;
  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;

  if (discountRow && discountEl) {
    if (discountInfo.valid && discountInfo.amount > 0) {
      discountRow.style.display = 'flex';
      discountEl.textContent = `-₹${discountInfo.amount.toLocaleString('en-IN')} (${discountInfo.code})`;
    } else if (discountInfo.valid && discountInfo.isFreeShip) {
      discountRow.style.display = 'flex';
      discountEl.textContent = `FREE SHIPPING (${discountInfo.code})`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  if (shippingEl) shippingEl.textContent = shippingFee === 0 ? 'FREE' : `₹${shippingFee}`;
  if (grandTotalEl) grandTotalEl.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;

  syncAllPromoUIs(discountInfo, subtotal);
}

// Update Standalone checkout.html Summary
function renderPageCheckout() {
  const pageTotalEl = document.getElementById('pageCheckoutTotal');
  const pageSubtotalEl = document.getElementById('pageCheckoutSubtotal');
  const pageDiscountRow = document.getElementById('pageCheckoutDiscountRow');
  const pageDiscountEl = document.getElementById('pageCheckoutDiscount');
  const pageShippingEl = document.getElementById('pageCheckoutShipping');

  if (!pageTotalEl && !pageSubtotalEl) return;

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountInfo = calculateDiscount(subtotal);
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || discountInfo.isFreeShip;
  const shippingFee = (subtotal === 0 || isFreeShipping) ? 0 : STANDARD_SHIPPING_FEE;
  const grandTotal = Math.max(0, subtotal - discountInfo.amount + shippingFee);

  if (pageSubtotalEl) pageSubtotalEl.textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  if (pageDiscountRow && pageDiscountEl) {
    if (discountInfo.valid && discountInfo.amount > 0) {
      pageDiscountRow.style.display = 'flex';
      pageDiscountEl.textContent = `-₹${discountInfo.amount.toLocaleString('en-IN')} (${discountInfo.code})`;
    } else if (discountInfo.valid && discountInfo.isFreeShip) {
      pageDiscountRow.style.display = 'flex';
      pageDiscountEl.textContent = `FREE SHIPPING (${discountInfo.code})`;
    } else {
      pageDiscountRow.style.display = 'none';
    }
  }
  if (pageShippingEl) pageShippingEl.textContent = shippingFee === 0 ? 'FREE' : `₹${shippingFee}`;
  if (pageTotalEl) pageTotalEl.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;

  syncAllPromoUIs(discountInfo, subtotal);
}

// Apply Promo Code against Live Google Sheet Offers
async function applyPromoCode(code, fromUserInput = false) {
  const cleanCode = (code || '').toUpperCase().trim();
  if (!cleanCode) {
    if (fromUserInput) {
      lastPromoFeedback = { type: 'error', message: 'Please enter a coupon code.' };
      syncAllPromoUIs(calculateDiscount(cart.reduce((s, i) => s + i.price * i.quantity, 0)), cart.reduce((s, i) => s + i.price * i.quantity, 0));
    }
    return { ok: false };
  }

  if (!liveOffersLoaded) {
    await fetchLiveOffers();
  }

  const offer = liveOffersMap.get(cleanCode);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (!offer) {
    lastPromoFeedback = { type: 'error', message: 'This coupon code is invalid or expired.' };
    if (fromUserInput && appliedCoupon === cleanCode) {
      appliedCoupon = null;
    }
    saveCart();
    return { ok: false, error: lastPromoFeedback.message };
  }

  if (subtotal > 0 && offer.minOrderValue > 0 && subtotal < offer.minOrderValue) {
    const shortfall = offer.minOrderValue - subtotal;
    const msg = `Add ₹${shortfall.toLocaleString('en-IN')} more to use ${offer.code}`;
    lastPromoFeedback = { type: 'error', message: msg };
    // Save code if triggered programmatically (e.g. newsletter), or reject cleanly if entered manually
    if (!fromUserInput) {
      appliedCoupon = offer.code;
    } else {
      appliedCoupon = null;
    }
    saveCart();
    return { ok: false, error: msg };
  }

  // Check category eligibility if cart has items
  if (subtotal > 0 && normalizeOfferCategoryGroup(offer.appliesTo) !== 'all') {
    const matchingTotal = cart.reduce((sum, item) => {
      return doesCartItemMatchOfferCategory(item.category, offer.appliesTo)
        ? sum + ((Number(item.price) || 0) * (Number(item.quantity) || 1))
        : sum;
    }, 0);

    if (matchingTotal <= 0) {
      const msg = `${offer.code} applies only to ${offer.appliesTo}. Add a matching item to use it.`;
      lastPromoFeedback = { type: 'error', message: msg };
      if (fromUserInput) appliedCoupon = null;
      saveCart();
      return { ok: false, error: msg };
    }
  }

  appliedCoupon = offer.code;
  const info = calculateDiscount(subtotal);
  lastPromoFeedback = {
    type: 'success',
    message: info.savingsText || `Coupon ${offer.code} applied!`
  };

  saveCart();
  ['promoInput', 'checkoutPromoInput', 'pagePromoInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  return { ok: true, offer };
}

function removePromoCode() {
  appliedCoupon = null;
  lastPromoFeedback = { type: '', message: '' };
  saveCart();
}

// Shared Checkout Form Reader & Validator (drawer modal + standalone checkout.html)
function readAndValidateCheckoutFields(isPageCheckout = false) {
  const prefix = isPageCheckout ? 'pageCheckout' : 'checkout';
  const nameInput = document.getElementById(`${prefix}Name`);
  const phoneInput = document.getElementById(`${prefix}Phone`);
  const emailInput = document.getElementById(`${prefix}Email`);
  const streetInput = document.getElementById(`${prefix}Street`) || document.getElementById(`${prefix}Address`);
  const landmarkInput = document.getElementById(`${prefix}Landmark`);
  const cityInput = document.getElementById(`${prefix}City`);
  const stateInput = document.getElementById(`${prefix}State`);
  const pincodeInput = document.getElementById(`${prefix}Pincode`);

  const name = nameInput ? nameInput.value.trim() : '';
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const rawEmail = emailInput ? emailInput.value.trim() : '';
  const street = streetInput ? streetInput.value.trim() : '';
  const landmark = landmarkInput ? landmarkInput.value.trim() : '';
  const city = cityInput ? cityInput.value.trim() : '';
  const state = stateInput ? stateInput.value.trim() : '';
  const pincode = pincodeInput ? pincodeInput.value.trim() : '';

  if (!name) {
    alert('Please enter your full name.');
    if (nameInput) nameInput.focus();
    return null;
  }

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
    alert('Please enter a valid 10-digit Indian mobile / WhatsApp number (starting with 6, 7, 8, or 9).');
    if (phoneInput) phoneInput.focus();
    return null;
  }

  if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    alert('Please enter a valid email address or leave it blank.');
    if (emailInput) emailInput.focus();
    return null;
  }

  if (!street) {
    alert('Please enter your House/Flat & Street.');
    if (streetInput) streetInput.focus();
    return null;
  }

  if (cityInput && !city) {
    alert('Please enter your City.');
    cityInput.focus();
    return null;
  }

  if (stateInput && !state) {
    alert('Please select your State.');
    stateInput.focus();
    return null;
  }

  const cleanPincode = pincode.replace(/[^0-9]/g, '');
  if (!cleanPincode || !/^[1-9]\d{5}$/.test(cleanPincode)) {
    alert('Please enter a valid 6-digit Indian delivery PIN code.');
    if (pincodeInput) pincodeInput.focus();
    return null;
  }

  if (cart.length === 0) {
    alert('Your shopping bag is empty.');
    return null;
  }

  const panoojaUser = (typeof window.panoojaAuth !== 'undefined') ? window.panoojaAuth.getUser() : null;
  const email = rawEmail || (panoojaUser && panoojaUser.email) || '';
  const fullAddress = [street, landmark ? `Near ${landmark}` : '', city, state].filter(Boolean).join(', ') + ` - ${cleanPincode}`;

  return {
    name,
    cleanPhone,
    email,
    street,
    landmark,
    city,
    state,
    cleanPincode,
    fullAddress
  };
}

// Confirmation screen shown after tapping Order via WhatsApp
function showWhatsappConfirmationScreen({ inquiryRef, total, waUrl }) {
  const existing = document.getElementById('whatsappOrderConfirmModal');
  if (existing) existing.remove();

  const businessHours = getPanoojaBusinessHours();
  const modal = document.createElement('div');
  modal.id = 'whatsappOrderConfirmModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'waConfirmTitle');
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(5,5,5,0.82); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
  `;

  modal.innerHTML = `
    <div style="background: #FFFFFF; max-width: 480px; width: 100%; border-radius: 8px; padding: 34px 26px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); border: 1px solid #D9DEE7;">
      <div style="width: 56px; height: 56px; background: rgba(37, 211, 102, 0.12); border: 2px solid #25D366; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: #1EBE5D; font-size: 1.6rem;">
        ✓
      </div>
      <h3 id="waConfirmTitle" style="font-family: var(--font-serif); font-size: 1.85rem; color: #050505; margin: 0 0 10px;">Order Request Ready on WhatsApp</h3>
      <p style="font-size: 0.94rem; color: #242424; margin: 0 0 18px; line-height: 1.55;">
        Your order request has been sent on WhatsApp. We&rsquo;ll confirm stock and share payment details within <strong>${escapeCartHtml(businessHours)}</strong>.
      </p>
      <div style="background: #F5F6F8; border: 1px solid #D9DEE7; border-radius: 6px; padding: 12px 14px; text-align: left; font-size: 0.84rem; margin-bottom: 20px; line-height: 1.7; color: #242424;">
        <div><strong>Reference:</strong> #${escapeCartHtml(inquiryRef)}</div>
        <div><strong>Estimated Total:</strong> ₹${Number(total || 0).toLocaleString('en-IN')} <span style="color:#6B7280;">(Inclusive of all taxes)</span></div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <a href="${escapeCartHtml(waUrl)}" target="_blank" rel="noopener noreferrer" class="button button-whatsapp" style="width: 100%; text-decoration: none;">
          Open WhatsApp Chat
        </a>
        <button type="button" class="button button-secondary" id="waConfirmCloseBtn" style="width: 100%;">
          Continue Shopping
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = document.getElementById('waConfirmCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.remove());
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Generate formatted WhatsApp Order Text and Redirect
function orderViaWhatsApp(isPageCheckout = false) {
  const details = readAndValidateCheckoutFields(isPageCheckout);
  if (!details) return;

  const { name, cleanPhone, email, street, landmark, city, state, cleanPincode, fullAddress } = details;

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountInfo = calculateDiscount(subtotal);
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || discountInfo.isFreeShip;
  const shippingFee = (subtotal === 0 || isFreeShipping) ? 0 : STANDARD_SHIPPING_FEE;
  const grandTotal = Math.max(0, subtotal - discountInfo.amount + shippingFee);
  const inquiryRef = 'INQ-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);

  let itemsListText = '';
  cart.forEach((item, index) => {
    itemsListText += `${index + 1}. *${item.title}* (SKU: ${item.sku || item.id || 'N/A'}) x ${item.quantity} - ₹${(item.price * item.quantity).toLocaleString('en-IN')}\n`;
  });

  const emailLine = email ? `• Email: ${email}\n` : '';
  const landmarkLine = landmark ? `• Landmark: ${landmark}\n` : '';
  let discountLine = '';
  if (discountInfo.valid && discountInfo.amount > 0) {
    discountLine = `• Discount (${discountInfo.code}): -₹${discountInfo.amount.toLocaleString('en-IN')}\n`;
  } else if (discountInfo.valid && discountInfo.isFreeShip) {
    discountLine = `• Coupon Applied (${discountInfo.code}): Free Express Shipping\n`;
  }

  const message = `✨ *PANOOJA ORDER INQUIRY* ✨
Reference: #${inquiryRef}

👤 *Customer Details:*
• Name: ${name}
• WhatsApp Phone: +91 ${cleanPhone}
${emailLine}• House/Flat & Street: ${street}
${landmarkLine}• City: ${city}
• State: ${state}
• PIN Code: ${cleanPincode}

🛍️ *Items in Bag:*
${itemsListText}
💰 *Estimated Payable (Inclusive of all taxes):*
• Subtotal: ₹${subtotal.toLocaleString('en-IN')}
${discountLine}• Pan-India Express Delivery: ${shippingFee === 0 ? 'FREE' : '₹' + shippingFee}
• *Total Amount: ₹${grandTotal.toLocaleString('en-IN')}*

Please confirm stock and share UPI payment details!`;

  const waUrl = `https://wa.me/${PANOOJA_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  // Record inquiry on server (non-blocking, works without Razorpay keys)
  try {
    fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_channel: 'whatsapp',
        receipt: inquiryRef,
        items: cart.map(item => ({ sku: item.sku || item.id, quantity: item.quantity })),
        promo_code: discountInfo.valid ? discountInfo.code : '',
        customer_name: name,
        customer_phone: cleanPhone,
        customer_email: email,
        delivery_address: fullAddress
      })
    }).catch(e => console.debug('Inquiry record note:', e));
  } catch (e) {}

  // Open WhatsApp in new tab safely and show confirmation screen
  try {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  } catch (e) {}

  if (!isPageCheckout) closeCheckoutModal();
  showWhatsappConfirmationScreen({ inquiryRef, total: grandTotal, waUrl });
}

// =============================================================
// RAZORPAY STANDARD WEB CHECKOUT INTEGRATION
// =============================================================
async function payWithRazorpay(isPageCheckout = false) {
  if (!isOnlinePaymentsEnabled()) {
    alert('Online card/UPI checkout is currently unavailable. Please complete your order via WhatsApp.');
    return;
  }

  const btnEl = isPageCheckout ? document.getElementById('pageCheckoutOnlineBtn') : document.getElementById('checkoutOnlineBtn');
  const details = readAndValidateCheckoutFields(isPageCheckout);
  if (!details) return;

  const { name, cleanPhone, email, fullAddress } = details;

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountInfo = calculateDiscount(subtotal);
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || discountInfo.isFreeShip;
  const shippingFee = (subtotal === 0 || isFreeShipping) ? 0 : STANDARD_SHIPPING_FEE;
  const grandTotal = Math.max(0, subtotal - discountInfo.amount + shippingFee);

  // Minimum amount validation: 100 paise (₹1)
  if (grandTotal < 1) {
    alert('Invalid order amount. Minimum checkout amount is ₹1.');
    return;
  }

  const originalBtnText = btnEl ? btnEl.innerHTML : 'Pay Online';
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = 'Initiating Secure Checkout...';
  }

  // Ensure Razorpay SDK is loaded
  if (typeof window.Razorpay === 'undefined') {
    try {
      await loadRazorpayScript();
    } catch (err) {
      alert('Unable to load Razorpay checkout SDK. Please check your internet connection.');
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = originalBtnText;
      }
      return;
    }
  }

  const clientEmail = email;

  try {
    // Step 1: Call Backend to Create Order (Server-Side Price Calculation)
    const orderRes = await fetch('/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: cart.map(item => ({
          sku: item.sku || item.id,
          quantity: item.quantity
        })),
        promo_code: discountInfo.valid ? discountInfo.code : '',
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`,
        customer_name: name,
        customer_phone: cleanPhone,
        customer_email: clientEmail,
        delivery_address: fullAddress
      })
    });

    const orderData = await orderRes.json();

    if (!orderRes.ok || !orderData.ok) {
      throw new Error(orderData.error || 'Failed to initialize payment order on server.');
    }

    // Step 2: Open Razorpay Standard Checkout Modal
    const options = {
      key: orderData.key_id,
      amount: orderData.amount,
      currency: orderData.currency || 'INR',
      name: 'PANOOJA',
      description: 'Waterproof & Anti-Tarnish Jewellery',
      image: 'https://www.panooja.com/logo.png',
      order_id: orderData.order_id,
      prefill: {
        name: name,
        contact: cleanPhone,
        email: clientEmail || ''
      },
      notes: {
        address: fullAddress
      },
      theme: {
        color: '#1B69E8'
      },
      modal: {
        ondismiss: function() {
          if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = originalBtnText;
          }
          console.log('Razorpay payment modal closed by customer.');
        }
      },
      handler: async function(paymentResponse) {
        // Step 3: Verify Payment Signature via Backend
        if (btnEl) {
          btnEl.disabled = true;
          btnEl.textContent = 'Verifying Payment Signature...';
        }

        try {
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature
            })
          });

          const verifyData = await verifyRes.json();

          if (verifyRes.ok && verifyData.ok) {
            // Payment verified successfully!
            cart = [];
            appliedCoupon = null;
            saveCart();
            closeCheckoutModal();

            showPaymentSuccessDialog({
              orderId: paymentResponse.razorpay_order_id,
              paymentId: paymentResponse.razorpay_payment_id,
              amount: grandTotal,
              name: name,
              phone: phone,
              address: address,
              pincode: pincode
            });

            if (isPageCheckout) {
              const msgEl = document.getElementById('pageCheckoutMessage');
              if (msgEl) {
                msgEl.textContent = `✓ Payment Verified! Order ID: ${paymentResponse.razorpay_order_id}`;
                msgEl.style.color = '#10B981';
              }
            }

          } else {
            alert('Payment Signature Verification Failed: ' + (verifyData.error || 'Please contact PANOOJA support.'));
            if (btnEl) {
              btnEl.disabled = false;
              btnEl.innerHTML = originalBtnText;
            }
          }

        } catch (verifyErr) {
          console.error('Payment verification error:', verifyErr);
          alert('Network error while verifying payment: ' + verifyErr.message);
          if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = originalBtnText;
          }
        }
      }
    };

    const rzp = new window.Razorpay(options);

    // Handle Payment Failed Event
    rzp.on('payment.failed', function(failureResponse) {
      console.error('Razorpay Payment Failed:', failureResponse.error);
      const errDesc = failureResponse.error ? failureResponse.error.description : 'Transaction cancelled or declined.';
      alert(`Payment Incomplete: ${errDesc}`);
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = originalBtnText;
      }
    });

    rzp.open();

  } catch (err) {
    console.error('Razorpay Checkout Init Error:', err);
    alert('Unable to start payment checkout: ' + err.message);
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = originalBtnText;
    }
  }
}

// Helper to dynamically load checkout.js if not already present
function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window.Razorpay !== 'undefined') {
      return resolve();
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.head.appendChild(script);
  });
}

// Payment Success Confirmation Modal
function showPaymentSuccessDialog(details) {
  const existing = document.getElementById('paymentSuccessModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'paymentSuccessModal';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(5,5,5,0.85); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;
    animation: fadeIn 0.3s ease;
  `;

  modal.innerHTML = `
    <div style="background: #FFFFFF; max-width: 500px; width: 100%; border-radius: 8px; padding: 36px 28px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); border: 1px solid #D9DEE7;">
      <div style="width: 60px; height: 60px; background: rgba(16, 185, 129, 0.1); border: 2px solid #10B981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 18px; color: #10B981; font-size: 1.8rem;">
        ✓
      </div>
      <h3 style="font-family: var(--font-serif); font-size: 2rem; color: #050505; margin: 0 0 8px;">Payment Successful!</h3>
      <p style="font-size: 0.95rem; color: #242424; margin: 0 0 20px; line-height: 1.5;">Thank you for shopping with PANOOJA. Your order has been placed and is scheduled for express dispatch.</p>
      
      <div style="background: #F5F6F8; border: 1px solid #D9DEE7; border-radius: 6px; padding: 16px; text-align: left; font-size: 0.85rem; margin-bottom: 24px; line-height: 1.8; color: #242424;">
        <div><strong>Order ID:</strong> ${details.orderId}</div>
        <div><strong>Payment ID:</strong> ${details.paymentId}</div>
        <div><strong>Amount Paid:</strong> ₹${details.amount.toLocaleString('en-IN')}</div>
        <div><strong>Customer:</strong> ${details.name} (${details.phone})</div>
      </div>

      <button type="button" class="button button-primary" id="successModalCloseBtn" style="width: 100%;">
        Continue Exploring
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = document.getElementById('successModalCloseBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.remove();
      window.location.href = '/#shop';
    });
  }
}

// DOM Setup
document.addEventListener('DOMContentLoaded', () => {
  syncPaymentModeUI();
  updateCartBadge();
  renderCartDrawer();
  fetchLiveOffers();

  // Header Nav Cart Click -> Open Slide-out Drawer
  const navCartBtn = document.getElementById('navCart');
  if (navCartBtn) {
    navCartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openCartDrawer();
    });
  }

  // Drawer Close Button & Backdrop
  const closeCartBtn = document.getElementById('closeCartDrawer');
  if (closeCartBtn) {
    closeCartBtn.addEventListener('click', closeCartDrawer);
  }
  const cartBackdrop = document.getElementById('cartDrawerBackdrop');
  if (cartBackdrop) {
    cartBackdrop.addEventListener('click', closeCartDrawer);
  }

  // Continue shopping button inside empty drawer
  const continueShoppingBtn = document.getElementById('continueShoppingBtn');
  if (continueShoppingBtn) {
    continueShoppingBtn.addEventListener('click', () => {
      closeCartDrawer();
    });
  }

  // Drawer Quantity Changes and Remove Listeners (delegated)
  const drawerItems = document.getElementById('drawerCartItems');
  if (drawerItems) {
    drawerItems.addEventListener('click', (e) => {
      const qtyBtn = e.target.closest('.drawer-qty-btn');
      if (qtyBtn) {
        const id = qtyBtn.getAttribute('data-id');
        const action = qtyBtn.getAttribute('data-action');
        const item = cart.find(i => i.id === id);
        if (item) {
          if (action === 'plus') {
            item.quantity++;
          } else if (action === 'minus') {
            item.quantity--;
            if (item.quantity <= 0) {
              cart = cart.filter(i => i.id !== id);
            }
          }
          saveCart();
        }
        return;
      }

      const removeBtn = e.target.closest('.drawer-remove-btn');
      if (removeBtn) {
        const id = removeBtn.getAttribute('data-id');
        cart = cart.filter(i => i.id !== id);
        saveCart();
      }
    });
  }

  // Promo Code Box Listeners (Cart Drawer, Checkout Modal, and checkout.html)
  const bindPromoControl = (inputId, applyId, removeId) => {
    const input = document.getElementById(inputId);
    const applyBtn = document.getElementById(applyId);
    const removeBtn = document.getElementById(removeId);

    if (applyBtn && input) {
      applyBtn.addEventListener('click', () => applyPromoCode(input.value, true));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyPromoCode(input.value, true);
        }
      });
    }
    if (removeBtn) {
      removeBtn.addEventListener('click', removePromoCode);
    }
  };

  bindPromoControl('promoInput', 'applyPromoBtn', 'removePromoBtn');
  bindPromoControl('checkoutPromoInput', 'checkoutApplyPromoBtn', 'checkoutRemovePromoBtn');
  bindPromoControl('pagePromoInput', 'pageApplyPromoBtn', 'pageRemovePromoBtn');

  // Delegated click handler for clickable "Available Coupons" chips
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.available-coupon-chip');
    if (chip) {
      const code = chip.getAttribute('data-coupon-code');
      if (code) {
        applyPromoCode(code, true);
      }
    }
  });

  // Open Checkout Modal from Drawer
  const openCheckoutBtn = document.getElementById('openCheckoutModalBtn');
  if (openCheckoutBtn) {
    openCheckoutBtn.addEventListener('click', openCheckoutModal);
  }

  // Checkout Modal Close & Backdrop
  const closeCheckoutBtn = document.getElementById('closeCheckoutModal');
  if (closeCheckoutBtn) {
    closeCheckoutBtn.addEventListener('click', closeCheckoutModal);
  }
  const checkoutBackdrop = document.getElementById('checkoutModalBackdrop');
  if (checkoutBackdrop) {
    checkoutBackdrop.addEventListener('click', closeCheckoutModal);
  }

  // Checkout Actions: WhatsApp & Online
  const checkoutWhatsappBtn = document.getElementById('checkoutWhatsappBtn');
  if (checkoutWhatsappBtn) {
    checkoutWhatsappBtn.addEventListener('click', () => orderViaWhatsApp(false));
  }
  const checkoutOnlineBtn = document.getElementById('checkoutOnlineBtn');
  if (checkoutOnlineBtn) {
    checkoutOnlineBtn.addEventListener('click', () => payWithRazorpay(false));
  }

  // Global Add to Cart Click Handler (Catches all .add-to-cart-btn clicks across the page)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.add-to-cart-btn');
    if (btn && !btn.disabled) {
      e.preventDefault();
      const rawPrice = btn.getAttribute('data-price') || '0';
      const cleanPrice = parseInt(String(rawPrice).replace(/[^0-9]/g, ''), 10) || 0;
      const product = {
        id: btn.getAttribute('data-id') || ('p_' + Date.now()),
        title: btn.getAttribute('data-title') || 'PANOOJA Everyday Jewellery',
        price: cleanPrice,
        img: btn.getAttribute('data-img') || '/hero.jpg',
        category: btn.getAttribute('data-category') || 'Jewellery'
      };
      addToCart(product);
    }
  });

  // Support for legacy standalone cart.html if accessed directly
  const legacyCartContainer = document.getElementById('cartContainer');
  if (legacyCartContainer) {
    const legacyEmptyMsg = document.getElementById('emptyCartMsg');
    const legacyCartSummary = document.getElementById('cartSummary');
    const legacyTotalAmount = document.getElementById('cartTotalAmount');

    function renderLegacyCart() {
      legacyCartContainer.innerHTML = '';
      if (cart.length === 0) {
        if (legacyEmptyMsg) legacyEmptyMsg.style.display = 'block';
        if (legacyCartSummary) legacyCartSummary.style.display = 'none';
        return;
      }
      if (legacyEmptyMsg) legacyEmptyMsg.style.display = 'none';
      if (legacyCartSummary) legacyCartSummary.style.display = 'block';

      let total = 0;
      cart.forEach(item => {
        total += item.price * item.quantity;
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
          <img src="${item.img}" alt="${item.title}" referrerPolicy="no-referrer" style="width: 80px; height: 100px; object-fit: cover; border-radius: 4px;">
          <div style="flex: 1;">
            <h4 style="margin: 0; color: var(--black); font-family: var(--font-serif); font-size: 1.2rem;">${item.title}</h4>
            <p style="margin: 5px 0; color: var(--charcoal); font-weight: 600;">₹${item.price.toLocaleString('en-IN')}</p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="qty-btn" data-action="minus" data-id="${item.id}" style="padding: 4px 10px; border: 1px solid var(--light-grey); background: var(--soft-cool-white); cursor: pointer;">-</button>
            <span>${item.quantity}</span>
            <button class="qty-btn" data-action="plus" data-id="${item.id}" style="padding: 4px 10px; border: 1px solid var(--light-grey); background: var(--soft-cool-white); cursor: pointer;">+</button>
          </div>
          <button class="remove-btn" data-id="${item.id}" style="border: none; background: transparent; color: #DC2626; cursor: pointer; text-decoration: underline;">Remove</button>
        `;
        legacyCartContainer.appendChild(itemEl);
      });
      if (legacyTotalAmount) legacyTotalAmount.textContent = '₹' + total.toLocaleString('en-IN');
    }

    renderLegacyCart();

    legacyCartContainer.addEventListener('click', (e) => {
      const qBtn = e.target.closest('.qty-btn');
      if (qBtn) {
        const id = qBtn.getAttribute('data-id');
        const action = qBtn.getAttribute('data-action');
        const item = cart.find(i => i.id === id);
        if (item) {
          if (action === 'plus') item.quantity++;
          else if (action === 'minus') {
            item.quantity--;
            if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);
          }
          saveCart();
          renderLegacyCart();
        }
      }
      const rBtn = e.target.closest('.remove-btn');
      if (rBtn) {
        const id = rBtn.getAttribute('data-id');
        cart = cart.filter(i => i.id !== id);
        saveCart();
        renderLegacyCart();
      }
    });
  }
});

// Expose on window for direct invocation
window.payWithRazorpay = payWithRazorpay;
window.payOnlineCashfree = payWithRazorpay; // Backward compatibility alias
window.openCartDrawer = openCartDrawer;
window.closeCartDrawer = closeCartDrawer;
window.addToCart = addToCart;
window.orderViaWhatsApp = orderViaWhatsApp;
window.renderPageCheckout = renderPageCheckout;
window.applyPromoCode = applyPromoCode;
window.removePromoCode = removePromoCode;
window.calculateDiscount = calculateDiscount;
window.getPublicLiveOffers = getPublicLiveOffers;
window.getFeaturedPublicOffer = getFeaturedPublicOffer;
window.syncPaymentModeUI = syncPaymentModeUI;
