// api/catalog-service.js - Trusted Server-Side Product Catalog & Pricing Engine
import https from 'https';

const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1yF6fF2S8x5dH3u24uH2DNt8WOl9xZ_UTLA6JNmAWbn1XUroDBjS6M-GPXlSHLLtkSaXTllKNQz-n/pub?gid=0&single=true&output=csv';
const OFFERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1yF6fF2S8x5dH3u24uH2DNt8WOl9xZ_UTLA6JNmAWbn1XUroDBjS6M-GPXlSHLLtkSaXTllKNQz-n/pub?gid=2&single=true&output=csv';

const STANDARD_SHIPPING_FEE = 79;
const FREE_SHIPPING_THRESHOLD = 799;

// In-memory catalog & offers caches with 60-second TTL
let cachedCatalog = null;
let lastCacheTime = 0;
let cachedOffers = null;
let lastOffersCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000;

/**
 * Fetch CSV text from Google Sheets, following redirects safely.
 */
function fetchCsvText(url, redirectDepth = 0) {
  return new Promise((resolve, reject) => {
    if (redirectDepth > 5) {
      return reject(new Error('Too many redirects while fetching CSV'));
    }
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        return fetchCsvText(response.headers.location, redirectDepth + 1).then(resolve, reject);
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`Failed to fetch CSV: HTTP ${response.statusCode}`));
      }
      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => resolve(data));
    });
    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('CSV fetch timeout'));
    });
  });
}

// Safe CSV parser handling quotes, commas, escaped quotes and multi-line fields
export function parseCSV(text) {
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
      if (row.length > 0 || field.length > 0) {
        rows.push(row);
      }
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function normalizeCatalogImageUrl(raw) {
  if (typeof raw !== 'string') return '';
  let url = raw.trim();
  if (!url || url.toLowerCase() === 'none' || url.toLowerCase() === 'null') return '';
  if (url.includes('/drive/folders/') || url.includes('/folders/') || url.includes('SAMPLE_FILE_ID')) {
    return '';
  }
  const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1] && !url.includes('lh3.googleusercontent.com')) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
    return `/${url.replace(/^\.\//, '')}`;
  }
  return url;
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Fetch live catalog from Google Sheets or memory cache
export async function fetchCatalog(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedCatalog && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedCatalog;
  }

  try {
    const csvData = await fetchCsvText(GOOGLE_SHEETS_CSV_URL);

    const rows = parseCSV(csvData);
    if (!rows || rows.length < 2) {
      throw new Error('Empty or invalid CSV catalog data');
    }

    const headers = rows[0].map(h => (h || '').trim());
    const catalogMap = new Map();

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < 3) continue;

      const item = {};
      headers.forEach((h, idx) => {
        item[h] = (row[idx] || '').trim();
      });

      const sku = (item['SKU'] || '').toUpperCase();
      if (!sku) continue;

      const rawPrice = item['Final Price (INR)'] || item['Price'] || '0';
      const cleanPrice = parseInt(String(rawPrice).replace(/[^0-9]/g, ''), 10) || 0;

      const rawMrp = item['MRP (INR)'] || item['MRP'] || '0';
      const cleanMrp = parseInt(String(rawMrp).replace(/[^0-9]/g, ''), 10) || cleanPrice;

      const activeVal = (item['Active on Website (Yes/No)'] || item['Active on Website'] || '').trim().toLowerCase();
      const isActive = activeVal === 'yes';

      const stockStatus = (item['Stock Status (Auto)'] || 'In Stock').trim();
      const isOutOfStock = stockStatus.toLowerCase().includes('out of stock');

      const currentStock = parseInt(String(item['Current Stock (Auto)'] || '10').replace(/[^0-9]/g, ''), 10) || 0;

      const images = Array.from(new Set([
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
      ].map(normalizeCatalogImageUrl).filter(Boolean)));

      const rawSlug = (item['SEO URL Slug (Auto)'] || item['SEO URL Slug'] || '').trim().replace(/^\/product\//, '').replace(/^\//, '');
      const productName = item['Product Name'] || sku;
      const slug = rawSlug || slugify(productName || sku);
      const seoTitle = (item['SEO Title (Auto)'] || item['SEO Title'] || '').trim() || `${productName} | Anti-Tarnish Jewellery — PANOOJA`;
      const seoDescription = (item['SEO Meta Description (Auto)'] || item['SEO Meta Description'] || '').trim() || item['Description'] || 'Modern waterproof and anti-tarnish everyday jewellery by PANOOJA.';
      const seoKeywords = (item['SEO Keywords (Auto)'] || item['SEO Keywords'] || '').trim();
      const imageAlt = (item['Image Alt Text (Auto)'] || item['Image Alt Text'] || '').trim() || `${productName} — Anti-Tarnish Waterproof Jewellery by PANOOJA`;

      catalogMap.set(sku, {
        sku,
        slug,
        name: productName,
        category: item['Category'] || 'Jewellery',
        description: item['Description'] || '',
        price: cleanPrice,
        mrp: cleanMrp,
        isActive,
        stockStatus,
        isOutOfStock,
        currentStock,
        offerTag: item['Offer Tag'] || '',
        image: images[0] || item['Direct Image URL (Auto)'] || '',
        images,
        seoTitle,
        seoDescription,
        seoKeywords,
        imageAlt,
        url: `https://www.panooja.com/product/${slug}`
      });
    }

    if (catalogMap.size > 0) {
      cachedCatalog = catalogMap;
      lastCacheTime = now;
      return catalogMap;
    }
  } catch (err) {
    console.error('Error fetching live catalog from Google Sheets:', err.message);
    if (cachedCatalog) {
      console.warn('Returning stale cached catalog due to fetch error');
      return cachedCatalog;
    }
  }

  // Google Sheet CSV is the single and only source of products across the website.
  // If unavailable and no cache exists, return an empty map so no static/fallback products are ever used.
  return new Map();
}

// Find an active product by its SEO slug or SKU
export async function getProductBySlug(slugOrSku) {
  if (!slugOrSku) return null;
  const normalized = String(slugOrSku).toLowerCase().trim().replace(/^\/product\//, '').replace(/^\//, '');
  const catalog = await fetchCatalog();
  
  for (const product of catalog.values()) {
    if (product.slug.toLowerCase() === normalized || product.sku.toLowerCase() === normalized) {
      return product;
    }
  }
  return null;
}

// Server-side calculation of order total, validating prices, stock, promo codes, and shipping
export async function calculateOrderTotal(items, promoCode = '') {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'Shopping bag is empty. Please add items to check out.' };
  }

  const catalog = await fetchCatalog();
  let subtotal = 0;
  const verifiedItems = [];

  for (const item of items) {
    const sku = (item.sku || item.id || '').toUpperCase().trim();
    const qty = parseInt(item.quantity || 1, 10);

    if (!sku) {
      return { ok: false, error: 'Invalid product item in cart.' };
    }
    if (isNaN(qty) || qty <= 0 || qty > 20) {
      return { ok: false, error: `Invalid quantity for item ${sku}. Quantity must be between 1 and 20.` };
    }

    const catalogItem = catalog.get(sku);
    if (!catalogItem) {
      return { ok: false, error: `Product SKU ${sku} is not recognized or no longer available in our catalogue.` };
    }

    if (!catalogItem.isActive) {
      return { ok: false, error: `Item "${catalogItem.name}" is currently inactive and cannot be purchased.` };
    }

    if (catalogItem.isOutOfStock) {
      return { ok: false, error: `Item "${catalogItem.name}" is currently out of stock.` };
    }

    if (catalogItem.price < 1) {
      return { ok: false, error: `Invalid pricing for item "${catalogItem.name}".` };
    }

    const itemTotal = catalogItem.price * qty;
    subtotal += itemTotal;

    verifiedItems.push({
      sku: catalogItem.sku,
      name: catalogItem.name,
      category: catalogItem.category,
      unitPrice: catalogItem.price,
      quantity: qty,
      itemTotal
    });
  }

  // Validate Promo Code Server-Side against Live Google Sheet Offers
  let discount = 0;
  const normalizedPromo = (promoCode || '').toUpperCase().trim();
  let validPromoApplied = '';
  let isFreeShippingPromo = false;

  if (normalizedPromo) {
    const offersMap = await fetchOffers();
    const offer = offersMap.get(normalizedPromo);

    if (!offer) {
      return { ok: false, error: 'This coupon code is invalid or expired.' };
    }

    const evalResult = evaluateCouponOffer(offer, subtotal, verifiedItems);
    if (!evalResult.ok) {
      return { ok: false, error: evalResult.error };
    }

    discount = evalResult.discount;
    isFreeShippingPromo = evalResult.isFreeShip;
    validPromoApplied = evalResult.label;
  }

  // Calculate Shipping
  const qualifiesForFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD || isFreeShippingPromo;
  const shippingFee = (subtotal === 0 || qualifiesForFreeShipping) ? 0 : STANDARD_SHIPPING_FEE;

  // Calculate Payable Amount in INR (Rupees)
  const grandTotal = Math.max(0, subtotal - discount + shippingFee);
  const amountInPaise = Math.round(grandTotal * 100);

  if (amountInPaise < 100) {
    return { ok: false, error: 'Payable amount must be at least ₹1 (100 paise).' };
  }

  return {
    ok: true,
    subtotal,
    discount,
    promoCode: validPromoApplied,
    shippingFee,
    grandTotal,
    amountInPaise,
    currency: 'INR',
    items: verifiedItems
  };
}

function normalizeCategoryGroup(cat) {
  const c = String(cat || '').trim().toLowerCase();
  if (!c || c === 'all' || c === 'all products') return 'all';
  if (c.includes('earring')) return 'earrings';
  if (c.includes('ring')) return 'rings';
  if (c.includes('pendant') || c.includes('chain') || c.includes('necklace')) return 'pendants';
  if (c.includes('kada') || c.includes('bracelet') || c.includes('bangle')) return 'bracelets';
  return c;
}

function doesCategoryMatch(itemCategory, appliesTo) {
  const parts = String(appliesTo || '').split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return true;
  const rawItem = String(itemCategory || '').trim().toLowerCase();
  const itemGroup = normalizeCategoryGroup(itemCategory);
  return parts.some(part => {
    const partGroup = normalizeCategoryGroup(part);
    if (partGroup === 'all') return true;
    return rawItem === part.toLowerCase() || itemGroup === partGroup;
  });
}

/**
 * Parse live offers from Offers CSV text. Only rows with Live Status === 'Live' (case-insensitive) are accepted.
 */
export function parseOffersFromCSV(csvData) {
  const rows = parseCSV(csvData);
  const offersMap = new Map();
  if (!rows || rows.length < 2) return offersMap;

  const headers = rows[0].map(h => (h || '').trim());
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;

    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (row[idx] || '').trim();
    });

    const code = (obj['Offer Code'] || '').trim().toUpperCase();
    if (!code || code === 'FREESHIP') continue;

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
    const rawShowOnWebsite = (obj['Show on Website (Yes/No)'] || obj['Show on Website'] || '').trim().toLowerCase();
    const showOnWebsite = rawShowOnWebsite === 'yes';

    offersMap.set(code, {
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

  return offersMap;
}

/**
 * Fetch live offers from Google Sheets Offers tab (gid=2) with 60-second memory cache.
 */
export async function fetchOffers(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedOffers && (now - lastOffersCacheTime < CACHE_TTL_MS)) {
    return cachedOffers;
  }

  try {
    const csvData = await fetchCsvText(OFFERS_CSV_URL);
    const offersMap = parseOffersFromCSV(csvData);
    cachedOffers = offersMap;
    lastOffersCacheTime = now;
    return offersMap;
  } catch (err) {
    console.error('Error fetching live offers from Google Sheets:', err.message);
    if (cachedOffers) {
      console.warn('Returning stale cached offers due to fetch error');
      return cachedOffers;
    }
    return new Map();
  }
}

/**
 * Return only public live offers where both Live Status is Live and Show on Website (Yes/No) is Yes.
 */
export async function getPublicOffers(forceRefresh = false) {
  const offersMap = await fetchOffers(forceRefresh);
  return Array.from(offersMap.values()).filter(o => o.liveStatus === 'Live' && o.showOnWebsite === true);
}

/**
 * Evaluate a parsed offer against cart subtotal and line items.
 */
export function evaluateCouponOffer(offer, subtotal, items = []) {
  if (!offer) {
    return { ok: false, discount: 0, isFreeShip: false, error: 'This coupon code is invalid or expired.' };
  }

  if (offer.minOrderValue > 0 && subtotal < offer.minOrderValue) {
    const shortfall = offer.minOrderValue - subtotal;
    return {
      ok: false,
      discount: 0,
      isFreeShip: false,
      error: `Add ₹${shortfall.toLocaleString('en-IN')} more to use ${offer.code}`
    };
  }

  const appliesToAll = normalizeCategoryGroup(offer.appliesTo) === 'all';
  let eligibleSubtotal = subtotal;

  if (!appliesToAll) {
    eligibleSubtotal = items.reduce((sum, item) => {
      if (doesCategoryMatch(item.category, offer.appliesTo)) {
        const lineTotal = typeof item.itemTotal === 'number'
          ? item.itemTotal
          : ((Number(item.price) || Number(item.unitPrice) || 0) * (Number(item.quantity) || 1));
        return sum + lineTotal;
      }
      return sum;
    }, 0);

    if (eligibleSubtotal <= 0) {
      return {
        ok: false,
        discount: 0,
        isFreeShip: false,
        error: `${offer.code} applies only to ${offer.appliesTo}. Add a matching item to use it.`
      };
    }
  }

  let discount = 0;
  let isFreeShip = false;
  let label = offer.code;

  if (offer.discountType === 'percentage') {
    discount = Math.min(eligibleSubtotal, Math.round(eligibleSubtotal * (offer.discountValue / 100)));
    label = `${offer.code} (${offer.discountValue}% OFF)`;
  } else if (offer.discountType === 'free_shipping') {
    isFreeShip = true;
    label = `${offer.code} (FREE SHIPPING)`;
  } else {
    discount = Math.min(eligibleSubtotal, Math.round(offer.discountValue));
    label = `${offer.code} (₹${Math.round(offer.discountValue)} OFF)`;
  }

  return {
    ok: true,
    discount,
    isFreeShip,
    label
  };
}

export const getCatalog = fetchCatalog;
