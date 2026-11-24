// api/catalog-service.js - Trusted Server-Side Product Catalog & Pricing Engine
import https from 'https';

const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1yF6fF2S8x5dH3u24uH2DNt8WOl9xZ_UTLA6JNmAWbn1XUroDBjS6M-GPXlSHLLtkSaXTllKNQz-n/pub?gid=0&single=true&output=csv';

const STANDARD_SHIPPING_FEE = 79;
const FREE_SHIPPING_THRESHOLD = 799;

// In-memory catalog cache with 60-second TTL
let cachedCatalog = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000;

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
    const csvData = await new Promise((resolve, reject) => {
      const request = https.get(GOOGLE_SHEETS_CSV_URL, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          // Follow redirect
          https.get(response.headers.location, (redirectRes) => {
            let data = '';
            redirectRes.on('data', chunk => data += chunk);
            redirectRes.on('end', () => resolve(data));
          }).on('error', reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to fetch catalog: HTTP ${response.statusCode}`));
          return;
        }

        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      });

      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Catalog fetch timeout'));
      });
    });

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

      const images = [
        item['Direct Image URL (Auto)'],
        item['Direct Image URL 2 (Auto)'],
        item['Direct Image URL 3 (Auto)'],
        item['Direct Image URL 4 (Auto)']
      ].filter(url => typeof url === 'string' && url.trim().length > 0);

      const rawSlug = (item['SEO URL Slug (Auto)'] || item['SEO URL Slug'] || '').trim().replace(/^\/product\//, '').replace(/^\//, '');
      const productName = item['Product Name'] || sku;
      const slug = rawSlug || slugify(productName || sku);
      const seoTitle = (item['SEO Title (Auto)'] || item['SEO Title'] || '').trim() || `${productName} | Anti-Tarnish Jewellery — PANOOJA`;
      const seoDescription = (item['SEO Meta Description (Auto)'] || item['SEO Meta Description'] || '').trim() || item['Description'] || 'Modern waterproof and anti-tarnish everyday luxury jewellery by PANOOJA.';
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

  // Validate Promo Code Server-Side
  let discount = 0;
  let normalizedPromo = (promoCode || '').toUpperCase().trim();
  let validPromoApplied = '';
  let isFreeShippingPromo = false;

  if (normalizedPromo) {
    if (normalizedPromo === 'WELCOME10') {
      if (subtotal >= 500) {
        discount = Math.round(subtotal * 0.10);
        validPromoApplied = 'WELCOME10 (10% OFF)';
      } else {
        return { ok: false, error: 'Promo code WELCOME10 requires a minimum order value of ₹500.' };
      }
    } else if (normalizedPromo === 'FESTIVE200') {
      if (subtotal >= 1499) {
        discount = 200;
        validPromoApplied = 'FESTIVE200 (₹200 OFF)';
      } else {
        return { ok: false, error: 'Promo code FESTIVE200 requires a minimum order value of ₹1,499.' };
      }
    } else if (normalizedPromo === 'FREESHIP') {
      if (subtotal >= 799) {
        isFreeShippingPromo = true;
        validPromoApplied = 'FREESHIP (FREE SHIPPING)';
      } else {
        return { ok: false, error: 'Promo code FREESHIP requires a minimum order value of ₹799.' };
      }
    } else {
      return { ok: false, error: `Promo code "${normalizedPromo}" is invalid or expired.` };
    }
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

export const getCatalog = fetchCatalog;
