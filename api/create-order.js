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

    const isWhatsappInquiry = body.order_channel === 'whatsapp' || body.inquiry_only === true;
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!isWhatsappInquiry && (!key_id || !key_secret)) {
      console.error('Razorpay credentials missing from environment variables');
      return res.status(401).json({
        ok: false,
        error: 'Authentication failed: Razorpay credentials missing on server.'
      });
    }

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
    const customerName = (body.customer_name || '').trim();
    const customerPhone = (body.customer_phone || '').trim();
    const customerEmail = (body.customer_email || '').trim();
    const deliveryAddress = (body.delivery_address || '').trim();

    // Save WhatsApp inquiry cleanly without requiring Razorpay keys or API call
    if (isWhatsappInquiry) {
      const itemsList = calculation ? calculation.items : [];
      const subtotalVal = calculation ? calculation.subtotal : Math.round(amountInPaise / 100);
      const discountVal = calculation ? calculation.discount : 0;
      const shippingVal = calculation ? calculation.shippingFee : 0;
      const promoVal = calculation ? calculation.promoCode : (body.promo_code || '');

      try {
        saveOrder({
          order_id: receipt,
          receipt,
          amount: amountInPaise,
          currency,
          status: 'WhatsApp Inquiry',
          customer: {
            name: customerName,
            phone: customerPhone,
            email: customerEmail,
            address: deliveryAddress
          },
          items: itemsList,
          subtotal: subtotalVal,
          discount: discountVal,
          promo_code: promoVal
        });
      } catch (saveErr) {
        console.warn('Local order store save note:', saveErr.message);
      }

      // Optional Google Sheet / Email notification via Google Apps Script webhook
      let forwardedToSheet = false;
      const webhookUrl = process.env.GOOGLE_ORDERS_SCRIPT_URL || process.env.GOOGLE_APPS_SCRIPT_URL;
      const formSecret = process.env.FORM_SECRET;
      if (webhookUrl && formSecret) {
        try {
          const itemsSummary = itemsList.map(i => `${i.name} (${i.sku}) x ${i.quantity} = ₹${i.itemTotal}`).join(' | ');
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const hookRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              record_type: 'whatsapp_inquiry',
              secret: formSecret,
              order_id: receipt,
              created_at: new Date().toISOString(),
              status: 'WhatsApp Inquiry',
              customer_name: customerName,
              customer_phone: customerPhone,
              customer_email: customerEmail,
              delivery_address: deliveryAddress,
              items_summary: itemsSummary,
              items: itemsList,
              subtotal: subtotalVal,
              discount: discountVal,
              promo_code: promoVal,
              shipping_fee: shippingVal,
              total: Math.round(amountInPaise / 100)
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          forwardedToSheet = hookRes.ok;
        } catch (hookErr) {
          console.warn('WhatsApp order webhook note:', hookErr.message);
        }
      }

      return res.status(200).json({
        ok: true,
        mode: 'whatsapp_inquiry',
        order_id: receipt,
        amount: amountInPaise,
        currency,
        forwarded_to_sheet: forwardedToSheet,
        calculation: calculation ? {
          subtotal: calculation.subtotal,
          discount: calculation.discount,
          shippingFee: calculation.shippingFee,
          grandTotal: calculation.grandTotal
        } : null
      });
    }

    const razorpay = new Razorpay({
      key_id,
      key_secret
    });

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
