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

      // Reveal featured public coupon ONLY when Live Status is Live AND Show on Website (Yes/No) is Yes
      if (res.ok && (data.ok === true || data.status === 'created' || data.status === 'duplicate')) {
        const featuredOffer = (typeof window.getFeaturedPublicOffer === 'function')
          ? window.getFeaturedPublicOffer()
          : null;

        if (featuredOffer) {
          const revealedEl = document.getElementById('revealedCouponCode');
          if (revealedEl) revealedEl.textContent = featuredOffer.code;

          if (couponRevealCard) {
            couponRevealCard.style.display = 'block';
            newsletterForm.style.display = 'none';
          }

          if (typeof applyPromoCode === 'function') {
            applyPromoCode(featuredOffer.code, false);
          }

          if (formMessage) {
            formMessage.style.color = '#10B981';
            formMessage.textContent = data.status === 'duplicate'
              ? `Welcome back! Your code ${featuredOffer.code} is unlocked below.`
              : `Welcome to PANOOJA! Code ${featuredOffer.code} unlocked below.`;
          }
        } else {
          if (couponRevealCard) couponRevealCard.style.display = 'none';
          if (formMessage) {
            formMessage.style.color = '#10B981';
            formMessage.textContent = data.status === 'duplicate'
              ? 'Welcome back to the PANOOJA list!'
              : 'Welcome to the PANOOJA list! Watch your inbox for new drops and styling edits.';
          }
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Subscribed ✓';
          }
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
    const revealedEl = document.getElementById('revealedCouponCode');
    const code = (revealedEl ? revealedEl.textContent : '').trim();
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      copyCouponBtn.textContent = '✓ Copied & Applied!';
      if (typeof applyPromoCode === 'function') {
        applyPromoCode(code, false);
      }
      setTimeout(() => {
        copyCouponBtn.textContent = 'Copy & Apply';
      }, 3000);
    }).catch(() => {
      if (typeof applyPromoCode === 'function') {
        applyPromoCode(code, false);
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

    // Touch swipe events (mobile phones)
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

    // Mouse / Pen drag events (desktop only; touch uses touch* handlers cleanly)
    this.viewport.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      handleStart(e.clientX, e.clientY);
    });

    this.viewport.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !this.isPointerDown) return;
      handleMove(e.clientX, e.clientY);
    });

    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') return;
      if (this.isPointerDown) {
        handleEnd();
      }
    });

    window.addEventListener('pointercancel', (e) => {
      if (e.pointerType === 'touch') return;
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
  earrings: '/earrings.jpg',
  rings: '/rings.jpg',
  pendants: '/pendants.jpg',
  bracelets: '/bracelets.jpg',
  default: '/hero.jpg'
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
  description: 'Shop waterproof, anti-tarnish everyday jewellery at PANOOJA India. 316L stainless steel earrings, rings, chains & bracelets with free shipping over ₹799.',
  canonical: 'https://www.panooja.com/',
  ogType: 'website',
  ogTitle: 'PANOOJA — Waterproof & Anti-Tarnish Jewellery India',
  ogDescription: 'Shop waterproof, anti-tarnish everyday jewellery at PANOOJA India. 316L stainless steel earrings, rings, chains & bracelets with free shipping over ₹799.',
  ogImage: 'https://www.panooja.com/og-image.jpg',
  ogUrl: 'https://www.panooja.com/'
};

function toAbsoluteSeoUrl(url) {
  if (!url) return DEFAULT_SEO.ogImage;
  return /^https?:\/\//i.test(url) ? url : `https://www.panooja.com/${String(url).replace(/^\//, '')}`;
}

function buildProductOfferSchema(productPrice, productUrl, isOutOfStock) {
  const numericPrice = Number(productPrice) || 0;
  const shippingFee = numericPrice >= 799 ? 0 : 79;
  return {
    '@type': 'Offer',
    'url': productUrl,
    'priceCurrency': 'INR',
    'price': numericPrice,
    'priceValidUntil': '2027-12-31',
    'itemCondition': 'https://schema.org/NewCondition',
    'availability': isOutOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    'seller': {
      '@type': 'Organization',
      'name': 'PANOOJA'
    },
    'shippingDetails': {
      '@type': 'OfferShippingDetails',
      'shippingRate': {
        '@type': 'MonetaryAmount',
        'value': shippingFee,
        'currency': 'INR'
      },
      'shippingDestination': {
        '@type': 'DefinedRegion',
        'addressCountry': 'IN'
      },
      'deliveryTime': {
        '@type': 'ShippingDeliveryTime',
        'handlingTime': {
          '@type': 'QuantitativeValue',
          'minValue': 0,
          'maxValue': 1,
          'unitCode': 'DAY'
        },
        'transitTime': {
          '@type': 'QuantitativeValue',
          'minValue': 2,
          'maxValue': 5,
          'unitCode': 'DAY'
        }
      }
    },
    'hasMerchantReturnPolicy': {
      '@type': 'MerchantReturnPolicy',
      'applicableCountry': 'IN',
      'returnPolicyCategory': 'https://schema.org/MerchantReturnFiniteReturnWindow',
      'merchantReturnDays': 7,
      'returnMethod': 'https://schema.org/ReturnByMail',
      'returnFees': 'https://schema.org/FreeReturn',
      'description': '7-day replacement for damaged, defective or wrong items (uncut unboxing video required).'
    }
  };
}

// Keep a single semantic <h1> per view (product name in Quick View vs Hero headline on homepage)
function swapElementTag(el, newTagName) {
  if (!el || el.tagName.toLowerCase() === newTagName.toLowerCase()) return el;
  const replacement = document.createElement(newTagName);
  Array.from(el.attributes).forEach(attr => replacement.setAttribute(attr.name, attr.value));
  replacement.innerHTML = el.innerHTML;
  el.parentNode.replaceChild(replacement, el);
  return replacement;
}

function setDocumentH1Mode(isProductView) {
  const heroHeading = document.getElementById('heroHeadline');
  const qvHeading = document.getElementById('quickViewTitle');
  if (isProductView) {
    swapElementTag(heroHeading, 'h2');
    swapElementTag(qvHeading, 'h1');
  } else {
    swapElementTag(heroHeading, 'h1');
    swapElementTag(qvHeading, 'h2');
  }
}

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
  setDocumentH1Mode(false);
  setPageMetadata(DEFAULT_SEO);
  const activeSchema = document.getElementById('activeProductSchema');
  if (activeSchema) activeSchema.remove();
}

function setProductMetadata(product) {
  if (!product) return;
  const productCanonical = `https://www.panooja.com/product/${product.slug}`;
  const rawImg = (product.images && product.images.length > 0) ? product.images[0] : product.img;
  const firstImage = toAbsoluteSeoUrl(rawImg);

  setPageMetadata({
    isProduct: true,
    title: product.seoTitle || `${product.name} | Anti-Tarnish Jewellery — PANOOJA`,
    description: product.seoDescription || product.desc || DEFAULT_SEO.description,
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
  const existingServerSchema = document.getElementById('serverProductSchema');
  if (existingServerSchema) existingServerSchema.remove();
  const existing = document.getElementById('activeProductSchema');
  if (existing) existing.remove();
  if (!product) return;

  const productUrl = `https://www.panooja.com/product/${product.slug}`;
  const imageList = (product.images && product.images.length > 0 ? product.images : [product.img]).map(toAbsoluteSeoUrl);

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    'url': productUrl,
    'name': product.name,
    'sku': product.sku,
    'description': product.seoDescription || product.desc,
    'image': imageList,
    'category': product.category,
    'brand': {
      '@type': 'Brand',
      'name': 'PANOOJA'
    },
    'offers': buildProductOfferSchema(product.finalPrice, productUrl, product.isOutOfStock)
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

    // Normalize relative website-hosted paths (e.g. "products/cat-eye-1.webp" -> "/products/cat-eye-1.webp")
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
      url = `/${url.replace(/^\.\//, '')}`;
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

function getSheetField(item, ...keys) {
  if (!item) return '';
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(item, key) && item[key] !== undefined && item[key] !== null) {
      const val = String(item[key]).trim();
      if (val !== '') return val;
    }
  }
  const normalizedTargets = keys.map(k => k.toLowerCase().trim());
  for (const [k, v] of Object.entries(item)) {
    if (normalizedTargets.includes(k.toLowerCase().trim()) && v !== undefined && v !== null) {
      const val = String(v).trim();
      if (val !== '') return val;
    }
  }
  return '';
}

function normalizeCategory(cat) {
  const lower = (cat || '').toLowerCase().trim();
  if (lower.includes('earring')) return 'earrings';
  if (lower.includes('ring')) return 'rings';
  if (lower.includes('pendant') || lower.includes('necklace') || lower.includes('chain')) return 'pendants';
  if (lower.includes('bracelet') || lower.includes('kada') || lower.includes('bangle')) return 'bracelets';
  return lower.replace(/[^a-z0-9]/g, '-');
}

// Hide filter buttons and homepage category cards with 0 live products; show automatically when populated
function updateCategoryVisibility(categoryCounts) {
  const buttons = document.querySelectorAll('.category-filter-wrap .filter-btn');
  let activeWasHidden = false;

  buttons.forEach(btn => {
    const filter = btn.getAttribute('data-filter');
    if (filter === 'all') {
      btn.hidden = false;
      btn.style.display = '';
      return;
    }
    const count = categoryCounts.get(filter) || 0;
    const hasItems = count > 0;
    btn.hidden = !hasItems;
    btn.style.display = hasItems ? '' : 'none';
    if (!hasItems && btn.classList.contains('active')) {
      btn.classList.remove('active');
      activeWasHidden = true;
    }
  });

  if (activeWasHidden || !document.querySelector('.category-filter-wrap .filter-btn.active')) {
    const allBtn = document.querySelector('.category-filter-wrap .filter-btn[data-filter="all"]');
    if (allBtn) allBtn.classList.add('active');
  }

  const collectionsSection = document.getElementById('collections');
  const collectionGrid = collectionsSection ? collectionsSection.querySelector('.collection-grid') : null;
  const collectionCards = document.querySelectorAll('#collections .collection-card.category-trigger');
  let visibleCards = 0;

  collectionCards.forEach(card => {
    const target = card.getAttribute('data-filter-target');
    const count = categoryCounts.get(target) || 0;
    const hasItems = count > 0;
    card.hidden = !hasItems;
    card.style.display = hasItems ? '' : 'none';
    if (hasItems) visibleCards++;
  });

  if (collectionsSection) {
    collectionsSection.style.display = visibleCards === 0 ? 'none' : '';
  }
  if (collectionGrid) {
    collectionGrid.classList.remove('collection-grid-single', 'collection-grid-compact');
    if (visibleCards === 1) {
      collectionGrid.classList.add('collection-grid-single');
    } else if (visibleCards > 1 && visibleCards < 4) {
      collectionGrid.classList.add('collection-grid-compact');
    }
  }
}

// Use the first live product image in each category for its Shop-by-Category card
function updateCategoryCardImages(firstImageByCategory) {
  document.querySelectorAll('#collections .collection-card[data-filter-target] img.card-image').forEach(img => {
    const card = img.closest('.collection-card');
    const target = card ? card.getAttribute('data-filter-target') : '';
    const liveImg = firstImageByCategory.get(target);
    if (!liveImg) return;
    if (!img.dataset.defaultSrc) {
      img.dataset.defaultSrc = img.getAttribute('src') || '';
    }
    img.referrerPolicy = 'no-referrer';
    img.onerror = function() {
      if (this.dataset.defaultSrc && this.src !== this.dataset.defaultSrc) {
        this.src = this.dataset.defaultSrc;
      }
    };
    img.src = liveImg;
  });
}

// Render horizontal row of first 4-6 products under hero headline on mobile
function renderMobileQuickProducts(products) {
  const wrap = document.getElementById('mobileQuickProducts');
  const rail = document.getElementById('mobileQuickRail');
  if (!wrap || !rail) return;

  if (!products || products.length === 0) {
    wrap.style.display = 'none';
    rail.innerHTML = '';
    return;
  }

  const slice = products.slice(0, 6);
  rail.innerHTML = slice.map(p => `
    <a href="/product/${escapeHTML(p.slug)}" class="mobile-quick-card quick-view-trigger" data-sku="${escapeHTML(p.sku)}" data-slug="${escapeHTML(p.slug)}">
      <div class="mobile-quick-img">
        <img src="${escapeHTML(p.img)}" alt="${escapeHTML(p.imageAlt)}" loading="eager" referrerPolicy="no-referrer" onerror="if(this.src!=='${p.fallbackImg}'){this.src='${p.fallbackImg}';}" />
      </div>
      <div class="mobile-quick-meta">
        <span class="mobile-quick-name">${escapeHTML(p.name)}</span>
        <span class="mobile-quick-price">₹${p.finalPrice.toLocaleString('en-IN')}</span>
      </div>
    </a>
  `).join('');

  wrap.removeAttribute('style');
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

  const productGraph = products.map((item) => {
    const itemUrl = `https://www.panooja.com/product/${item.slug}`;
    const itemImages = (item.images && item.images.length > 0 ? item.images : [item.img]).map(toAbsoluteSeoUrl);
    return {
      '@type': 'Product',
      '@id': `${itemUrl}#product`,
      'url': itemUrl,
      'name': item.name,
      'sku': item.sku,
      'description': item.seoDescription || item.desc || 'Waterproof and anti-tarnish 316L stainless steel jewellery by PANOOJA.',
      'image': itemImages,
      'category': item.category,
      'brand': {
        '@type': 'Brand',
        'name': 'PANOOJA'
      },
      'offers': buildProductOfferSchema(item.finalPrice, itemUrl, item.isOutOfStock)
    };
  });

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
      updateCategoryVisibility(new Map());
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
    const categoryCounts = new Map();
    const firstImageByCategory = new Map();

    activeProducts.forEach((item, index) => {
      const sku = item['SKU'] || `PNJ-${index + 1}`;
      const name = (item['Product Name'] || 'PANOOJA Everyday Jewellery').trim();
      const category = item['Category'] || 'Jewellery';
      const categoryKey = normalizeCategory(category);
      categoryCounts.set(categoryKey, (categoryCounts.get(categoryKey) || 0) + 1);

      const rawShortDesc = getSheetField(item, 'Description');
      const shortDescDiffers = rawShortDesc !== '' && rawShortDesc.toLowerCase() !== name.toLowerCase();
      const cardDesc = shortDescDiffers ? rawShortDesc : '';
      const longDesc = getSheetField(item, 'Description (long)', 'Description (Long)', 'Long Description');
      const popupDesc = longDesc || cardDesc;
      const desc = popupDesc;

      const specs = [
        { label: 'Finish', value: getSheetField(item, 'Finish') },
        { label: 'Stones', value: getSheetField(item, 'Stones', 'Stone') },
        { label: 'Size', value: getSheetField(item, 'Size') },
        { label: 'Chain Length', value: getSheetField(item, 'Chain Length') },
        { label: 'Closure', value: getSheetField(item, 'Closure') },
        { label: 'Sold As', value: getSheetField(item, 'Sold As') },
        { label: 'Weight', value: getSheetField(item, 'Weight') }
      ].filter(s => s.value !== '');

      const offerTag = item['Offer Tag'] || '';
      const stockStatus = item['Stock Status (Auto)'] || 'In Stock';
      const isOutOfStock = stockStatus.toLowerCase().includes('out of stock');
      const isLowStock = stockStatus.toLowerCase().includes('low stock');

      // SEO Fields from Connected Google Sheet
      const rawSlug = (item['SEO URL Slug (Auto)'] || item['SEO URL Slug'] || item['Slug'] || '').trim().replace(/^\/product\//, '').replace(/^\//, '');
      const slug = rawSlug || slugify(name || sku);
      const seoTitle = (item['SEO Title (Auto)'] || item['SEO Title'] || '').trim() || `${name} | Anti-Tarnish Jewellery — PANOOJA`;
      const seoDescription = (item['SEO Meta Description (Auto)'] || item['SEO Meta Description'] || '').trim() || popupDesc || `${name} — Waterproof, anti-tarnish 316L stainless steel jewellery by PANOOJA.`;
      const seoKeywords = (item['SEO Keywords (Auto)'] || item['SEO Keywords'] || '').trim();
      const imageAlt = (item['Image Alt Text (Auto)'] || item['Image Alt Text'] || '').trim() || `${name} — Anti-Tarnish Waterproof Jewellery by PANOOJA`;
      const productUrl = `/product/${slug}`;

      // Parse Current Stock numeric value
      const rawCurrentStock = item['Current Stock (Auto)'] || '';
      const currentStockNum = parseInt(rawCurrentStock.replace(/[^0-9]/g, ''), 10);
      const isUrgentStock = !isOutOfStock && !isNaN(currentStockNum) && currentStockNum >= 1 && currentStockNum <= 3;

      // Parse prices (only optional MRP column triggers strike-through MRP ₹X when > finalPrice; no % OFF badge)
      const rawFinalPrice = item['Final Price (INR)'] || '0';
      const finalPriceNum = parseInt(rawFinalPrice.replace(/[^0-9]/g, ''), 10) || 0;
      const rawMRP = getSheetField(item, 'MRP');
      const mrpNum = parseInt(rawMRP.replace(/[^0-9]/g, ''), 10) || 0;

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
        cardDesc,
        popupDesc,
        specs,
        offerTag,
        stockStatus,
        isOutOfStock,
        isLowStock,
        isUrgentStock,
        currentStockNum: isNaN(currentStockNum) ? null : currentStockNum,
        finalPrice: finalPriceNum,
        mrp: mrpNum,
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
      if (!firstImageByCategory.has(categoryKey) && productObj.img) {
        firstImageByCategory.set(categoryKey, productObj.img);
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

      // Price Row (MRP strike-through only when optional MRP column > selling price; no % OFF badge)
      let priceHtml = `<span class="product-final-price">₹${finalPriceNum.toLocaleString('en-IN')}</span>`;
      if (mrpNum > finalPriceNum) {
        priceHtml += `<span class="product-mrp">MRP ₹${mrpNum.toLocaleString('en-IN')}</span>`;
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
          ${cardDesc ? `<p class="product-description">${escapeHTML(cardDesc)}</p>` : ''}
          <div class="product-price-row">
            ${priceHtml}
          </div>
          <div class="price-tax-note">Inclusive of all taxes</div>
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

    // Hide empty categories, sync category images, render mobile quick row, and apply active filter
    updateCategoryVisibility(categoryCounts);
    updateCategoryCardImages(firstImageByCategory);
    renderMobileQuickProducts(formattedProducts);
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

  // Promote product title to <h1> (demote hero headline to <h2>) and set per-product SEO tags
  setDocumentH1Mode(true);
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

  // Initialize Quick View Carousel (pass image click handler for zoom lightbox)
  if (quickViewCarouselEl && images.length > 1) {
    quickViewCarouselInstance = new ProductCarousel(quickViewCarouselEl, images, {
      isQuickView: true,
      onImageClick: () => openImageZoom(quickViewCarouselInstance ? quickViewCarouselInstance.currentIndex : 0)
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
      mrpEl.textContent = `MRP ₹${product.mrp.toLocaleString('en-IN')}`;
      mrpEl.style.display = 'inline';
    } else {
      mrpEl.style.display = 'none';
    }
  }

  if (discountEl) {
    discountEl.style.display = 'none';
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

  if (descEl) {
    if (product.popupDesc) {
      descEl.textContent = product.popupDesc;
      descEl.style.display = '';
    } else {
      descEl.textContent = '';
      descEl.style.display = 'none';
    }
  }

  const detailsListEl = document.getElementById('quickViewDetailsList');
  const detailsGridEl = document.getElementById('quickViewDetailsGrid');
  if (detailsListEl && detailsGridEl) {
    if (product.specs && product.specs.length > 0) {
      detailsGridEl.innerHTML = product.specs
        .map(s => `<div class="qv-detail-row"><dt>${escapeHTML(s.label)}</dt><dd>${escapeHTML(s.value)}</dd></div>`)
        .join('');
      detailsListEl.style.display = 'block';
    } else {
      detailsGridEl.innerHTML = '';
      detailsListEl.style.display = 'none';
    }
  }

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
  if (typeof closeImageZoom === 'function') {
    closeImageZoom();
  }
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

// =============================================================
// LIGHTWEIGHT IMAGE ZOOM LIGHTBOX (QUICK VIEW)
// =============================================================
let currentZoomIndex = 0;

function updateImageZoomFrame() {
  const zoomImg = document.getElementById('imageZoomImg');
  const zoomStage = document.getElementById('imageZoomStage');
  const prevBtn = document.getElementById('imageZoomPrev');
  const nextBtn = document.getElementById('imageZoomNext');
  if (!zoomImg || !currentQuickViewProduct) return;

  const images = (currentQuickViewProduct.images && currentQuickViewProduct.images.length > 0)
    ? currentQuickViewProduct.images
    : [currentQuickViewProduct.img];
  const safeIdx = ((currentZoomIndex % images.length) + images.length) % images.length;
  currentZoomIndex = safeIdx;

  zoomImg.src = images[safeIdx];
  zoomImg.alt = safeIdx === 0
    ? currentQuickViewProduct.imageAlt
    : `${currentQuickViewProduct.imageAlt} - Angle ${safeIdx + 1}`;
  if (zoomStage) zoomStage.classList.remove('is-zoomed');

  const multi = images.length > 1;
  if (prevBtn) prevBtn.style.display = multi ? 'flex' : 'none';
  if (nextBtn) nextBtn.style.display = multi ? 'flex' : 'none';
}

function openImageZoom(startIndex = 0) {
  const overlay = document.getElementById('imageZoomOverlay');
  if (!overlay || !currentQuickViewProduct) return;
  currentZoomIndex = Number.isInteger(startIndex) ? startIndex : 0;
  updateImageZoomFrame();
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeImageZoom() {
  const overlay = document.getElementById('imageZoomOverlay');
  const zoomStage = document.getElementById('imageZoomStage');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  if (zoomStage) zoomStage.classList.remove('is-zoomed');
}

const quickViewZoomBtn = document.getElementById('quickViewZoomBtn');
if (quickViewZoomBtn) {
  quickViewZoomBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const idx = quickViewCarouselInstance ? quickViewCarouselInstance.currentIndex : 0;
    openImageZoom(idx);
  });
}

const quickViewCarouselTapEl = document.getElementById('quickViewCarousel');
if (quickViewCarouselTapEl) {
  quickViewCarouselTapEl.addEventListener('click', (e) => {
    // When product has only 1 image, ProductCarousel is not created, so open zoom here
    if (quickViewCarouselInstance) return;
    if (e.target.closest('.carousel-arrow') || e.target.closest('.carousel-dot') || e.target.closest('.qv-zoom-trigger')) {
      return;
    }
    openImageZoom(0);
  });
}

const closeImageZoomBtn = document.getElementById('closeImageZoom');
if (closeImageZoomBtn) {
  closeImageZoomBtn.addEventListener('click', closeImageZoom);
}
const imageZoomOverlayEl = document.getElementById('imageZoomOverlay');
if (imageZoomOverlayEl) {
  imageZoomOverlayEl.addEventListener('click', (e) => {
    if (e.target === imageZoomOverlayEl || e.target.id === 'imageZoomStage') {
      closeImageZoom();
    }
  });
}
const imageZoomImgEl = document.getElementById('imageZoomImg');
const imageZoomStageEl = document.getElementById('imageZoomStage');
if (imageZoomImgEl && imageZoomStageEl) {
  imageZoomImgEl.addEventListener('click', (e) => {
    e.stopPropagation();
    imageZoomStageEl.classList.toggle('is-zoomed');
  });
}
const imageZoomPrevEl = document.getElementById('imageZoomPrev');
const imageZoomNextEl = document.getElementById('imageZoomNext');
if (imageZoomPrevEl) {
  imageZoomPrevEl.addEventListener('click', (e) => {
    e.stopPropagation();
    currentZoomIndex--;
    updateImageZoomFrame();
  });
}
if (imageZoomNextEl) {
  imageZoomNextEl.addEventListener('click', (e) => {
    e.stopPropagation();
    currentZoomIndex++;
    updateImageZoomFrame();
  });
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

function getPanoojaWhatsAppNumber() {
  return (window.PANOOJA_CONFIG && window.PANOOJA_CONFIG.WHATSAPP_NUMBER) || '917984528870';
}

// Keep any static WhatsApp links aligned with the shared PANOOJA_CONFIG number
document.querySelectorAll('a[href*="wa.me/"]').forEach((anchor) => {
  anchor.href = anchor.href.replace(/wa\.me\/\d+/i, `wa.me/${getPanoojaWhatsAppNumber()}`);
});

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
    const url = `https://wa.me/${getPanoojaWhatsAppNumber()}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  });
}

// Escape Key Closes Topmost Active Modal / Lightbox
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const zoomOverlay = document.getElementById('imageZoomOverlay');
    if (zoomOverlay && zoomOverlay.classList.contains('is-open')) {
      closeImageZoom();
      return;
    }
    if (document.body.classList.contains('quick-view-open')) {
      closeQuickView(true);
      return;
    }
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
