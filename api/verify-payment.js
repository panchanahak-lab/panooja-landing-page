// api/verify-payment.js - Razorpay Payment Signature Verification & Order Reconciliation Endpoint
import crypto from 'crypto';
import dotenv from 'dotenv';
import { findOrder, updateOrderStatus } from './order-store.js';

dotenv.config();

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_secret) {
    console.error('Razorpay key secret missing from environment variables');
    return res.status(401).json({
      ok: false,
      error: 'Authentication failed: Razorpay credentials missing on server.'
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ ok: false, error: 'Invalid JSON request body' });
      }
    }
    body = body || {};

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required payment verification fields (razorpay_order_id, razorpay_payment_id, razorpay_signature).'
      });
    }

    // Step 3 Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(payload)
      .digest('hex');

    const generatedBuf = Buffer.from(generatedSignature, 'utf-8');
    const signatureBuf = Buffer.from(String(razorpay_signature), 'utf-8');

    // Return 400 on signature length mismatch
    if (generatedBuf.length !== signatureBuf.length) {
      console.warn(`Signature length mismatch for Order ID: ${razorpay_order_id}`);
      updateOrderStatus(razorpay_order_id, 'Payment Failed', { reason: 'Signature length mismatch' });
      return res.status(400).json({
        ok: false,
        error: 'Payment verification failed: Invalid payment signature.'
      });
    }

    // Compare signatures securely using timingSafeEqual
    const isMatch = crypto.timingSafeEqual(generatedBuf, signatureBuf);

    if (!isMatch) {
      console.warn(`Signature mismatch for Order ID: ${razorpay_order_id}, Payment ID: ${razorpay_payment_id}`);
      updateOrderStatus(razorpay_order_id, 'Payment Failed', { reason: 'Signature mismatch' });
      return res.status(400).json({
        ok: false,
        error: 'Payment verification failed: Invalid payment signature.'
      });
    }

    // Signatures match: update persistent order record
    const updatedOrder = updateOrderStatus(razorpay_order_id, 'Payment Verified', {
      payment_id: razorpay_payment_id,
      signature: razorpay_signature
    });

    return res.status(200).json({
      ok: true,
      message: 'Payment verified successfully.',
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      order_status: 'Payment Verified',
      receipt: updatedOrder ? updatedOrder.receipt : null
    });

  } catch (error) {
    console.error('Payment Verification Server Error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error while verifying payment.'
    });
  }
}
