// script.js - PANOOJA E-Commerce Frontend Logic & Live Catalog Integration

// =============================================================
// NAVIGATION & HEADER LOGIC
// =============================================================
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelectorAll('.nav-links a');
const header = document.querySelector('.site-header');

if (menuToggle) {
  menuToggle.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('menu-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    document.body.classList.remove('menu-open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
  });
});

// Sticky header scroll effect
window.addEventListener('scroll', () => {
  if (header) {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }
});

// Reveal animations on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

// Update footer year
const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// =============================================================
// NEWSLETTER & VIP 10% OFF PROMO CODE LOGIC
// =============================================================
const newsletterForm = document.getElementById('newsletterForm') || document.getElementById('waitlistForm');
const couponRevealCard = document.getElementById('couponRevealCard');
const copyCouponBtn = document.getElementById('copyCouponBtn');

if (newsletterForm) {
  const formMessage = document.getElementById('newsletterMessage') || document.getElementById('formMessage');
  const submitButton = document.getElementById('newsletterSubmitBtn') || newsletterForm.querySelector('button[type="submit"]');

  newsletterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const formData = new FormData(newsletterForm);
    const email = (formData.get('email') || '').trim();
    const name = (formData.get('name') || '').trim();
    const companyWebsite = formData.get('companyWebsite'); // Honeypot

    if (!email) {
      if (formMessage) formMessage.textContent = 'Please enter a valid email address.';
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Unlocking 10% Off...';
    }
    if (formMessage) formMessage.textContent = '';

    const payload = {
      email,
      name,
      companyWebsite,
      source: '10_OFF_NEWSLETTER',
      referrer: document.referrer || '',
      page_url: window.location.href
    };

    try {
      const response = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      // Regardless of endpoint presence, display the promo coupon
    } catch (e) {
      // Local or static environment fallback
    }

    // Reveal the 10% Off Coupon Code Card
    if (couponRevealCard) {
      couponRevealCard.style.display = 'block';
      newsletterForm.style.display = 'none';
    }

    // Auto-apply WELCOME10 coupon to cart
    if (typeof applyPromoCode === 'function') {
      applyPromoCode('WELCOME10');
    }

    if (formMessage) {
      formMessage.textContent = 'Welcome to PANOOJA! Code WELCOME10 unlocked below.';
    }
  });
}

// Copy Coupon Button Handler
if (copyCouponBtn) {
  copyCouponBtn.addEventListener('click', () => {
    const code = 'WELCOME10';
    navigator.clipboard.writeText(code).then(() => {
      copyCouponBtn.textContent = '✓ Copied & Applied!';
      if (typeof applyPromoCode === 'function') {
        applyPromoCode(code);
      }
      setTimeout(() => {
        copyCouponBtn.textContent = 'Copy & Apply';
      }, 3000);
    }).catch(() => {
      if (typeof applyPromoCode === 'function') {
        applyPromoCode(code);
      }
      copyCouponBtn.textContent = '✓ Code Applied!';
    });
  });
}

// =============================================================
// LIVE GOOGLE SHEETS PRODUCT CATALOG INTEGRATION
// =============================================================
const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1yF6fF2S8x5dH3u24uH2DNt8WOl9xZ_UTLA6JNmAWbn1XUroDBjS6M-GPXlSHLLtkSaXTllKNQz-n/pub?gid=0&single=true&output=csv';

const CATEGORY_FALLBACKS = {
  earrings: 'earrings.jpg',
  rings: 'rings.jpg',
  pendants: 'pendants.jpg',
  bracelets: 'bracelets.jpg',
  default: 'hero.jpg'
};

// Global Store of Loaded Products for Quick View & Filtering
let loadedProductsMap = new Map();
let currentQuickViewProduct = null;
let currentQuickViewQty = 1;

// CSV Parser handling quotes and line breaks
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field.length > 0)) {
      rows.push(currentRow);
    }
  }
  return rows;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeCategory(cat) {
  const lower = (cat || '').toLowerCase().trim();
  if (lower.includes('earring')) return 'earrings';
  if (lower.includes('ring')) return 'rings';
  if (lower.includes('pendant') || lower.includes('necklace') || lower.includes('chain')) return 'pendants';
  if (lower.includes('bracelet') || lower.includes('kada') || lower.includes('bangle')) return 'bracelets';
  return lower.replace(/[^a-z0-9]/g, '-');
}

// Category Filter Logic
function applyCategoryFilter() {
  const activeBtn = document.querySelector('.filter-btn.active');
  const filter = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
  const productCards = document.querySelectorAll('.product-card');
  const emptyMsg = document.getElementById('emptyCategoryMsg');
  const productGrid = document.getElementById('productGrid');
  
  let visibleCount = 0;
  productCards.forEach(card => {
    const cardCategory = card.getAttribute('data-category');
    if (filter === 'all' || filter === cardCategory) {
      card.style.display = 'flex';
      visibleCount++;
      setTimeout(() => card.classList.add('visible'), 50);
    } else {
      card.style.display = 'none';
      card.classList.remove('visible');
    }
  });

  if (emptyMsg) {
    emptyMsg.style.display = visibleCount === 0 ? 'block' : 'none';
  }
  if (productGrid) {
    if (visibleCount === 1) {
      productGrid.classList.add('single-item');
    } else {
      productGrid.classList.remove('single-item');
    }
  }
}

// Inject Schema.org JSON-LD for Products
function injectProductSchema(products) {
  const existingSchema = document.getElementById('dynamicProductSchema');
  if (existingSchema) existingSchema.remove();

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': 'PANOOJA Waterproof & Anti-Tarnish Jewellery Collection',
    'itemListElement': products.map((item, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'item': {
        '@type': 'Product',
        'name': item.name,
        'description': item.desc || 'Waterproof and anti-tarnish 316L stainless steel jewellery by PANOOJA.',
        'image': item.img,
        'sku': item.sku,
        'offers': {
          '@type': 'Offer',
          'priceCurrency': 'INR',
          'price': item.finalPrice,
          'availability': item.isOutOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
          'url': 'https://www.panooja.com/#shop'
        }
      }
    }))
  };

  const script = document.createElement('script');
  script.id = 'dynamicProductSchema';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(itemList);
  document.head.appendChild(script);
}

// Fetch and Render Live Products from Google Sheets
async function loadLiveProducts() {
  const productGrid = document.getElementById('productGrid');
  const emptyMsg = document.getElementById('emptyCategoryMsg');
  if (!productGrid) return;

  // Render shimmer skeletons
  productGrid.innerHTML = `
    <div class="product-skeleton"></div>
    <div class="product-skeleton"></div>
    <div class="product-skeleton"></div>
  `;

  try {
    const cacheBustUrl = `${GOOGLE_SHEETS_CSV_URL}&_t=${Date.now()}`;
    const response = await fetch(cacheBustUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP status ${response.status}`);
    
    const csvData = await response.text();
    const parsedRows = parseCSV(csvData);
    if (!parsedRows || parsedRows.length < 2) throw new Error('No rows in CSV');

    const headers = parsedRows[0].map(h => h.trim());
    const rawItems = parsedRows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ? row[i].trim() : '';
      });
      return obj;
    });

    // Filter products: "Active on Website (Yes/No)" === "Yes"
    const activeProducts = rawItems.filter(item => {
      const activeVal = item['Active on Website (Yes/No)'] || item['Active on Website'] || '';
      return activeVal.toLowerCase() === 'yes';
    });

    if (activeProducts.length === 0) {
      productGrid.innerHTML = '';
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';
    productGrid.innerHTML = '';
    loadedProductsMap.clear();

    const formattedProducts = [];

    activeProducts.forEach((item, index) => {
      const sku = item['SKU'] || `PNJ-${index + 1}`;
      const name = item['Product Name'] || 'PANOOJA Fine Jewellery';
      const category = item['Category'] || 'Jewellery';
      const categoryKey = normalizeCategory(category);
      const desc = item['Description'] || 'Modern anti-tarnish everyday luxury jewellery handcrafted with 316L surgical stainless steel.';
      const offerTag = item['Offer Tag'] || '';
      const stockStatus = item['Stock Status (Auto)'] || 'In Stock';
      const isOutOfStock = stockStatus.toLowerCase().includes('out of stock');
      const isLowStock = stockStatus.toLowerCase().includes('low stock');

      // Parse Current Stock numeric value
      const rawCurrentStock = item['Current Stock (Auto)'] || '';
      const currentStockNum = parseInt(rawCurrentStock.replace(/[^0-9]/g, ''), 10);
      const isUrgentStock = !isOutOfStock && !isNaN(currentStockNum) && currentStockNum >= 1 && currentStockNum <= 3;

      // Parse prices
      const rawFinalPrice = item['Final Price (INR)'] || '0';
      const finalPriceNum = parseInt(rawFinalPrice.replace(/[^0-9]/g, ''), 10) || 0;
      const rawMRP = item['MRP (INR)'] || '';
      const mrpNum = parseInt(rawMRP.replace(/[^0-9]/g, ''), 10) || 0;
      const discount = item['Discount %'] || '';

      // Direct image URL with category fallback
      let imageUrl = item['Direct Image URL (Auto)'] || '';
      const fallbackImg = CATEGORY_FALLBACKS[categoryKey] || CATEGORY_FALLBACKS.default;
      if (!imageUrl || imageUrl.includes('SAMPLE_FILE_ID')) {
        imageUrl = fallbackImg;
      }

      const productObj = {
        sku,
        name,
        category,
        categoryKey,
        desc,
        offerTag,
        stockStatus,
        isOutOfStock,
        isLowStock,
        isUrgentStock,
        currentStockNum: isNaN(currentStockNum) ? null : currentStockNum,
        finalPrice: finalPriceNum,
        mrp: mrpNum,
        discount,
        img: imageUrl,
        fallbackImg
      };

      loadedProductsMap.set(sku, productObj);
      formattedProducts.push(productObj);

      // Create Product Card DOM Element
      const card = document.createElement('div');
      card.className = `product-card reveal visible ${isOutOfStock ? 'is-out-of-stock' : ''}`;
      card.setAttribute('data-category', categoryKey);
      card.setAttribute('data-sku', sku);

      // Badges
      let badgesHtml = '';
      if (offerTag && offerTag.toLowerCase() !== 'none' && offerTag.trim() !== '') {
        badgesHtml += `<span class="product-offer-badge">${escapeHTML(offerTag)}</span>`;
      }
      if (isOutOfStock) {
        badgesHtml += `<span class="product-stock-badge out-of-stock">Out of Stock</span>`;
      } else if (isUrgentStock) {
        badgesHtml += `<span class="product-stock-badge urgent-stock">Only ${currentStockNum} left!</span>`;
      } else if (isLowStock) {
        badgesHtml += `<span class="product-stock-badge low-stock">Low Stock</span>`;
      }

      // Price Row
      let priceHtml = `<span class="product-final-price">₹${finalPriceNum.toLocaleString('en-IN')}</span>`;
      if (mrpNum > finalPriceNum) {
        priceHtml += `<span class="product-mrp">₹${mrpNum.toLocaleString('en-IN')}</span>`;
      }
      if (discount && discount !== '0%') {
        priceHtml += `<span class="product-discount-label">${escapeHTML(discount)} off</span>`;
      }

      // Action Button
      const buttonHtml = isOutOfStock
        ? `<button class="button button-disabled add-to-cart-btn" disabled="disabled">Out of Stock</button>`
        : `<button class="button button-primary add-to-cart-btn" data-id="${escapeHTML(sku)}" data-title="${escapeHTML(name)}" data-price="${finalPriceNum}" data-img="${escapeHTML(imageUrl)}" data-category="${escapeHTML(category)}">Add to Cart</button>`;

      card.innerHTML = `
        <div class="product-img-wrap quick-view-trigger" data-sku="${escapeHTML(sku)}">
          ${badgesHtml}
          <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(name)}" loading="lazy" referrerPolicy="no-referrer" onerror="if(this.src!=='${fallbackImg}'){this.src='${fallbackImg}';}" />
        </div>
        <div class="product-info">
          <span class="product-category-tag">${escapeHTML(category)}</span>
          <h3 class="quick-view-trigger" data-sku="${escapeHTML(sku)}" style="cursor: pointer;">${escapeHTML(name)}</h3>
          ${desc ? `<p class="product-description">${escapeHTML(desc)}</p>` : ''}
          <div class="product-price-row">
            ${priceHtml}
          </div>
          ${buttonHtml}
        </div>
      `;

      productGrid.appendChild(card);
    });

    // Inject SEO Schema for Products
    injectProductSchema(formattedProducts);

    // Apply active category filter
    applyCategoryFilter();

  } catch (err) {
    console.error('Live Google Sheets Catalog Fetch Error:', err);
    // Graceful fallback display
    const fallbackProducts = [
      {
        sku: 'PNJ-001',
        name: 'Gold Plated Anti-Tarnish Hoop Earrings',
        category: 'Earrings',
        categoryKey: 'earrings',
        desc: '18K gold-plated stainless steel, waterproof and sweat-resistant daily wear hoops.',
        finalPrice: 899,
        mrp: 999,
        discount: '10%',
        offerTag: 'Launch 10% Off',
        isOutOfStock: false,
        img: 'earrings.jpg'
      },
      {
        sku: 'PNJ-002',
        name: 'Waterproof Snake Chain Necklace',
        category: 'Pendants & Chains',
        categoryKey: 'pendants',
        desc: 'Hypoallergenic 316L stainless steel anti-tarnish snake chain, 16-inch + 2-inch extender.',
        finalPrice: 1274,
        mrp: 1499,
        discount: '15%',
        offerTag: 'Festive 15% Off',
        isOutOfStock: false,
        isUrgentStock: true,
        currentStockNum: 2,
        img: 'pendants.jpg'
      },
      {
        sku: 'PNJ-003',
        name: 'Minimalist Anti-Tarnish Kada Bracelet',
        category: 'Kadas & Bracelets',
        categoryKey: 'bracelets',
        desc: 'Tarnish-free gold-tone oval bangle with hidden clasp, water-safe finish.',
        finalPrice: 1299,
        mrp: 1299,
        discount: '',
        offerTag: '',
        isOutOfStock: true,
        img: 'bracelets.jpg'
      }
    ];

    productGrid.innerHTML = '';
    loadedProductsMap.clear();

    fallbackProducts.forEach(product => {
      loadedProductsMap.set(product.sku, product);
      const card = document.createElement('div');
      card.className = `product-card reveal visible ${product.isOutOfStock ? 'is-out-of-stock' : ''}`;
      card.setAttribute('data-category', product.categoryKey);
      card.setAttribute('data-sku', product.sku);

      let badgesHtml = '';
      if (product.offerTag) badgesHtml += `<span class="product-offer-badge">${escapeHTML(product.offerTag)}</span>`;
      if (product.isOutOfStock) badgesHtml += `<span class="product-stock-badge out-of-stock">Out of Stock</span>`;
      else if (product.isUrgentStock) badgesHtml += `<span class="product-stock-badge urgent-stock">Only ${product.currentStockNum} left!</span>`;

      card.innerHTML = `
        <div class="product-img-wrap quick-view-trigger" data-sku="${product.sku}">
          ${badgesHtml}
          <img src="${product.img}" alt="${product.name}" loading="lazy" referrerPolicy="no-referrer" />
        </div>
        <div class="product-info">
          <span class="product-category-tag">${product.category}</span>
          <h3 class="quick-view-trigger" data-sku="${product.sku}" style="cursor: pointer;">${product.name}</h3>
          <p class="product-description">${product.desc}</p>
          <div class="product-price-row">
            <span class="product-final-price">₹${product.finalPrice.toLocaleString('en-IN')}</span>
            ${product.mrp > product.finalPrice ? `<span class="product-mrp">₹${product.mrp.toLocaleString('en-IN')}</span>` : ''}
            ${product.discount ? `<span class="product-discount-label">${product.discount} off</span>` : ''}
          </div>
          ${product.isOutOfStock 
            ? `<button class="button button-disabled add-to-cart-btn" disabled="disabled">Out of Stock</button>` 
            : `<button class="button button-primary add-to-cart-btn" data-id="${product.sku}" data-title="${product.name}" data-price="${product.finalPrice}" data-img="${product.img}">Add to Cart</button>`}
        </div>
      `;
      productGrid.appendChild(card);
    });

    applyCategoryFilter();
  }
}

// =============================================================
// PRODUCT QUICK-VIEW MODAL LOGIC
// =============================================================
function openQuickView(sku) {
  const product = loadedProductsMap.get(sku);
  if (!product) return;

  currentQuickViewProduct = product;
  currentQuickViewQty = 1;

  const modal = document.getElementById('quickViewModal');
  const imgEl = document.getElementById('quickViewImg');
  const offerBadge = document.getElementById('quickViewOfferBadge');
  const catEl = document.getElementById('quickViewCategory');
  const titleEl = document.getElementById('quickViewTitle');
  const priceEl = document.getElementById('quickViewPrice');
  const mrpEl = document.getElementById('quickViewMRP');
  const discountEl = document.getElementById('quickViewDiscount');
  const stockAlert = document.getElementById('quickViewStockAlert');
  const descEl = document.getElementById('quickViewDesc');
  const qtyEl = document.getElementById('quickViewQty');
  const addBtn = document.getElementById('quickViewAddBtn');

  if (imgEl) {
    imgEl.src = product.img;
    imgEl.alt = product.name;
    imgEl.referrerPolicy = 'no-referrer';
  }

  if (offerBadge) {
    if (product.offerTag && product.offerTag.toLowerCase() !== 'none' && product.offerTag.trim() !== '') {
      offerBadge.textContent = product.offerTag;
      offerBadge.style.display = 'inline-block';
    } else {
      offerBadge.style.display = 'none';
    }
  }

  if (catEl) catEl.textContent = product.category;
  if (titleEl) titleEl.textContent = product.name;
  if (priceEl) priceEl.textContent = `₹${product.finalPrice.toLocaleString('en-IN')}`;

  if (mrpEl) {
    if (product.mrp > product.finalPrice) {
      mrpEl.textContent = `₹${product.mrp.toLocaleString('en-IN')}`;
      mrpEl.style.display = 'inline';
    } else {
      mrpEl.style.display = 'none';
    }
  }

  if (discountEl) {
    if (product.discount && product.discount !== '0%') {
      discountEl.textContent = `${product.discount} OFF`;
      discountEl.style.display = 'inline-block';
    } else {
      discountEl.style.display = 'none';
    }
  }

  if (stockAlert) {
    if (product.isOutOfStock) {
      stockAlert.innerHTML = `<span class="product-stock-badge out-of-stock" style="position: static;">Out of Stock</span>`;
    } else if (product.isUrgentStock) {
      stockAlert.innerHTML = `<span class="product-stock-badge urgent-stock" style="position: static;">Only ${product.currentStockNum} Left in Stock — Order Soon!</span>`;
    } else {
      stockAlert.innerHTML = `<span style="font-size: 0.82rem; color: #10B981; font-weight: 600;">✓ In Stock & Ready to Dispatch</span>`;
    }
  }

  if (descEl) descEl.textContent = product.desc;
  if (qtyEl) qtyEl.textContent = '1';

  if (addBtn) {
    if (product.isOutOfStock) {
      addBtn.disabled = true;
      addBtn.textContent = 'Out of Stock';
      addBtn.className = 'button button-disabled';
    } else {
      addBtn.disabled = false;
      addBtn.textContent = 'Add to Cart';
      addBtn.className = 'button button-primary';
    }
  }

  document.body.classList.add('quick-view-open');
}

function closeQuickView() {
  document.body.classList.remove('quick-view-open');
  currentQuickViewProduct = null;
  currentQuickViewQty = 1;
}

// Delegated Click for Quick View Openers
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('.quick-view-trigger');
  if (trigger) {
    const sku = trigger.getAttribute('data-sku');
    if (sku) {
      openQuickView(sku);
    }
  }
});

// Quick View Close Listeners
const closeQuickViewBtn = document.getElementById('closeQuickView');
if (closeQuickViewBtn) {
  closeQuickViewBtn.addEventListener('click', closeQuickView);
}
const quickViewBackdrop = document.getElementById('quickViewBackdrop');
if (quickViewBackdrop) {
  quickViewBackdrop.addEventListener('click', closeQuickView);
}

// Quick View Quantity Controls
const qvMinus = document.getElementById('quickViewMinus');
const qvPlus = document.getElementById('quickViewPlus');
const qvQty = document.getElementById('quickViewQty');

if (qvMinus && qvPlus && qvQty) {
  qvMinus.addEventListener('click', () => {
    if (currentQuickViewQty > 1) {
      currentQuickViewQty--;
      qvQty.textContent = currentQuickViewQty;
    }
  });
  qvPlus.addEventListener('click', () => {
    currentQuickViewQty++;
    qvQty.textContent = currentQuickViewQty;
  });
}

// Quick View Add to Cart
const qvAddBtn = document.getElementById('quickViewAddBtn');
if (qvAddBtn) {
  qvAddBtn.addEventListener('click', () => {
    if (!currentQuickViewProduct || currentQuickViewProduct.isOutOfStock) return;
    addToCart({
      id: currentQuickViewProduct.sku,
      title: currentQuickViewProduct.name,
      price: currentQuickViewProduct.finalPrice,
      img: currentQuickViewProduct.img,
      category: currentQuickViewProduct.category,
      quantity: currentQuickViewQty
    });
    closeQuickView();
  });
}

// Quick View Buy via WhatsApp
const qvWhatsappBtn = document.getElementById('quickViewWhatsappBtn');
if (qvWhatsappBtn) {
  qvWhatsappBtn.addEventListener('click', () => {
    if (!currentQuickViewProduct) return;
    const itemTotal = currentQuickViewProduct.finalPrice * currentQuickViewQty;
    const msg = `Hi PANOOJA! 👋 I would like to order:
• *${currentQuickViewProduct.name}* (SKU: ${currentQuickViewProduct.sku})
• Quantity: ${currentQuickViewQty}
• Total: ₹${itemTotal.toLocaleString('en-IN')}

Please share payment details and dispatch time!`;
    const url = `https://wa.me/919876543210?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  });
}

// Escape Key Closes Any Active Modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeQuickView();
    if (typeof closeCartDrawer === 'function') closeCartDrawer();
    if (typeof closeCheckoutModal === 'function') closeCheckoutModal();
  }
});

// Category Filter Tab Listeners
const filterBtns = document.querySelectorAll('.filter-btn');
if (filterBtns.length > 0) {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyCategoryFilter();
    });
  });
}

// Category Trigger clicks (e.g. from Collections or The Edit cards)
const categoryTriggers = document.querySelectorAll('.category-trigger');
if (categoryTriggers.length > 0) {
  categoryTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const targetFilter = trigger.getAttribute('data-filter-target');
      if (targetFilter) {
        const targetBtn = document.querySelector(`.filter-btn[data-filter="${targetFilter}"]`);
        if (targetBtn) {
          filterBtns.forEach(b => b.classList.remove('active'));
          targetBtn.classList.add('active');
          applyCategoryFilter();
        }
      }
      const shopSection = document.getElementById('shop');
      if (shopSection) {
        shopSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// Initialize live products
if (document.getElementById('productGrid')) {
  loadLiveProducts();
}
