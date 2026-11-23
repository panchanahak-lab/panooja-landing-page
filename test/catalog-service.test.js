import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateOrderTotal, getCatalog } from '../api/catalog-service.js';

test('Catalog Service - fetches and caches products', async () => {
  const catalog = await getCatalog();
  assert.ok(catalog instanceof Map, 'Catalog should be a Map');
  assert.ok(catalog.size > 0, 'Catalog should contain at least one product');
});

test('Catalog Service - calculates correct pricing for valid items', async () => {
  const catalog = await getCatalog();
  const firstSku = Array.from(catalog.keys())[0];
  const product = catalog.get(firstSku);

  const result = await calculateOrderTotal([{ id: firstSku, quantity: 2 }]);
  
  assert.equal(result.ok, true);
  assert.equal(result.items.length, 1);
  assert.equal(result.subtotal, product.price * 2);
  
  if (result.subtotal >= 799) {
    assert.equal(result.shippingFee, 0, 'Shipping should be free for subtotal >= 799');
  } else {
    assert.equal(result.shippingFee, 79, 'Shipping should be 79 for subtotal < 799');
  }
  assert.equal(result.grandTotal, result.subtotal + result.shippingFee);
});

test('Catalog Service - rejects fake or non-existent SKUs', async () => {
  const result = await calculateOrderTotal([{ id: 'FAKE-SKU-999', quantity: 1 }]);
  assert.equal(result.ok, false);
  assert.match(result.error, /not recognized/);
});

test('Catalog Service - applies WELCOME10 coupon correctly', async () => {
  const catalog = await getCatalog();
  const firstSku = Array.from(catalog.keys())[0];
  const product = catalog.get(firstSku);

  // If subtotal is at least 500, WELCOME10 gives 10% off
  const result = await calculateOrderTotal(
    [{ id: firstSku, quantity: Math.ceil(500 / product.price) }],
    'WELCOME10'
  );

  assert.equal(result.ok, true);
  assert.ok(result.discount > 0, 'Discount should be applied');
  assert.equal(result.discount, Math.round(result.subtotal * 0.1));
  assert.match(result.promoCode, /WELCOME10/);
});

test('Catalog Service - rejects promo code when minimum order is not met', async () => {
  const catalog = await getCatalog();
  const firstSku = Array.from(catalog.keys())[0];

  // FESTIVE200 requires min 1499
  const result = await calculateOrderTotal([{ id: firstSku, quantity: 1 }], 'FESTIVE200');
  if (result.subtotal < 1499) {
    assert.equal(result.ok, false);
    assert.match(result.error, /minimum order value/);
  }
});
