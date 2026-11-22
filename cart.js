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

// =============================================================
// RAZORPAY STANDARD WEB CHECKOUT INTEGRATION
// =============================================================
async function payWithRazorpay(isPageCheckout = false) {
  const nameEl = isPageCheckout ? document.getElementById('pageCheckoutName') : document.getElementById('checkoutName');
  const phoneEl = isPageCheckout ? document.getElementById('pageCheckoutPhone') : document.getElementById('checkoutPhone');
  const addressEl = isPageCheckout ? document.getElementById('pageCheckoutAddress') : document.getElementById('checkoutAddress');
  const pincodeEl = isPageCheckout ? document.getElementById('pageCheckoutPincode') : document.getElementById('checkoutPincode');
  const btnEl = isPageCheckout ? document.getElementById('pageCheckoutOnlineBtn') : document.getElementById('checkoutOnlineBtn');

  const name = nameEl ? nameEl.value.trim() : '';
  const phone = phoneEl ? phoneEl.value.trim() : '';
  const address = addressEl ? addressEl.value.trim() : '';
  const pincode = pincodeEl ? pincodeEl.value.trim() : '';

  if (!name) {
    alert('Please enter your full name.');
    if (nameEl) nameEl.focus();
    return;
  }
  if (!phone || phone.length < 10) {
    alert('Please enter a valid 10-digit phone number.');
    if (phoneEl) phoneEl.focus();
    return;
  }
  if (!address) {
    alert('Please enter your complete delivery address.');
    if (addressEl) addressEl.focus();
    return;
  }
  if (!pincode || pincode.length < 6) {
    alert('Please enter a valid 6-digit delivery pincode.');
    if (pincodeEl) pincodeEl.focus();
    return;
  }

  if (cart.length === 0) {
    alert('Your shopping bag is empty.');
    return;
  }

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

  try {
    // Step 1: Call Backend to Create Order
    const orderRes = await fetch('/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Math.round(grandTotal * 100), // Razorpay requires amount in paise
        amount_in_rupees: grandTotal,
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`,
        customer_name: name,
        customer_phone: phone,
        delivery_address: `${address}, PIN: ${pincode}`
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
        contact: phone
      },
      notes: {
        address: `${address}, PIN: ${pincode}`
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
      window.location.href = 'index.html#shop';
    });
  }
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

// Expose on window for direct invocation
window.payWithRazorpay = payWithRazorpay;
window.payOnlineCashfree = payWithRazorpay; // Backward compatibility alias
window.openCartDrawer = openCartDrawer;
window.closeCartDrawer = closeCartDrawer;
window.addToCart = addToCart;
