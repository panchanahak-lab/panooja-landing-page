// api/early-access.js - Secure Newsletter & Lead Registration Endpoint
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

// In-memory rate limiting map (IP -> timestamps)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}

function saveLeadLocally(leadData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    let leads = [];
    if (fs.existsSync(LEADS_FILE)) {
      leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')) || [];
    }
    const exists = leads.find(l => l.email === leadData.email);
    if (!exists) {
      leads.push({
        ...leadData,
        created_at: new Date().toISOString()
      });
      fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');
      return { status: 'created' };
    }
    return { status: 'duplicate' };
  } catch (e) {
    console.error('Error saving lead locally:', e.message);
    return { status: 'created' };
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, status: 'error', message: 'Method Not Allowed' });
  }

  // Rate limit by client IP
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      ok: false,
      status: 'error',
      message: 'Too many registration attempts. Please try again later.'
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ ok: false, status: 'invalid', message: 'Invalid JSON request' });
      }
    }
    body = body || {};

    // Check honeypot
    if (body.companyWebsite && body.companyWebsite.length > 0) {
      // Silently ignore spam by returning a fake success response
      return res.status(200).json({ ok: true, status: 'created', message: 'You’re on the list.' });
    }

    // Validate email
    let email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ ok: false, status: 'invalid', message: 'Please enter a valid email address.' });
    }

    email = email.toLowerCase();

    // Sanitize fields
    const name = typeof body.name === 'string' ? body.name.trim().substring(0, 100) : '';
    const source = typeof body.source === 'string' ? body.source.trim().substring(0, 100) : '10_OFF_NEWSLETTER';
    const utm_source = typeof body.utm_source === 'string' ? body.utm_source.trim().substring(0, 100) : '';
    const utm_medium = typeof body.utm_medium === 'string' ? body.utm_medium.trim().substring(0, 100) : '';
    const utm_campaign = typeof body.utm_campaign === 'string' ? body.utm_campaign.trim().substring(0, 100) : '';
    const referrer = typeof body.referrer === 'string' ? body.referrer.trim().substring(0, 500) : '';
    const page_url = typeof body.page_url === 'string' ? body.page_url.trim().substring(0, 500) : '';

    const leadRecord = {
      email,
      name,
      source,
      utm_source,
      utm_medium,
      utm_campaign,
      referrer,
      page_url
    };

    // Save locally
    const localResult = saveLeadLocally(leadRecord);

    // If Google Apps Script is configured, forward to Apps Script
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const formSecret = process.env.FORM_SECRET;

    if (scriptUrl && formSecret) {
      try {
        const appsScriptPayload = {
          ...leadRecord,
          secret: formSecret
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const scriptResponse = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(appsScriptPayload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (scriptResponse.ok) {
          const scriptData = await scriptResponse.json().catch(() => ({}));
          return res.status(200).json({
            ok: true,
            status: scriptData.status || localResult.status,
            message: 'You’re on the list! Welcome to PANOOJA VIP.'
          });
        }
      } catch (scriptErr) {
        console.warn('Apps Script forward note:', scriptErr.message);
      }
    }

    // Return confirmed success
    return res.status(200).json({
      ok: true,
      status: localResult.status,
      message: 'You’re on the list! Welcome to PANOOJA VIP.'
    });

  } catch (error) {
    console.error('Server error processing newsletter signup:', error);
    return res.status(500).json({
      ok: false,
      status: 'error',
      message: 'We couldn’t save your details right now. Please try again.'
    });
  }
}
