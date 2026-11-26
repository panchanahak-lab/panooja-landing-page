// api/sitemap.js - Dynamic XML Sitemap synced with live Google Sheets Catalog
import { getCatalog } from './catalog-service.js';

function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default async function handler(req, res) {
  const today = new Date().toISOString().split('T')[0];
  const baseUrl = 'https://www.panooja.com';

  let activeProducts = [];
  try {
    const catalog = await getCatalog();
    activeProducts = Array.from(catalog.values()).filter(p => p.isActive);
  } catch (err) {
    console.error('Sitemap catalog fetch error:', err);
  }

  const staticPages = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/shipping', changefreq: 'monthly', priority: '0.6' },
    { path: '/returns', changefreq: 'monthly', priority: '0.6' },
    { path: '/privacy', changefreq: 'monthly', priority: '0.6' },
    { path: '/terms', changefreq: 'monthly', priority: '0.6' },
    { path: '/contact', changefreq: 'monthly', priority: '0.6' }
  ];

  const urls = [];

  staticPages.forEach((p) => {
    urls.push(`  <url>
    <loc>${baseUrl}${p.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`);
  });

  activeProducts.forEach((product) => {
    const slug = encodeURIComponent(product.slug || '');
    if (!slug) return;
    urls.push(`  <url>
    <loc>${baseUrl}/product/${escapeXml(slug)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`);
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  if (typeof res.status === 'function') res.status(200);
  else res.statusCode = 200;
  return res.end(xml);
}
