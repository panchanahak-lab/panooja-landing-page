// cart.js - PANOOJA Luxury E-Commerce Cart Engine & WhatsApp Checkout
const PANOOJA_WHATSAPP_NUMBER = '919876543210'; // Official PANOOJA WhatsApp concierge number
const FREE_SHIPPING_THRESHOLD = 799;
const STANDARD_SHIPPING_FEE = 79;

let cart = JSON.parse(localStorage.getItem('panooja_cart')) || [];
let appliedCoupon = localStorage.getItem('panooja_coupon') || null;

function saveCart() {
  localStorage.setItem('panooja_cart', JSON.stringify(cart));
  if (appliedCoupon) {
    localStorage.setItem('panooja_coupon', appliedCoupon);
  } else {
    localStorage.removeItem('panooja_coupon');
  }
  updateCartBadge();
  renderCartDrawer();
}

function updateCartBadge() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badges = document.querySelectorAll('#cartCount, #drawerCartCount');
  badges.forEach(b => {
    b.textContent = count;
  });
}

// Calculate discounts based on subtotal and active promo code
function calculateDiscount(subtotal) {
  if (!appliedCoupon) return { code: null, amount: 0, error: null };
  const code = appliedCoupon.toUpperCase().trim();

  if (code === 'WELCOME10') {
    if (subtotal < 500) {
      return { code, amount: 0, error: 'WELCOME10 requires a minimum order of ₹500.' };
    }
    const discount = Math.round(subtotal * 0.10);
    return { code, amount: discount, error: null };
  }

  if (code === 'FESTIVE200') {
    if (subtotal < 1499) {
      return { code, amount: 0, error: 'FESTIVE200 requires a minimum order of ₹1,499.' };
    }
    return { code, amount: 200, error: null };
  }

  if (code === 'FREESHIP') {
    return { code, amount: 0, isFreeShip: true, error: null };
  }

  return { code, amount: 0, error: 'Invalid coupon code.' };
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
    if (discountInfo.amount > 0) {
      discountRow.style.display = 'flex';
      if (discountNameEl) discountNameEl.textContent = discountInfo.code;
      if (discountValEl) discountValEl.textContent = `-₹${discountInfo.amount.toLocaleString('en-IN')}`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  if (shippingEl) {
    shippingEl.textContent = shippingFee === 0 ? 'FREE' : `₹${shippingFee}`;
  }

  if (totalEl) totalEl.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;

  // Update Promo Code Tag
  const promoTag = document.getElementById('promoAppliedTag');
  const promoLabel = document.getElementById('promoCodeLabel');
  if (promoTag && promoLabel) {
    if (appliedCoupon) {
      promoTag.style.display = 'inline-flex';
      promoLabel.textContent = appliedCoupon;
    } else {
      promoTag.style.display = 'none';
    }
  }
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
    if (discountInfo.amount > 0) {
      discountRow.style.display = 'flex';
      discountEl.textContent = `-₹${discountInfo.amount.toLocaleString('en-IN')} (${discountInfo.code})`;
    } else {
      discountRow.style.display = 'none';
    }
  }

  if (shippingEl) shippingEl.textContent = shippingFee === 0 ? 'FREE' : `₹${shippingFee}`;
  if (grandTotalEl) grandTotalEl.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;
}

// Apply Promo Code
function applyPromoCode(code) {
  const cleanCode = (code || '').toUpperCase().trim();
  if (!cleanCode) return;

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (cleanCode === 'WELCOME10') {
    if (subtotal > 0 && subtotal < 500) {
      alert('Code WELCOME10 requires a minimum order value of ₹500.');
      return;
    }
    appliedCoupon = 'WELCOME10';
  } else if (cleanCode === 'FESTIVE200') {
    if (subtotal > 0 && subtotal < 1499) {
      alert('Code FESTIVE200 requires a minimum order value of ₹1,499.');
      return;
    }
    appliedCoupon = 'FESTIVE200';
  } else if (cleanCode === 'FREESHIP') {
    appliedCoupon = 'FREESHIP';
  } else {
    alert(`Coupon "${cleanCode}" is not recognized. Please use WELCOME10 or FESTIVE200.`);
    return;
  }

  saveCart();
  const promoInput = document.getElementById('promoInput');
  if (promoInput) promoInput.value = '';
}

function removePromoCode() {
  appliedCoupon = null;
  saveCart();
}

// Generate formatted WhatsApp Order Text and Redirect
function orderViaWhatsApp() {
  const nameInput = document.getElementById('checkoutName');
  const phoneInput = document.getElementById('checkoutPhone');
  const addressInput = document.getElementById('checkoutAddress');
  const pincodeInput = document.getElementById('checkoutPincode');

  const name = nameInput ? nameInput.value.trim() : '';
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const address = addressInput ? addressInput.value.trim() : '';
  const pincode = pincodeInput ? pincodeInput.value.trim() : '';

  if (!name) {
    alert('Please enter your full name.');
    if (nameInput) nameInput.focus();
    return;
  }
  if (!phone || phone.length < 10) {
    alert('Please enter a valid 10-digit WhatsApp phone number.');
    if (phoneInput) phoneInput.focus();
    return;
  }
  if (!address) {
    alert('Please enter your complete delivery address.');
    if (addressInput) addressInput.focus();
    return;
  }
  if (!pincode || pincode.length < 6) {
    alert('Please enter a valid 6-digit delivery pincode.');
    if (pincodeInput) pincodeInput.focus();
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountInfo = calculateDiscount(subtotal);
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || discountInfo.isFreeShip;
  const shippingFee = (subtotal === 0 || isFreeShipping) ? 0 : STANDARD_SHIPPING_FEE;
  const grandTotal = Math.max(0, subtotal - discountInfo.amount + shippingFee);
  const orderId = 'PNJ-' + Math.floor(100000 + Math.random() * 900000);

  let itemsListText = '';
  cart.forEach((item, index) => {
    itemsListText += `${index + 1}. *${item.title}* x ${item.quantity} - ₹${(item.price * item.quantity).toLocaleString('en-IN')}\n`;
  });

  const message = `✨ *NEW PANOOJA ORDER* ✨
Order ID: #${orderId}

👤 *Customer Details:*
• Name: ${name}
• WhatsApp Phone: ${phone}
• Delivery Address: ${address}
• Pincode: ${pincode}

🛍️ *Items Ordered:*
${itemsListText}
💰 *Price Breakdown:*
• Subtotal: ₹${subtotal.toLocaleString('en-IN')}
${discountInfo.amount > 0 ? `• Discount (${discountInfo.code}): -₹${discountInfo.amount.toLocaleString('en-IN')}\n` : ''}• Express Shipping: ${shippingFee === 0 ? 'FREE' : '₹' + shippingFee}
• *Total Payable: ₹${grandTotal.toLocaleString('en-IN')}*

Please confirm my order and share payment instructions / UPI QR code!`;

  const waUrl = `https://wa.me/${PANOOJA_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  
  // Clear cart & close modal
  cart = [];
  appliedCoupon = null;
  saveCart();
  closeCheckoutModal();

  // Open WhatsApp in new tab
  window.open(waUrl, '_blank');
}

// Online Payment Handler via Cashfree
function payOnlineCashfree() {
  const nameInput = document.getElementById('checkoutName');
  const phoneInput = document.getElementById('checkoutPhone');
  const addressInput = document.getElementById('checkoutAddress');
  const pincodeInput = document.getElementById('checkoutPincode');

  const name = nameInput ? nameInput.value.trim() : '';
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const address = addressInput ? addressInput.value.trim() : '';
  const pincode = pincodeInput ? pincodeInput.value.trim() : '';

  if (!name || !phone || !address || !pincode) {
    alert('Please fill out all shipping details before proceeding with payment.');
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountInfo = calculateDiscount(subtotal);
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || discountInfo.isFreeShip;
  const shippingFee = (subtotal === 0 || isFreeShipping) ? 0 : STANDARD_SHIPPING_FEE;
  const grandTotal = Math.max(0, subtotal - discountInfo.amount + shippingFee);

  alert(`Initiating secure Cashfree UPI & Card checkout for ₹${grandTotal.toLocaleString('en-IN')}.\n\nIf you prefer instant WhatsApp confirmation, click "Order via WhatsApp".`);
}

// DOM Setup
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  renderCartDrawer();

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

  // Promo Code Box Listeners
  const applyPromoBtn = document.getElementById('applyPromoBtn');
  const promoInput = document.getElementById('promoInput');
  if (applyPromoBtn && promoInput) {
    applyPromoBtn.addEventListener('click', () => {
      applyPromoCode(promoInput.value);
    });
    promoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyPromoCode(promoInput.value);
      }
    });
  }

  const removePromoBtn = document.getElementById('removePromoBtn');
  if (removePromoBtn) {
    removePromoBtn.addEventListener('click', removePromoCode);
  }

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
    checkoutWhatsappBtn.addEventListener('click', orderViaWhatsApp);
  }
  const checkoutOnlineBtn = document.getElementById('checkoutOnlineBtn');
  if (checkoutOnlineBtn) {
    checkoutOnlineBtn.addEventListener('click', payOnlineCashfree);
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
        title: btn.getAttribute('data-title') || 'PANOOJA Fine Jewellery',
        price: cleanPrice,
        img: btn.getAttribute('data-img') || 'hero.jpg',
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
