// api/product-seo.js - Server-Side SEO & Open Graph Metadata Injector for /product/:slug
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getProductBySlug } from './catalog-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default async function handler(req, res) {
  // Extract slug from query or URL pathname
  let slug = '';
  if (req.query && req.query.slug) {
    slug = req.query.slug;
  } else {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    slug = urlObj.searchParams.get('slug') || '';
    if (!slug) {
      const match = urlObj.pathname.match(/\/product\/([^/?#]+)/);
      if (match) slug = match[1];
    }
  }
  slug = decodeURIComponent(slug || '').trim().toLowerCase();

  let indexPath = path.join(ROOT_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    indexPath = path.join(process.cwd(), 'index.html');
  }
  let html = '';
  try {
    html = fs.readFileSync(indexPath, 'utf-8');
  } catch (err) {
    console.error('Error reading index.html for product SEO:', err);
    res.statusCode = 500;
    return res.end('500 Server Error: index.html not found');
  }

  const product = await getProductBySlug(slug);

  // If no product matches slug, serve clean index.html shell
  if (!product) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (typeof res.status === 'function') res.status(200);
    else res.statusCode = 200;
    return res.end(html);
  }

  const productUrl = `https://www.panooja.com/product/${product.slug}`;
  const toAbsoluteImgUrl = (u) => {
    if (!u) return 'https://www.panooja.com/logo.png';
    return /^https?:\/\//i.test(u) ? u : `https://www.panooja.com/${u.replace(/^\//, '')}`;
  };
  const absoluteImages = (product.images && product.images.length > 0)
    ? product.images.map(toAbsoluteImgUrl)
    : [toAbsoluteImgUrl(product.image)];
  const firstImage = absoluteImages[0] || 'https://www.panooja.com/og-image.jpg';
  const seoTitle = product.seoTitle || `${product.name} | Anti-Tarnish Jewellery — PANOOJA`;
  const seoDesc = product.seoDescription || product.description || 'Shop waterproof, anti-tarnish everyday jewellery made with 316L stainless steel by PANOOJA.';
  const numericPrice = Number(product.price) || 0;
  const shippingFee = numericPrice >= 799 ? 0 : 79;

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    'url': productUrl,
    'name': product.name,
    'sku': product.sku,
    'description': seoDesc,
    'image': absoluteImages,
    'category': product.category,
    'brand': {
      '@type': 'Brand',
      'name': 'PANOOJA'
    },
    'offers': {
      '@type': 'Offer',
      'url': productUrl,
      'priceCurrency': 'INR',
      'price': numericPrice,
      'priceValidUntil': '2027-12-31',
      'itemCondition': 'https://schema.org/NewCondition',
      'availability': product.isOutOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
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
    }
  };

  // Replace Title
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeXml(seoTitle)}</title>`);

  // Replace Meta Description
  html = html.replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["']/i, `<meta name="description" content="${escapeXml(seoDesc)}"`);

  // Ensure product page has its own <h1> (product name) & visible price matching structured data
  html = html.replace(/<h1\s+id=["']heroHeadline["'][^>]*>([\s\S]*?)<\/h1>/i, '<h2 id="heroHeadline">$1</h2>');
  html = html.replace(/<h2\s+id=["']quickViewTitle["']\s+class=["']quick-view-title["'][^>]*>[\s\S]*?<\/h2>/i, `<h1 id="quickViewTitle" class="quick-view-title">${escapeXml(product.name)}</h1>`);
  html = html.replace(/<span\s+class=["']product-final-price["']\s+id=["']quickViewPrice["'][^>]*>[\s\S]*?<\/span>/i, `<span class="product-final-price" id="quickViewPrice">₹${numericPrice.toLocaleString('en-IN')}</span>`);

  // Replace Canonical Link
  html = html.replace(/<link\s+rel=["']canonical["']\s+href=["'][^"']*["']/i, `<link rel="canonical" href="${escapeXml(productUrl)}"`);

  // Replace Open Graph Tags
  html = html.replace(/<meta\s+property=["']og:title["']\s+content=["'][^"']*["']/i, `<meta property="og:title" content="${escapeXml(seoTitle)}"`);
  html = html.replace(/<meta\s+property=["']og:description["']\s+content=["'][^"']*["']/i, `<meta property="og:description" content="${escapeXml(seoDesc)}"`);
  html = html.replace(/<meta\s+property=["']og:image["']\s+content=["'][^"']*["']/i, `<meta property="og:image" content="${escapeXml(firstImage)}"`);
  html = html.replace(/<meta\s+property=["']og:url["']\s+content=["'][^"']*["']/i, `<meta property="og:url" content="${escapeXml(productUrl)}"`);
  html = html.replace(/<meta\s+property=["']og:type["']\s+content=["'][^"']*["']/i, `<meta property="og:type" content="product"`);

  // Replace Twitter Cards
  html = html.replace(/<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']/i, `<meta name="twitter:title" content="${escapeXml(seoTitle)}"`);
  html = html.replace(/<meta\s+name=["']twitter:description["']\s+content=["'][^"']*["']/i, `<meta name="twitter:description" content="${escapeXml(seoDesc)}"`);
  html = html.replace(/<meta\s+name=["']twitter:image["']\s+content=["'][^"']*["']/i, `<meta name="twitter:image" content="${escapeXml(firstImage)}"`);

  // Inject individual Product Schema into <head>
  const schemaScript = `\n  <!-- Server-Rendered Individual Product Schema -->\n  <script type="application/ld+json" id="serverProductSchema">\n  ${JSON.stringify(productSchema, null, 2)}\n  </script>`;
  html = html.replace('</head>', `${schemaScript}\n</head>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  if (typeof res.status === 'function') res.status(200);
  else res.statusCode = 200;

  if (typeof res.send === 'function') {
    return res.send(html);
  }
  return res.end(html);
}
