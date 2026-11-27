// api/order-store.js - Persistent Server-Side Order Management Store
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRIMARY_DATA_DIR = path.resolve(__dirname, '../data');
const FALLBACK_DATA_DIR = path.join(os.tmpdir(), 'panooja-data');

function resolveOrdersFile() {
  for (const dir of [PRIMARY_DATA_DIR, FALLBACK_DATA_DIR]) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const file = path.join(dir, 'orders.json');
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify([], null, 2), 'utf-8');
      } else {
        fs.accessSync(dir, fs.constants.W_OK);
      }
      return file;
    } catch (e) {
      // Fall through to /tmp on read-only serverless environments like Vercel
    }
  }
  return null;
}

// Read all orders safely
export function getAllOrders() {
  const ordersFile = resolveOrdersFile();
  if (!ordersFile) return [];
  try {
    const raw = fs.readFileSync(ordersFile, 'utf-8');
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error('Error reading orders file:', err.message);
    return [];
  }
}

// Write orders atomically
function writeOrders(orders) {
  const ordersFile = resolveOrdersFile();
  if (!ordersFile) return false;
  try {
    const tmpFile = ordersFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(orders, null, 2), 'utf-8');
    fs.renameSync(tmpFile, ordersFile);
    return true;
  } catch (err) {
    console.error('Error writing orders file:', err.message);
    return false;
  }
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
