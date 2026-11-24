import test from 'node:test';
import assert from 'node:assert/strict';
import { getProductBySlug, getCatalog } from '../api/catalog-service.js';

test('Product SEO - getProductBySlug returns product with SEO metadata', async () => {
  const catalog = await getCatalog();
  const firstProduct = Array.from(catalog.values())[0];
  assert.ok(firstProduct, 'At least one product should exist in catalog');
  assert.ok(firstProduct.slug, 'Product must have a slug');
  assert.ok(firstProduct.seoTitle, 'Product must have an SEO Title');
  assert.ok(firstProduct.seoDescription, 'Product must have an SEO Meta Description');
  assert.ok(firstProduct.imageAlt, 'Product must have Image Alt Text');

  const fetched = await getProductBySlug(firstProduct.slug);
  assert.ok(fetched, 'getProductBySlug should find product by slug');
  assert.equal(fetched.sku, firstProduct.sku);
  assert.equal(fetched.name, firstProduct.name);
  assert.equal(fetched.slug, firstProduct.slug);
});

test('Product SEO - server renders unique SEO tags and Open Graph tags for /product/:slug', async () => {
  const catalog = await getCatalog();
  const firstProduct = Array.from(catalog.values())[0];

  const res = await fetch(`http://localhost:3000/product/${firstProduct.slug}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');

  const html = await res.text();

  // Verify unique per-product title
  assert.ok(html.includes(`<title>${firstProduct.seoTitle}</title>`), 'HTML must include unique SEO Title');

  // Verify unique per-product description
  const expectedDesc = firstProduct.seoDescription.replace(/&/g, '&amp;');
  assert.ok(html.includes(expectedDesc), 'HTML must include unique Meta Description');

  // Verify unique canonical URL
  assert.ok(html.includes(`rel="canonical" href="https://www.panooja.com/product/${firstProduct.slug}"`), 'HTML must include canonical link to unique product URL');

  // Verify Open Graph tags
  assert.ok(html.includes(`property="og:title" content="${firstProduct.seoTitle}"`), 'HTML must include og:title');
  assert.ok(html.includes(expectedDesc), 'HTML must include og:description');
  assert.ok(html.includes(`property="og:url" content="https://www.panooja.com/product/${firstProduct.slug}"`), 'HTML must include og:url');
  assert.ok(html.includes('property="og:type" content="product"'), 'HTML must set og:type to product');

  // Verify Individual Product Schema JSON-LD
  assert.ok(html.includes('id="serverProductSchema"'), 'HTML must include individual Product Schema script');
  assert.ok(html.includes('"@type": "Product"'), 'Schema must declare @type Product');
  assert.ok(html.includes(`"sku": "${firstProduct.sku}"`), 'Schema must include product SKU');
  assert.ok(html.includes(`"price": ${firstProduct.price}`), 'Schema must include INR price');
});

test('Product SEO - handles unknown product slugs gracefully', async () => {
  const res = await fetch('http://localhost:3000/product/unknown-slug-xyz-999');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('PANOOJA'), 'Should fallback to default PANOOJA storefront');
});
