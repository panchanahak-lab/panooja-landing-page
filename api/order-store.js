// api/order-store.js - Persistent Server-Side Order Management Store
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

// Read all orders safely
export function getAllOrders() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error('Error reading orders file:', err.message);
    return [];
  }
}

// Write orders atomically
function writeOrders(orders) {
  ensureDataDir();
  const tmpFile = ORDERS_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(orders, null, 2), 'utf-8');
  fs.renameSync(tmpFile, ORDERS_FILE);
}

// Save or insert a new order record
export function saveOrder(orderRecord) {
  const orders = getAllOrders();
  const existingIdx = orders.findIndex(
    o => o.order_id === orderRecord.order_id || (o.id && o.id === orderRecord.id)
  );

  const timestamp = new Date().toISOString();
  if (existingIdx >= 0) {
    orders[existingIdx] = {
      ...orders[existingIdx],
      ...orderRecord,
      updated_at: timestamp
    };
  } else {
    orders.push({
      id: orderRecord.id || `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      ...orderRecord,
      created_at: timestamp,
      updated_at: timestamp
    });
  }

  writeOrders(orders);
  return orderRecord;
}

// Find order by Razorpay order ID or internal order ID
export function findOrder(orderId) {
  if (!orderId) return null;
  const orders = getAllOrders();
  return orders.find(o => o.order_id === orderId || o.id === orderId) || null;
}

// Update order status with reconciliation
export function updateOrderStatus(orderId, status, paymentDetails = {}) {
  const orders = getAllOrders();
  const order = orders.find(o => o.order_id === orderId || o.id === orderId);

  if (!order) {
    return null;
  }

  order.status = status;
  order.updated_at = new Date().toISOString();

  if (paymentDetails.payment_id) {
    order.razorpay_payment_id = paymentDetails.payment_id;
  }
  if (paymentDetails.signature) {
    order.razorpay_signature = paymentDetails.signature;
  }
  if (status === 'Payment Verified') {
    order.verified_at = new Date().toISOString();
  } else if (status === 'Payment Failed') {
    order.failed_at = new Date().toISOString();
    order.failure_reason = paymentDetails.reason || 'Payment cancelled or declined';
  }

  writeOrders(orders);
  return order;
}

export const getOrder = findOrder;
