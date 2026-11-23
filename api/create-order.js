// api/create-order.js - Razorpay Order Creation Endpoint with Server-Side Price Calculation
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import { calculateOrderTotal } from './catalog-service.js';
import { saveOrder } from './order-store.js';

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

  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    console.error('Razorpay credentials missing from environment variables');
    return res.status(401).json({
      ok: false,
      error: 'Authentication failed: Razorpay credentials missing on server.'
    });
  }

  try {
    // Parse body safely (supports parsed req.body or stringified JSON)
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ ok: false, error: 'Invalid JSON request body' });
      }
    }
    body = body || {};

    let amountInPaise;
    let calculation = null;

    // Secure Server-Side Calculation: Browser cannot dictate price if items are passed
    if (Array.isArray(body.items) && body.items.length > 0) {
      calculation = await calculateOrderTotal(body.items, body.promo_code);
      if (!calculation.ok) {
        return res.status(400).json({
          ok: false,
          error: calculation.error || 'Failed to calculate order total from trusted catalogue.'
        });
      }
      amountInPaise = calculation.amountInPaise;
    } else if (typeof body.amount_in_rupees !== 'undefined') {
      amountInPaise = Math.round(Number(body.amount_in_rupees) * 100);
    } else if (typeof body.amount !== 'undefined') {
      amountInPaise = Math.round(Number(body.amount));
    } else {
      return res.status(400).json({
        ok: false,
        error: 'Shopping bag items are required to create an order.'
      });
    }

    // Minimum order amount requirement: 100 paise (₹1)
    if (!amountInPaise || isNaN(amountInPaise) || amountInPaise < 100) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid order amount. Minimum amount is 100 paise.'
      });
    }

    const currency = 'INR';
    const receipt = body.receipt || `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const razorpay = new Razorpay({
      key_id,
      key_secret
    });

    const customerName = (body.customer_name || '').trim();
    const customerPhone = (body.customer_phone || '').trim();
    const customerEmail = (body.customer_email || '').trim();
    const deliveryAddress = (body.delivery_address || '').trim();

    const options = {
      amount: amountInPaise,
      currency,
      receipt,
      notes: {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        delivery_address: deliveryAddress,
        promo_code: calculation ? calculation.promoCode : (body.promo_code || '')
      }
    };

    const order = await razorpay.orders.create(options);

    // Save order record persistently
    saveOrder({
      order_id: order.id,
      receipt,
      amount: order.amount,
      currency: order.currency,
      status: 'Payment Initiated',
      customer: {
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        address: deliveryAddress
      },
      items: calculation ? calculation.items : [],
      subtotal: calculation ? calculation.subtotal : Math.round(order.amount / 100),
      discount: calculation ? calculation.discount : 0,
      promo_code: calculation ? calculation.promoCode : (body.promo_code || '')
    });

    return res.status(200).json({
      ok: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: key_id,
      calculation: calculation ? {
        subtotal: calculation.subtotal,
        discount: calculation.discount,
        shippingFee: calculation.shippingFee,
        grandTotal: calculation.grandTotal
      } : null
    });

  } catch (error) {
    console.error('Razorpay Order Creation Error:', error);
    if (error.statusCode === 401 || (error.error && error.error.code === 'BAD_REQUEST_ERROR' && error.statusCode === 401)) {
      return res.status(401).json({
        ok: false,
        error: 'Authentication failed with Razorpay API.'
      });
    }
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      ok: false,
      error: error.description || error.message || 'Failed to create Razorpay order.'
    });
  }
}
