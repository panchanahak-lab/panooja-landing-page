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
  slug = (slug || '').trim().toLowerCase();

  const indexPath = path.join(ROOT_DIR, 'index.html');
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
  const firstImage = (product.images && product.images.length > 0) ? product.images[0] : (product.image || 'https://www.panooja.com/logo.png');
  const seoTitle = product.seoTitle || `${product.name} | Anti-Tarnish Jewellery — PANOOJA`;
  const seoDesc = product.seoDescription || product.description || 'Shop waterproof, anti-tarnish jewellery handcrafted in 316L stainless steel by PANOOJA.';
  const seoKeywords = product.seoKeywords || 'anti tarnish jewellery India, waterproof jewellery, everyday gold jewellery';

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    'url': productUrl,
    'name': product.name,
    'sku': product.sku,
    'description': seoDesc,
    'image': product.images && product.images.length > 0 ? product.images : [firstImage],
    'category': product.category,
    'brand': {
      '@type': 'Brand',
      'name': 'PANOOJA'
    },
    'material': '316L Surgical Stainless Steel, 18K Gold PVD Plating',
    'offers': {
      '@type': 'Offer',
      'url': productUrl,
      'priceCurrency': 'INR',
      'price': product.price,
      'priceValidUntil': '2027-12-31',
      'itemCondition': 'https://schema.org/NewCondition',
      'availability': product.isOutOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      'seller': {
        '@type': 'Organization',
        'name': 'PANOOJA'
      }
    }
  };

  // Replace Title
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeXml(seoTitle)}</title>`);

  // Replace Meta Description
  html = html.replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["']/i, `<meta name="description" content="${escapeXml(seoDesc)}"`);

  // Replace Meta Keywords
  html = html.replace(/<meta\s+name=["']keywords["']\s+content=["'][^"']*["']/i, `<meta name="keywords" content="${escapeXml(seoKeywords)}"`);

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
