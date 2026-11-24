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

// Brand logo smooth scroll to top on homepage without reloading or changing URL
const brandLogo = document.querySelector('.site-header a.brand');
if (brandLogo) {
  brandLogo.addEventListener('click', (e) => {
    const isHomePage = window.location.pathname === '/' || window.location.pathname.endsWith('index.html') || window.location.pathname === '';
    if (isHomePage) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.location.hash || window.location.pathname.endsWith('index.html')) {
        history.replaceState(null, '', '/');
      }
    }
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

// Global Store of Loaded Products for Quick View, SEO & Filtering
let loadedProductsMap = new Map();
let loadedProductsBySlugMap = new Map();
let currentQuickViewProduct = null;
let currentQuickViewQty = 1;

// Helper to normalize strings into URL-safe slugs
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Default Storefront SEO Metadata (reverted on closing quick view)
const DEFAULT_SEO = {
  title: 'PANOOJA — Waterproof & Anti-Tarnish Jewellery India | Earrings, Rings & Chains',
  description: 'Shop waterproof, anti-tarnish everyday luxury jewellery at PANOOJA India. Premium 316L stainless steel earrings, rings, chains & bracelets with free shipping over ₹799.',
  keywords: 'anti tarnish jewellery India, waterproof jewellery, everyday gold jewellery, stainless steel earrings, anti tarnish rings, Panooja jewellery',
  canonical: 'https://www.panooja.com/',
  ogType: 'website',
  ogTitle: 'PANOOJA — Waterproof & Anti-Tarnish Jewellery India',
  ogDescription: 'Shop waterproof, anti-tarnish everyday luxury jewellery at PANOOJA India. Premium 316L stainless steel earrings, rings, chains & bracelets with free shipping over ₹799.',
  ogImage: 'https://www.panooja.com/logo.png',
  ogUrl: 'https://www.panooja.com/'
};

// Set or update dynamic SEO meta tags on document head
function setPageMetadata(seo) {
  if (seo.title) document.title = seo.title;

  const setMeta = (attr, key, content) => {
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el && content) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    if (el) {
      el.setAttribute('content', content || '');
    }
  };

  // Standard Meta Tags
  setMeta('name', 'description', seo.description || DEFAULT_SEO.description);
  setMeta('name', 'keywords', seo.keywords || DEFAULT_SEO.keywords);

  // Canonical Link
  let canonicalEl = document.querySelector('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', seo.canonical || DEFAULT_SEO.canonical);

  // Open Graph Tags
  setMeta('property', 'og:type', seo.ogType || (seo.isProduct ? 'product' : 'website'));
  setMeta('property', 'og:title', seo.ogTitle || seo.title || DEFAULT_SEO.ogTitle);
  setMeta('property', 'og:description', seo.ogDescription || seo.description || DEFAULT_SEO.ogDescription);
  setMeta('property', 'og:image', seo.ogImage || DEFAULT_SEO.ogImage);
  setMeta('property', 'og:url', seo.ogUrl || seo.canonical || DEFAULT_SEO.ogUrl);

  // Twitter Cards
  setMeta('name', 'twitter:title', seo.ogTitle || seo.title || DEFAULT_SEO.ogTitle);
  setMeta('name', 'twitter:description', seo.ogDescription || seo.description || DEFAULT_SEO.ogDescription);
  setMeta('name', 'twitter:image', seo.ogImage || DEFAULT_SEO.ogImage);
}

function restoreDefaultMetadata() {
  setPageMetadata(DEFAULT_SEO);
  const activeSchema = document.getElementById('activeProductSchema');
  if (activeSchema) activeSchema.remove();
}

function setProductMetadata(product) {
  if (!product) return;
  const productCanonical = `https://www.panooja.com/product/${product.slug}`;
  const firstImage = (product.images && product.images.length > 0) ? product.images[0] : (product.img || DEFAULT_SEO.ogImage);

  setPageMetadata({
    isProduct: true,
    title: product.seoTitle || `${product.name} | Anti-Tarnish Jewellery — PANOOJA`,
    description: product.seoDescription || product.desc || DEFAULT_SEO.description,
    keywords: product.seoKeywords || DEFAULT_SEO.keywords,
    canonical: productCanonical,
    ogType: 'product',
    ogTitle: product.seoTitle || product.name,
    ogDescription: product.seoDescription || product.desc,
    ogImage: firstImage,
    ogUrl: productCanonical
  });

  setProductActiveSchema(product);
}

function setProductActiveSchema(product) {
  const existing = document.getElementById('activeProductSchema');
  if (existing) existing.remove();
  if (!product) return;

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `https://www.panooja.com/product/${product.slug}#product`,
    'url': `https://www.panooja.com/product/${product.slug}`,
    'name': product.name,
    'sku': product.sku,
    'description': product.seoDescription || product.desc,
    'image': product.images && product.images.length > 0 ? product.images : [product.img],
    'category': product.category,
    'brand': {
      '@type': 'Brand',
      'name': 'PANOOJA'
    },
    'material': '316L Surgical Stainless Steel, 18K Gold PVD Plating',
    'offers': {
      '@type': 'Offer',
      'url': `https://www.panooja.com/product/${product.slug}`,
      'priceCurrency': 'INR',
      'price': product.finalPrice,
      'priceValidUntil': '2027-12-31',
      'itemCondition': 'https://schema.org/NewCondition',
      'availability': product.isOutOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      'seller': {
        '@type': 'Organization',
        'name': 'PANOOJA'
      }
    }
  };

  const script = document.createElement('script');
  script.id = 'activeProductSchema';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(productSchema);
  document.head.appendChild(script);
}

function findProductBySlugOrSku(query) {
  if (!query) return null;
  const q = String(query).toLowerCase().trim().replace(/^\/product\//, '').replace(/^\//, '');
  if (loadedProductsBySlugMap.has(q)) {
    return loadedProductsBySlugMap.get(q);
  }
  for (const p of loadedProductsMap.values()) {
    if ((p.slug && p.slug.toLowerCase() === q) || (p.sku && p.sku.toLowerCase() === q)) {
      return p;
    }
  }
  return null;
}

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

// Inject Schema.org JSON-LD for Products (individual Product schemas in @graph)
function injectProductSchema(products) {
  const existingSchema = document.getElementById('dynamicProductSchema');
  if (existingSchema) existingSchema.remove();

  const productGraph = products.map((item) => ({
    '@type': 'Product',
    '@id': `https://www.panooja.com/product/${item.slug}#product`,
    'url': `https://www.panooja.com/product/${item.slug}`,
    'name': item.name,
    'sku': item.sku,
    'description': item.seoDescription || item.desc || 'Waterproof and anti-tarnish 316L stainless steel jewellery by PANOOJA.',
    'image': item.images && item.images.length > 0 ? item.images : [item.img],
    'category': item.category,
    'brand': {
      '@type': 'Brand',
      'name': 'PANOOJA'
    },
    'material': '316L Surgical Stainless Steel, 18K Gold PVD Plating',
    'offers': {
      '@type': 'Offer',
      'url': `https://www.panooja.com/product/${item.slug}`,
      'priceCurrency': 'INR',
      'price': item.finalPrice,
      'priceValidUntil': '2027-12-31',
      'itemCondition': 'https://schema.org/NewCondition',
      'availability': item.isOutOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      'seller': {
        '@type': 'Organization',
        'name': 'PANOOJA'
      }
    }
  }));

  const schemaData = {
    '@context': 'https://schema.org',
    '@graph': productGraph
  };

  const script = document.createElement('script');
  script.id = 'dynamicProductSchema';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schemaData);
  document.head.appendChild(script);
}
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

    // Filter products: "Active on Website (Yes/No)" strictly equals "Yes"
    const activeProducts = rawItems.filter(item => {
      const activeVal = (item['Active on Website (Yes/No)'] || item['Active on Website'] || '').trim().toLowerCase();
      const hasNameOrSku = (item['Product Name'] || item['SKU'] || '').trim().length > 0;
      return activeVal === 'yes' && hasNameOrSku;
    });

    if (activeProducts.length === 0) {
      productGrid.innerHTML = `
        <div class="empty-category-msg" style="grid-column: 1 / -1; display: block; text-align: center; padding: 60px 24px;">
          <h3 style="font-family: var(--font-heading, 'Cormorant Garamond', serif); font-size: 1.6rem; font-weight: 500; margin-bottom: 10px; color: var(--color-black, #050505);">No Active Products Available</h3>
          <p style="color: var(--color-charcoal, #242424); font-size: 0.95rem;">Our catalogue is currently updating with fresh pieces. Please check back shortly.</p>
        </div>
      `;
      if (emptyMsg) emptyMsg.style.display = 'none';
      return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';
    productGrid.innerHTML = '';
    loadedProductsMap.clear();
    loadedProductsBySlugMap.clear();

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

      // SEO Fields from Connected Google Sheet
      const rawSlug = (item['SEO URL Slug (Auto)'] || item['SEO URL Slug'] || item['Slug'] || '').trim().replace(/^\/product\//, '').replace(/^\//, '');
      const slug = rawSlug || slugify(name || sku);
      const seoTitle = (item['SEO Title (Auto)'] || item['SEO Title'] || '').trim() || `${name} | Anti-Tarnish Jewellery — PANOOJA`;
      const seoDescription = (item['SEO Meta Description (Auto)'] || item['SEO Meta Description'] || '').trim() || desc;
      const seoKeywords = (item['SEO Keywords (Auto)'] || item['SEO Keywords'] || '').trim();
      const imageAlt = (item['Image Alt Text (Auto)'] || item['Image Alt Text'] || '').trim() || `${name} — Anti-Tarnish Waterproof Jewellery by PANOOJA`;
      const productUrl = `/product/${slug}`;

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
        slug,
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
        fallbackImg,
        seoTitle,
        seoDescription,
        seoKeywords,
        imageAlt,
        url: productUrl
      };

      loadedProductsMap.set(sku, productObj);
      if (slug) {
        loadedProductsBySlugMap.set(slug.toLowerCase(), productObj);
      }
      formattedProducts.push(productObj);

      // Create Product Card DOM Element
      const card = document.createElement('div');
      card.className = `product-card reveal visible ${isOutOfStock ? 'is-out-of-stock' : ''}`;
      card.setAttribute('data-category', categoryKey);
      card.setAttribute('data-sku', sku);
      card.setAttribute('data-slug', slug);

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

      // Build Carousel Slides HTML using Image Alt Text (Auto)
      const slidesHtml = images.map((imgUrl, i) => {
        const slideAlt = i === 0 ? imageAlt : `${imageAlt} - Photo ${i + 1}`;
        return `
        <div class="carousel-slide">
          <img src="${escapeHTML(imgUrl)}" alt="${escapeHTML(slideAlt)}" loading="lazy" referrerPolicy="no-referrer" onerror="if(this.src!=='${fallbackImg}'){this.src='${fallbackImg}';}" />
        </div>
      `;
      }).join('');

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
        <div class="product-img-wrap quick-view-trigger" data-sku="${escapeHTML(sku)}" data-slug="${escapeHTML(slug)}" style="cursor: pointer;">
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
          <a href="/product/${escapeHTML(slug)}" class="quick-view-trigger product-title-link" data-sku="${escapeHTML(sku)}" data-slug="${escapeHTML(slug)}" style="text-decoration: none; color: inherit; display: block;">
            <h3 style="margin: 0;">${escapeHTML(name)}</h3>
          </a>
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
          onImageClick: () => openQuickView(sku, true)
        });
        activeCarousels.push(carousel);
      }
    });

    // Inject SEO Schema for Products (Individual Product Schema per item)
    injectProductSchema(formattedProducts);

    // Apply active category filter
    applyCategoryFilter();

    // Deep linking: Open product modal if visiting a unique product URL (/product/:slug or ?product=:slug)
    checkInitialProductDeepLink();

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
// PRODUCT QUICK-VIEW MODAL LOGIC (WITH UNIQUE SEO URL & METADATA)
// =============================================================
function openQuickView(skuOrSlug, updateUrl = true) {
  const product = findProductBySlugOrSku(skuOrSlug);
  if (!product) return;

  currentQuickViewProduct = product;
  currentQuickViewQty = 1;

  // Update browser URL to unique product link (/product/:slug)
  if (updateUrl) {
    const productPath = `/product/${product.slug}`;
    try {
      history.pushState({ type: 'product', sku: product.sku, slug: product.slug }, '', productPath);
    } catch (e) {
      history.pushState({ type: 'product', sku: product.sku, slug: product.slug }, '', `?product=${encodeURIComponent(product.slug)}`);
    }
  }

  // Dynamically set per-product SEO metadata (<title>, <meta description>, <meta keywords>, <link rel="canonical">, Open Graph tags)
  setProductMetadata(product);

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

  // Setup Quick View Images & Carousel using Image Alt Text (Auto)
  const images = (product.images && product.images.length > 0) ? product.images : [product.img];

  if (quickViewTrackEl) {
    quickViewTrackEl.style.transform = 'translateX(0%)';
    quickViewTrackEl.innerHTML = images.map((imgUrl, i) => {
      const slideAlt = i === 0 ? product.imageAlt : `${product.imageAlt} - Angle ${i + 1}`;
      return `
      <div class="carousel-slide">
        <img src="${escapeHTML(imgUrl)}" alt="${escapeHTML(slideAlt)}" referrerPolicy="no-referrer" onerror="if(this.src!=='${product.fallbackImg}'){this.src='${product.fallbackImg}';}" />
      </div>
    `;
    }).join('');
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

function closeQuickView(updateUrl = true) {
  document.body.classList.remove('quick-view-open');
  if (quickViewCarouselInstance) {
    quickViewCarouselInstance.destroy();
    quickViewCarouselInstance = null;
  }
  currentQuickViewProduct = null;
  currentQuickViewQty = 1;

  // Restore URL back to clean root
  if (updateUrl) {
    try {
      history.pushState(null, '', '/');
    } catch (e) {
      history.pushState(null, '', window.location.pathname);
    }
  }

  // Restore Default Store Metadata & remove active product schema
  restoreDefaultMetadata();
}

// Deep linking: Open product modal if visiting a unique product URL (/product/:slug or ?product=:slug)
function checkInitialProductDeepLink() {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const productParam = params.get('product');

  let slug = '';
  if (path.startsWith('/product/')) {
    slug = path.replace('/product/', '').replace(/\/$/, '').trim();
  } else if (productParam) {
    slug = productParam.trim();
  }

  if (slug) {
    const product = findProductBySlugOrSku(slug);
    if (product) {
      openQuickView(product.sku, false);
      const card = document.querySelector(`.product-card[data-sku="${product.sku}"]`);
      if (card) {
        setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
      }
    }
  }
}

// Browser Back / Forward Button Navigation (popstate)
window.addEventListener('popstate', (e) => {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const productParam = params.get('product');

  let slug = '';
  if (path.startsWith('/product/')) {
    slug = path.replace('/product/', '').replace(/\/$/, '').trim();
  } else if (productParam) {
    slug = productParam.trim();
  }

  if (slug) {
    const product = findProductBySlugOrSku(slug);
    if (product) {
      openQuickView(product.sku, false);
      return;
    }
  }

  if (document.body.classList.contains('quick-view-open')) {
    closeQuickView(false);
  }
});

// Delegated Click for Quick View Openers (e.g. clicking title, image, or card trigger)
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('.quick-view-trigger');
  if (trigger) {
    // If clicking a carousel arrow or navigation dot, let carousel handle it
    if (e.target.closest('.carousel-arrow') || e.target.closest('.carousel-dot')) {
      return;
    }
    e.preventDefault();
    const target = trigger.getAttribute('data-slug') || trigger.getAttribute('data-sku');
    if (target) {
      openQuickView(target, true);
    }
  }
});

// Quick View Close Listeners
const closeQuickViewBtn = document.getElementById('closeQuickView');
if (closeQuickViewBtn) {
  closeQuickViewBtn.addEventListener('click', () => closeQuickView(true));
}
const quickViewBackdrop = document.getElementById('quickViewBackdrop');
if (quickViewBackdrop) {
  quickViewBackdrop.addEventListener('click', () => closeQuickView(true));
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
