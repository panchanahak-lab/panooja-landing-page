const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelectorAll('.nav-links a');
const header = document.querySelector('.site-header');

// Mobile menu toggle
menuToggle.addEventListener('click', () => {
  const isOpen = document.body.classList.toggle('menu-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    document.body.classList.remove('menu-open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});

// Sticky header scroll effect
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
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
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));

// Update footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Waitlist form handling
const form = document.getElementById('waitlistForm');
if (form) {
  const formMessage = document.getElementById('formMessage');
  const submitButton = document.getElementById('submitButton') || form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const formData = new FormData(form);
    const email = formData.get('email').trim();
    const name = formData.get('name').trim();
    const companyWebsite = formData.get('companyWebsite'); // Honeypot

    if (!email) {
      if (formMessage) formMessage.textContent = 'Please enter a valid email address.';
      return;
    }

    // Gather URL tracking parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    const payload = {
      email,
      name,
      companyWebsite,
      utm_source: urlParams.get('utm_source') || '',
      utm_medium: urlParams.get('utm_medium') || '',
      utm_campaign: urlParams.get('utm_campaign') || '',
      referrer: document.referrer || '',
      page_url: window.location.href
    };

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Joining...';
    }
    if (formMessage) formMessage.textContent = '';

    try {
      const response = await fetch('/api/early-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.ok) {
        if (data.status === 'existing') {
          if (formMessage) formMessage.textContent = 'You’re already on the PANOOJA early-access list.';
        } else {
          if (formMessage) formMessage.textContent = 'You’re on the list. We’ll let you know when PANOOJA launches.';
          form.reset();
        }
      } else {
        if (data.status === 'invalid') {
          if (formMessage) formMessage.textContent = 'Please enter a valid email address.';
        } else {
          if (formMessage) formMessage.textContent = 'We couldn’t save your details right now. Please try again.';
        }
      }
    } catch (error) {
      console.error('Submission error:', error);
      if (formMessage) formMessage.textContent = 'We couldn’t save your details right now. Please try again.';
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Join the Early Access List';
      }
    }
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
  default: 'shell-pearl-pendant.jpg'
};

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

async function loadLiveProducts() {
  const productGrid = document.getElementById('productGrid');
  const emptyMsg = document.getElementById('emptyCategoryMsg');
  if (!productGrid) return;

  // Render shimmer skeleton while live data loads
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
    const products = parsedRows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ? row[i].trim() : '';
      });
      return obj;
    });

    // Filter products: "Active on Website (Yes/No)" must be "Yes"
    const activeProducts = products.filter(item => {
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

    activeProducts.forEach((item, index) => {
      const sku = item['SKU'] || `PNJ-${index + 1}`;
      const name = item['Product Name'] || 'PANOOJA Fine Jewellery';
      const category = item['Category'] || 'Jewellery';
      const categoryKey = normalizeCategory(category);
      const desc = item['Description'] || '';
      const offerTag = item['Offer Tag'] || '';
      const stockStatus = item['Stock Status (Auto)'] || 'In Stock';
      const isOutOfStock = stockStatus.toLowerCase().includes('out of stock');
      const isLowStock = stockStatus.toLowerCase().includes('low stock');

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

      const card = document.createElement('div');
      card.className = `product-card reveal visible ${isOutOfStock ? 'is-out-of-stock' : ''}`;
      card.setAttribute('data-category', categoryKey);

      let badgesHtml = '';
      if (offerTag && offerTag.toLowerCase() !== 'none' && offerTag.trim() !== '') {
        badgesHtml += `<span class="product-offer-badge">${escapeHTML(offerTag)}</span>`;
      }
      if (isOutOfStock) {
        badgesHtml += `<span class="product-stock-badge out-of-stock">Out of Stock</span>`;
      } else if (isLowStock) {
        badgesHtml += `<span class="product-stock-badge low-stock">Low Stock</span>`;
      }

      let priceHtml = `<span class="product-final-price">₹${finalPriceNum.toLocaleString('en-IN')}</span>`;
      if (mrpNum > finalPriceNum) {
        priceHtml += `<span class="product-mrp">₹${mrpNum.toLocaleString('en-IN')}</span>`;
      }
      if (discount && discount !== '0%') {
        priceHtml += `<span class="product-discount-label">${escapeHTML(discount)} off</span>`;
      }

      const buttonHtml = isOutOfStock
        ? `<button class="button button-disabled add-to-cart-btn" disabled="disabled">Out of Stock</button>`
        : `<button class="button button-primary add-to-cart-btn" data-id="${escapeHTML(sku)}" data-title="${escapeHTML(name)}" data-price="${finalPriceNum}" data-img="${escapeHTML(imageUrl)}">Add to Cart</button>`;

      card.innerHTML = `
        <div class="product-img-wrap">
          ${badgesHtml}
          <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(name)}" loading="lazy" onerror="if(this.src!=='${fallbackImg}'){this.src='${fallbackImg}';}" />
        </div>
        <div class="product-info">
          <span class="product-category-tag">${escapeHTML(category)}</span>
          <h3>${escapeHTML(name)}</h3>
          ${desc ? `<p class="product-description">${escapeHTML(desc)}</p>` : ''}
          <div class="product-price-row">
            ${priceHtml}
          </div>
          ${buttonHtml}
        </div>
      `;

      productGrid.appendChild(card);
    });

    applyCategoryFilter();

  } catch (err) {
    console.error('Live product fetch error:', err);
    // Fallback display if Google Sheets is unreachable
    productGrid.innerHTML = `
      <div class="product-card reveal visible" data-category="pendants">
        <div class="product-img-wrap">
          <img src="shell-pearl-pendant.jpg" alt="Shell & Pearl Pendant" loading="lazy" />
        </div>
        <div class="product-info">
          <span class="product-category-tag">Pendants</span>
          <h3>Shell & Pearl Pendant</h3>
          <p class="product-description">Handcrafted anti-tarnish shell and pearl pendant necklace.</p>
          <div class="product-price-row">
            <span class="product-final-price">₹100</span>
          </div>
          <button class="button button-primary add-to-cart-btn" data-id="p1" data-title="Shell & Pearl Pendant" data-price="100" data-img="shell-pearl-pendant.jpg">Add to Cart</button>
        </div>
      </div>
    `;
    applyCategoryFilter();
  }
}

// Category Filter Click Listeners
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

// Logic for clicking big category cards in Collections section
const categoryTriggers = document.querySelectorAll('.category-trigger');
if (categoryTriggers.length > 0) {
  categoryTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const targetFilter = trigger.getAttribute('data-filter-target');
      const targetBtn = document.querySelector(`.filter-btn[data-filter="${targetFilter}"]`);
      if (targetBtn) {
        targetBtn.click();
        const shopSection = document.getElementById('shop');
        if (shopSection) {
          shopSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
}

// Automatically load live products from Google Sheets on page load
if (document.getElementById('productGrid')) {
  loadLiveProducts();
}
