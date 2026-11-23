import test from 'node:test';
import assert from 'node:assert/strict';
import { saveOrder, getOrder, updateOrderStatus } from '../api/order-store.js';

test('Order Store - saves and retrieves an order atomically', () => {
  const testOrderId = `test_order_${Date.now()}`;
  const orderData = {
    order_id: testOrderId,
    status: 'Payment Initiated',
    amount: 1499,
    amount_paise: 149900,
    currency: 'INR',
    items: [{ id: 'PNJ-001', name: 'Hoop Earrings', price: 1499, quantity: 1 }],
    customer: {
      name: 'Test Customer',
      phone: '9876543210',
      address: '123 Test Street',
      pincode: '110001'
    }
  };

  const saved = saveOrder(orderData);
  assert.equal(saved.order_id, testOrderId);
  assert.equal(saved.status, 'Payment Initiated');

  const retrieved = getOrder(testOrderId);
  assert.ok(retrieved, 'Order should be retrieved from disk');
  assert.equal(retrieved.order_id, testOrderId);
  assert.equal(retrieved.customer.name, 'Test Customer');
});

test('Order Store - updates status correctly on payment verification', () => {
  const testOrderId = `test_order_verify_${Date.now()}`;
  saveOrder({
    order_id: testOrderId,
    status: 'Payment Initiated',
    amount: 899,
    amount_paise: 89900,
    currency: 'INR'
  });

  const updated = updateOrderStatus(testOrderId, 'Payment Verified', {
    payment_id: 'pay_test123',
    signature: 'sig_test123'
  });

  assert.equal(updated.status, 'Payment Verified');
  assert.equal(updated.razorpay_payment_id, 'pay_test123');

  const check = getOrder(testOrderId);
  assert.equal(check.status, 'Payment Verified');
});

test('Order Store - updates status to failed when payment fails', () => {
  const testOrderId = `test_order_fail_${Date.now()}`;
  saveOrder({
    order_id: testOrderId,
    status: 'Payment Initiated',
    amount: 999,
    amount_paise: 99900,
    currency: 'INR'
  });

  const updated = updateOrderStatus(testOrderId, 'Payment Failed', {
    reason: 'User cancelled transaction'
  });

  assert.equal(updated.status, 'Payment Failed');
  assert.equal(updated.failure_reason, 'User cancelled transaction');
});
