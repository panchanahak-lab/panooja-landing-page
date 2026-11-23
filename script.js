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
}, { threshold: 0.05, rootMargin: '0px 0px 50px 0px' });

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
      const res = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      // Phase 5 Requirement: Only reveal coupon on server-confirmed success
      if (res.ok && (data.ok === true || data.status === 'created' || data.status === 'duplicate')) {
        if (couponRevealCard) {
          couponRevealCard.style.display = 'block';
          newsletterForm.style.display = 'none';
        }

        if (typeof applyPromoCode === 'function') {
          applyPromoCode('WELCOME10');
        }

        if (formMessage) {
          formMessage.style.color = '#10B981';
          formMessage.textContent = data.status === 'duplicate'
            ? 'Welcome back! Your code WELCOME10 is unlocked below.'
            : 'Welcome to PANOOJA! Code WELCOME10 unlocked below.';
        }
      } else {
        // Registration failed: DO NOT reveal coupon
        if (formMessage) {
          formMessage.style.color = '#EF4444';
          formMessage.textContent = data.message || 'Unable to register email at this moment. Please try again.';
        }
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Get 10% Off';
        }
      }
    } catch (err) {
      console.error('Newsletter submission error:', err);
      if (formMessage) {
        formMessage.style.color = '#EF4444';
        formMessage.textContent = 'Network connection error. Please check your connection and try again.';
      }
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Get 10% Off';
      }
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
// AUTOMATIC PRODUCT IMAGE CAROUSEL CLASS
// Handles auto-sliding every 3s, pause on touch/hold/hover,
// swipe gestures, and dot indicators.
// =============================================================
class ProductCarousel {
  constructor(viewportEl, images, options = {}) {
    this.viewport = viewportEl;
    this.track = viewportEl.querySelector('.carousel-track');
    this.dots = viewportEl.querySelectorAll('.carousel-dot');
    this.prevBtn = viewportEl.querySelector('.carousel-arrow-prev');
    this.nextBtn = viewportEl.querySelector('.carousel-arrow-next');
    this.images = images || [];
    this.total = this.images.length;
    this.currentIndex = 0;
    this.intervalTime = 3000; // 3 seconds continuous loop
    this.timer = null;
    this.isPaused = false;
    this.isHovering = false;
    this.isPointerDown = false;
    this.startX = 0;
    this.startY = 0;
    this.diffX = 0;
    this.diffY = 0;
    this.isSwiping = false;
    this.onImageClick = options.onImageClick || null;

    if (this.total > 1) {
      this.bindEvents();
      this.startTimer();
    }
  }

  startTimer() {
    this.stopTimer();
    if (this.total <= 1 || this.isPaused) return;
    this.timer = setInterval(() => {
      this.next();
    }, this.intervalTime);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pause() {
    this.isPaused = true;
    this.stopTimer();
  }

  resume() {
    this.isPaused = false;
    this.startTimer();
  }

  goTo(index) {
    if (this.total <= 0) return;
    // Continuous loop wrap-around: 1 -> 2 -> 3 -> 1
    this.currentIndex = (index + this.total) % this.total;
    if (this.track) {
      this.track.style.transform = `translateX(-${this.currentIndex * 100}%)`;
    }
    this.updateDots();
  }

  next() {
    this.goTo(this.currentIndex + 1);
  }

  prev() {
    this.goTo(this.currentIndex - 1);
  }

  updateDots() {
    if (!this.dots || this.dots.length === 0) return;
    this.dots.forEach((dot, idx) => {
      if (idx === this.currentIndex) {
        dot.classList.add('active');
        dot.setAttribute('aria-current', 'true');
      } else {
        dot.classList.remove('active');
        dot.removeAttribute('aria-current');
      }
    });
  }

  bindEvents() {
    // 1. Desktop Hover: pause on mouseenter, resume on mouseleave
    this.viewport.addEventListener('mouseenter', () => {
      this.isHovering = true;
      this.pause();
    });
    this.viewport.addEventListener('mouseleave', () => {
      this.isHovering = false;
      if (!this.isPointerDown) {
        this.resume();
      }
    });

    // 2. Dot Indicators Click / Tap
    if (this.dots) {
      this.dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetIndex = parseInt(dot.getAttribute('data-index'), 10) || 0;
          this.goTo(targetIndex);
          this.stopTimer();
          if (!this.isPaused && !this.isHovering) this.startTimer();
        });
      });
    }

    // 3. Arrow Controls
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.prev();
        this.stopTimer();
        if (!this.isPaused && !this.isHovering) this.startTimer();
      });
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.next();
        this.stopTimer();
        if (!this.isPaused && !this.isHovering) this.startTimer();
      });
    }

    // 4. Pointer & Touch Interactions (Unified Mobile & Desktop)
    const handleStart = (clientX, clientY) => {
      this.isPointerDown = true;
      this.pause(); // Immediately pause auto-slide on touch / hold
      this.startX = clientX;
      this.startY = clientY;
      this.diffX = 0;
      this.diffY = 0;
      this.isSwiping = false;
    };

    const handleMove = (clientX, clientY) => {
      if (!this.isPointerDown) return;
      this.diffX = clientX - this.startX;
      this.diffY = clientY - this.startY;

      if (Math.abs(this.diffX) > Math.abs(this.diffY) && Math.abs(this.diffX) > 8) {
        this.isSwiping = true;
      }
    };

    const handleEnd = () => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;

      // Handle swipe gesture
      if (this.isSwiping) {
        if (this.diffX < -30) {
          this.next();
        } else if (this.diffX > 30) {
          this.prev();
        }
      }

      // Resume auto-slide after release buffer if not actively hovering on desktop
      setTimeout(() => {
        this.isSwiping = false;
        if (!this.isHovering) {
          this.resume();
        }
      }, 500);
    };

    // Native pointer events (pointerdown / pointerup / pointercancel)
    this.viewport.addEventListener('pointerdown', (e) => {
      handleStart(e.clientX, e.clientY);
    });

    window.addEventListener('pointerup', () => {
      if (this.isPointerDown) {
        handleEnd();
      }
    });

    window.addEventListener('pointercancel', () => {
      if (this.isPointerDown) {
        handleEnd();
      }
    });

    // Mobile touch events (fallback & fine touch drag)
    this.viewport.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    this.viewport.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    this.viewport.addEventListener('touchend', () => {
      handleEnd();
    }, { passive: true });

    this.viewport.addEventListener('touchcancel', () => {
      handleEnd();
    }, { passive: true });

    // Desktop mouse hold events
    this.viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      handleStart(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      if (this.isPointerDown) {
        handleEnd();
      }
    });

    // Delegated click on image for Quick View trigger
    if (this.onImageClick) {
      this.viewport.addEventListener('click', (e) => {
        if (e.target.closest('.carousel-dots') || e.target.closest('.carousel-arrow')) {
          return;
        }
        if (Math.abs(this.diffX) > 10) {
          return; // was swiping
        }
        this.onImageClick(e);
      });
    }
  }

  destroy() {
    this.stopTimer();
    this.isPaused = true;
  }
}

// Active Carousels registry to prevent memory leaks during re-filtering
let activeCarousels = [];
let quickViewCarouselInstance = null;

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

// Collect all non-empty, unique image URLs from the Google Sheet columns:
// Direct Image URL (Auto), Direct Image URL 2 (Auto), Direct Image URL 3 (Auto), Direct Image URL 4 (Auto)
function extractProductImages(item, categoryKey) {
  const directCols = [
    item['Direct Image URL (Auto)'],
    item['Direct Image URL 2 (Auto)'],
    item['Direct Image URL 3 (Auto)'],
    item['Direct Image URL 4 (Auto)'],
    item['Direct Image URL'],
    item['Direct Image URL 2'],
    item['Direct Image URL 3'],
    item['Direct Image URL 4'],
    item['Google Drive Share Link'],
    item['Drive Link 2'],
    item['Drive Link 3'],
    item['Drive Link 4']
  ];

  const collected = [];
  const seen = new Set();

  directCols.forEach(raw => {
    if (!raw) return;
    let url = String(raw).trim();
    if (!url || url.toLowerCase() === 'none' || url.toLowerCase() === 'null') return;

    // Filter out Google Drive folder URLs which cannot render as image files
    if (url.includes('/drive/folders/') || url.includes('/folders/')) {
      return;
    }

    // Convert standard Google Drive file URL to direct lh3 link
    const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1] && !url.includes('lh3.googleusercontent.com')) {
      url = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }

    // Skip placeholder sample IDs if present
    if (url.includes('SAMPLE_FILE_ID')) {
      return;
    }

    if (!seen.has(url)) {
      seen.add(url);
      collected.push(url);
    }
  });

  // If the sheet has real images, return them
  if (collected.length > 0) {
    return collected;
  }

  // When no image is provided, use single genuine category fallback image
  const fallback = CATEGORY_FALLBACKS[categoryKey] || CATEGORY_FALLBACKS.default;
  return [fallback];
}

// CSV Parser handling quotes, commas, and line breaks
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
        'image': item.images,
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

  // Clear existing carousels
  activeCarousels.forEach(c => c.destroy());
  activeCarousels = [];

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

      // Collect all non-empty image URLs (Direct Image URL Auto 1-4)
      const images = extractProductImages(item, categoryKey);
      const fallbackImg = CATEGORY_FALLBACKS[categoryKey] || CATEGORY_FALLBACKS.default;

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
        images,
        img: images[0] || fallbackImg,
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

      // Build Carousel Slides HTML
      const slidesHtml = images.map((imgUrl, i) => `
        <div class="carousel-slide">
          <img src="${escapeHTML(imgUrl)}" alt="${escapeHTML(name)} - Photo ${i + 1}" loading="lazy" referrerPolicy="no-referrer" onerror="if(this.src!=='${fallbackImg}'){this.src='${fallbackImg}';}" />
        </div>
      `).join('');

      // Build Dot Indicators HTML
      const dotsHtml = images.length > 1 ? `
        <div class="carousel-dots" aria-label="Image slide controls">
          ${images.map((_, i) => `
            <button type="button" class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Jump to slide ${i + 1}"></button>
          `).join('')}
        </div>
      ` : '';

      // Build Nav Arrows HTML
      const arrowsHtml = images.length > 1 ? `
        <button type="button" class="carousel-arrow carousel-arrow-prev" aria-label="Previous image">‹</button>
        <button type="button" class="carousel-arrow carousel-arrow-next" aria-label="Next image">›</button>
      ` : '';

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
        : `<button class="button button-primary add-to-cart-btn" data-id="${escapeHTML(sku)}" data-title="${escapeHTML(name)}" data-price="${finalPriceNum}" data-img="${escapeHTML(images[0])}" data-category="${escapeHTML(category)}">Add to Cart</button>`;

      card.innerHTML = `
        <div class="product-img-wrap" data-sku="${escapeHTML(sku)}">
          ${badgesHtml}
          <div class="carousel-viewport" data-sku="${escapeHTML(sku)}">
            <div class="carousel-track">
              ${slidesHtml}
            </div>
            ${dotsHtml}
            ${arrowsHtml}
          </div>
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

      // Initialize Carousel Instance for this Card
      const viewportEl = card.querySelector('.carousel-viewport');
      if (viewportEl) {
        const carousel = new ProductCarousel(viewportEl, images, {
          onImageClick: () => openQuickView(sku)
        });
        activeCarousels.push(carousel);
      }
    });

    // Inject SEO Schema for Products
    injectProductSchema(formattedProducts);

    // Apply active category filter
    applyCategoryFilter();

  } catch (err) {
    console.error('Live Google Sheets Catalog Fetch Error:', err);
    loadedProductsMap.clear();

    if (emptyMsg) emptyMsg.style.display = 'none';

    productGrid.innerHTML = `
      <div class="catalog-error-state" style="grid-column: 1 / -1; text-align: center; padding: 60px 24px; max-width: 540px; margin: 0 auto;">
        <div style="font-size: 2rem; margin-bottom: 12px; color: var(--color-royal-blue, #1B69E8);" aria-hidden="true">✦</div>
        <h3 style="font-family: var(--font-heading, 'Cormorant Garamond', serif); font-size: 1.6rem; font-weight: 500; margin-bottom: 10px; color: var(--color-black, #050505);">Collection Temporarily Unavailable</h3>
        <p style="color: var(--color-charcoal, #242424); font-size: 0.95rem; line-height: 1.6; margin-bottom: 24px;">We are unable to load our live product catalogue at this moment. Please check your connection and try refreshing.</p>
        <button type="button" class="button button-secondary" onclick="loadLiveProducts()" style="min-width: 180px;">↻ Retry Loading Collection</button>
      </div>
    `;
  }
}

// =============================================================
// PRODUCT QUICK-VIEW MODAL LOGIC (WITH IMAGE CAROUSEL)
// =============================================================
function openQuickView(sku) {
  const product = loadedProductsMap.get(sku);
  if (!product) return;

  currentQuickViewProduct = product;
  currentQuickViewQty = 1;

  const quickViewCarouselEl = document.getElementById('quickViewCarousel');
  const quickViewTrackEl = document.getElementById('quickViewTrack');
  const quickViewDotsEl = document.getElementById('quickViewDots');
  const quickViewPrevBtn = document.getElementById('quickViewPrev');
  const quickViewNextBtn = document.getElementById('quickViewNext');

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

  // Destroy previous quick-view carousel if exists
  if (quickViewCarouselInstance) {
    quickViewCarouselInstance.destroy();
    quickViewCarouselInstance = null;
  }

  // Setup Quick View Images & Carousel
  const images = (product.images && product.images.length > 0) ? product.images : [product.img];

  if (quickViewTrackEl) {
    quickViewTrackEl.style.transform = 'translateX(0%)';
    quickViewTrackEl.innerHTML = images.map((imgUrl, i) => `
      <div class="carousel-slide">
        <img src="${escapeHTML(imgUrl)}" alt="${escapeHTML(product.name)} - View ${i + 1}" referrerPolicy="no-referrer" onerror="if(this.src!=='${product.fallbackImg}'){this.src='${product.fallbackImg}';}" />
      </div>
    `).join('');
  }

  if (quickViewDotsEl) {
    if (images.length > 1) {
      quickViewDotsEl.style.display = 'inline-flex';
      quickViewDotsEl.innerHTML = images.map((_, i) => `
        <button type="button" class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}" aria-label="Jump to slide ${i + 1}"></button>
      `).join('');
    } else {
      quickViewDotsEl.style.display = 'none';
      quickViewDotsEl.innerHTML = '';
    }
  }

  if (quickViewPrevBtn && quickViewNextBtn) {
    if (images.length > 1) {
      quickViewPrevBtn.style.display = 'flex';
      quickViewNextBtn.style.display = 'flex';
    } else {
      quickViewPrevBtn.style.display = 'none';
      quickViewNextBtn.style.display = 'none';
    }
  }

  // Initialize Quick View Carousel
  if (quickViewCarouselEl && images.length > 1) {
    quickViewCarouselInstance = new ProductCarousel(quickViewCarouselEl, images, {
      isQuickView: true
    });
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
  if (quickViewCarouselInstance) {
    quickViewCarouselInstance.destroy();
    quickViewCarouselInstance = null;
  }
  currentQuickViewProduct = null;
  currentQuickViewQty = 1;
}

// Delegated Click for Quick View Openers (e.g. clicking title)
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('.quick-view-trigger');
  if (trigger && !trigger.classList.contains('product-img-wrap')) {
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
      img: currentQuickViewProduct.images ? currentQuickViewProduct.images[0] : currentQuickViewProduct.img,
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

// Initialize live products on DOM load
if (document.getElementById('productGrid')) {
  loadLiveProducts();
}
