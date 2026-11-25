import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOffersFromCSV,
  evaluateCouponOffer,
  fetchOffers,
  getPublicOffers,
  calculateOrderTotal,
  getCatalog
} from '../api/catalog-service.js';

const SAMPLE_OFFERS_CSV = [
  'Offer Code,Banner / Offer Title,Discount Type,Discount Value,Min Order Value (INR),Applies To,Start Date,End Date,Active,Live Status,Show on Website (Yes/No)',
  'WELCOME10,Flat 10% Off First Order,Percentage,10,₹500,All Products,2026-11-01,2026-12-31,TRUE,Live,Yes',
  '  earring25 ,25% Off Earrings,Percentage,25,₹400,Earrings,2026-11-01,2026-12-31,TRUE,  live , yes ',
  'FESTIVE200,Flat Rs. 200 Off Above Rs. 1499,Flat INR,200,"₹1,499",All Products,2026-11-01,2026-12-31,TRUE,Live,Yes',
  'FREESHIP,Free Shipping on Orders Above Rs. 799,Free Shipping,0,₹799,All Products,2026-11-01,2026-12-31,TRUE,Live,Yes',
  'WHATSAPP15,WhatsApp Secret 15% Off,Percentage,15,₹500,All Products,2026-11-01,2026-12-31,TRUE,Live,No',
  'PAUSED50,Paused Festive Offer,Flat INR,50,₹300,All Products,2026-11-01,2026-12-31,FALSE,Paused,Yes',
  'EXPIRED10,Expired Offer,Percentage,10,₹200,All Products,2025-01-01,2025-02-01,FALSE,Expired,No'
].join('\n');

test('Offers CSV Parser - distinguishes public offers vs hidden WhatsApp-only live coupons', () => {
  const offers = parseOffersFromCSV(SAMPLE_OFFERS_CSV);

  assert.equal(offers.has('WELCOME10'), true);
  assert.equal(offers.has('EARRING25'), true);
  assert.equal(offers.has('FESTIVE200'), true);
  assert.equal(offers.has('FREESHIP'), true);
  assert.equal(offers.has('WHATSAPP15'), true, 'Hidden WhatsApp-only live coupon must still validate when entered manually');

  assert.equal(offers.get('WELCOME10').showOnWebsite, true);
  assert.equal(offers.get('EARRING25').showOnWebsite, true);
  assert.equal(offers.get('WHATSAPP15').showOnWebsite, false, 'Show on Website = No must set showOnWebsite=false');

  // Public display list must exclude Show on Website = No and non-Live coupons
  const publicCodes = Array.from(offers.values())
    .filter(o => o.liveStatus === 'Live' && o.showOnWebsite)
    .map(o => o.code);
  assert.deepEqual(publicCodes, ['WELCOME10', 'EARRING25', 'FESTIVE200', 'FREESHIP']);
  assert.equal(publicCodes.includes('WHATSAPP15'), false);
  assert.equal(publicCodes.includes('PAUSED50'), false);

  assert.equal(offers.has('PAUSED50'), false, 'Paused coupon must not be accepted even if Show on Website is Yes');
  assert.equal(offers.has('EXPIRED10'), false, 'Expired coupon must not be accepted');

  const festive = offers.get('FESTIVE200');
  assert.equal(festive.discountType, 'flat_inr');
  assert.equal(festive.discountValue, 200);
  assert.equal(festive.minOrderValue, 1499);
});

test('Coupon Evaluator - checks Min Order Value shortfall clearly', () => {
  const offers = parseOffersFromCSV(SAMPLE_OFFERS_CSV);
  const festive = offers.get('FESTIVE200');

  const res = evaluateCouponOffer(festive, 1299, [{ category: 'Necklaces', itemTotal: 1299 }]);
  assert.equal(res.ok, false);
  assert.match(res.error, /Add ₹200 more to use FESTIVE200/);
});

test('Coupon Evaluator - applies category-specific discount only to matching items', () => {
  const offers = parseOffersFromCSV(SAMPLE_OFFERS_CSV);
  const earringOffer = offers.get('EARRING25');

  const mixedCart = [
    { category: 'Necklaces', itemTotal: 1000 },
    { category: 'Earrings', itemTotal: 400 }
  ];

  // 25% off only on Earrings (₹400) => ₹100, NOT on ₹1,400 total!
  const res = evaluateCouponOffer(earringOffer, 1400, mixedCart);
  assert.equal(res.ok, true);
  assert.equal(res.discount, 100);

  // If cart has no matching Earrings items, reject clearly
  const nonMatchingCart = [{ category: 'Rings', itemTotal: 800 }];
  const resFail = evaluateCouponOffer(earringOffer, 800, nonMatchingCart);
  assert.equal(resFail.ok, false);
  assert.match(resFail.error, /Earrings/);
});

test('Coupon Evaluator - validates hidden Show on Website = No coupon when Live Status is Live', () => {
  const offers = parseOffersFromCSV(SAMPLE_OFFERS_CSV);
  const hiddenCoupon = offers.get('WHATSAPP15');

  const res = evaluateCouponOffer(hiddenCoupon, 1000, [{ category: 'Necklaces', itemTotal: 1000 }]);
  assert.equal(res.ok, true);
  assert.equal(res.discount, 150);

  const shortfall = evaluateCouponOffer(hiddenCoupon, 400, [{ category: 'Necklaces', itemTotal: 400 }]);
  assert.equal(shortfall.ok, false);
  assert.match(shortfall.error, /Add ₹100 more to use WHATSAPP15/);
});

test('Coupon Evaluator - supports Percentage, Flat INR, and Free Shipping', () => {
  const offers = parseOffersFromCSV(SAMPLE_OFFERS_CSV);

  const pct = evaluateCouponOffer(offers.get('WELCOME10'), 539, [{ category: 'Necklaces', itemTotal: 539 }]);
  assert.equal(pct.ok, true);
  assert.equal(pct.discount, 54);

  const flat = evaluateCouponOffer(offers.get('FESTIVE200'), 1600, [{ category: 'Necklaces', itemTotal: 1600 }]);
  assert.equal(flat.ok, true);
  assert.equal(flat.discount, 200);

  const ship = evaluateCouponOffer(offers.get('FREESHIP'), 799, [{ category: 'Necklaces', itemTotal: 799 }]);
  assert.equal(ship.ok, true);
  assert.equal(ship.isFreeShip, true);
  assert.equal(ship.discount, 0);
});

test('Live Offers Integration - fetches live Google Sheet Offers CSV and filters public offers', async () => {
  const offers = await fetchOffers(true);
  assert.ok(offers instanceof Map);
  assert.ok(offers.size > 0, 'Live Offers sheet should return active offers');
  assert.ok(offers.has('WELCOME10'), 'WELCOME10 should be live in the connected Google Sheet');

  const publicOffers = await getPublicOffers();
  assert.ok(Array.isArray(publicOffers));
  assert.ok(publicOffers.every(o => o.liveStatus === 'Live' && o.showOnWebsite === true));

  const catalog = await getCatalog();
  const firstSku = Array.from(catalog.keys())[0];
  const invalidRes = await calculateOrderTotal([{ id: firstSku, quantity: 1 }], 'NOTREAL999');
  assert.equal(invalidRes.ok, false);
  assert.equal(invalidRes.error, 'This coupon code is invalid or expired.');
});
