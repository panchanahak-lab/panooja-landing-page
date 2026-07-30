// cart.js
let cart = JSON.parse(localStorage.getItem('panooja_cart')) || [];

function saveCart() {
  localStorage.setItem('panooja_cart', JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cartCount');
  if (badge) {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = totalItems;
  }
}

function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  saveCart();
  alert(`${product.title} added to cart!`);
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();

  const addBtns = document.querySelectorAll('.add-to-cart-btn');
  addBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const product = {
        id: btn.getAttribute('data-id'),
        title: btn.getAttribute('data-title'),
        price: parseInt(btn.getAttribute('data-price')),
        img: btn.getAttribute('data-img')
      };
      addToCart(product);
    });
  });

  // If on cart page, render cart
  const cartContainer = document.getElementById('cartContainer');
  const cartSummary = document.getElementById('cartSummary');
  const emptyCartMsg = document.getElementById('emptyCartMsg');
  const cartTotalAmount = document.getElementById('cartTotalAmount');

  function renderCart() {
    if (!cartContainer) return;
    
    cartContainer.innerHTML = '';
    
    if (cart.length === 0) {
      emptyCartMsg.style.display = 'block';
      cartSummary.style.display = 'none';
      return;
    }
    
    emptyCartMsg.style.display = 'none';
    cartSummary.style.display = 'block';
    
    let total = 0;
    
    cart.forEach((item, index) => {
      total += item.price * item.quantity;
      
      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item';
      itemEl.style.display = 'flex';
      itemEl.style.alignItems = 'center';
      itemEl.style.gap = '20px';
      itemEl.style.padding = '15px 0';
      itemEl.style.borderBottom = '1px solid var(--line)';
      
      itemEl.innerHTML = `
        <img src="${item.img}" alt="${item.title}" style="width: 80px; height: 100px; object-fit: cover; border-radius: 8px;">
        <div style="flex: 1;">
          <h4 style="margin: 0; color: var(--navy);">${item.title}</h4>
          <p style="margin: 5px 0; color: var(--muted);">₹${item.price}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <button class="qty-btn" data-action="minus" data-id="${item.id}" style="padding: 5px 10px; border: 1px solid var(--line); background: transparent; cursor: pointer;">-</button>
          <span>${item.quantity}</span>
          <button class="qty-btn" data-action="plus" data-id="${item.id}" style="padding: 5px 10px; border: 1px solid var(--line); background: transparent; cursor: pointer;">+</button>
        </div>
        <button class="remove-btn" data-id="${item.id}" style="border: none; background: transparent; color: red; cursor: pointer; text-decoration: underline;">Remove</button>
      `;
      cartContainer.appendChild(itemEl);
    });
    
    cartTotalAmount.textContent = '₹' + total;
  }
  
  if (cartContainer) {
    renderCart();
    
    cartContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('qty-btn')) {
        const id = e.target.getAttribute('data-id');
        const action = e.target.getAttribute('data-action');
        const item = cart.find(i => i.id === id);
        
        if (action === 'plus') {
          item.quantity++;
        } else if (action === 'minus' && item.quantity > 1) {
          item.quantity--;
        }
        saveCart();
        renderCart();
      }
      
      if (e.target.classList.contains('remove-btn')) {
        const id = e.target.getAttribute('data-id');
        cart = cart.filter(i => i.id !== id);
        saveCart();
        renderCart();
      }
    });
  }

  // Checkout page logic
  const checkoutForm = document.getElementById('checkoutForm');
  const checkoutTotal = document.getElementById('checkoutTotal');
  const checkoutMessage = document.getElementById('checkoutMessage');
  const placeOrderBtn = document.getElementById('placeOrderBtn');

  if (checkoutForm && checkoutTotal) {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    checkoutTotal.textContent = '₹' + total;

    if (cart.length === 0) {
      checkoutMessage.textContent = 'Your cart is empty. Please add items before checking out.';
      placeOrderBtn.disabled = true;
    }

    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (cart.length === 0) return;

      const formData = new FormData(checkoutForm);
      const payload = {
        type: 'ORDER',
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        orderTotal: total,
        items: JSON.stringify(cart)
      };

      placeOrderBtn.disabled = true;
      placeOrderBtn.textContent = 'Processing Order...';
      checkoutMessage.textContent = '';

      try {
        const response = await fetch('/api/early-access', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.ok || response.ok) {
          checkoutMessage.textContent = 'Order Placed Successfully! We will contact you soon.';
          checkoutForm.reset();
          cart = [];
          saveCart();
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 3000);
        } else {
          checkoutMessage.textContent = 'There was an issue processing your order. Please try again.';
          placeOrderBtn.disabled = false;
          placeOrderBtn.textContent = 'Place Order (COD)';
        }
      } catch (err) {
        checkoutMessage.textContent = 'Order Placed Successfully! (Offline Mode)';
        checkoutForm.reset();
        cart = [];
        saveCart();
      }
    });
  }
});
