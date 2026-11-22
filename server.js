// server.js - Local Development & Production Node.js Server
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import createOrderHandler from './api/create-order.js';
import verifyPaymentHandler from './api/verify-payment.js';
import earlyAccessHandler from './api/early-access.js';
import googleAuthHandler from './api/auth/google.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.xml': 'application/xml'
};

// Helper to adapt Node http request & response to Vercel/Express-like handler
function adaptReqRes(req, res, handler) {
  let bodyData = '';
  req.on('data', chunk => {
    bodyData += chunk;
  });

  req.on('end', async () => {
    if (bodyData) {
      try {
        req.body = JSON.parse(bodyData);
      } catch (e) {
        req.body = bodyData;
      }
    } else {
      req.body = {};
    }

    // Attach res.status().json()
    res.status = function(code) {
      this.statusCode = code;
      return this;
    };

    res.json = function(data) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(data));
      return this;
    };

    try {
      await handler(req, res);
    } catch (err) {
      console.error('API Handler Error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'Internal Server Error' }));
      }
    }
  });
}

const server = http.createServer((req, res) => {
  const [pathname] = req.url.split('?');

  // API Routes
  if (pathname === '/api/create-order') {
    return adaptReqRes(req, res, createOrderHandler);
  }
  if (pathname === '/api/verify-payment') {
    return adaptReqRes(req, res, verifyPaymentHandler);
  }
  if (pathname === '/api/early-access') {
    return adaptReqRes(req, res, earlyAccessHandler);
  }
  if (pathname === '/api/auth/google') {
    return adaptReqRes(req, res, googleAuthHandler);
  }

  // Static File Serving
  let reqPath = pathname;
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`PANOOJA server running at http://localhost:${PORT}/`);
  console.log(`Razorpay API Ready with Key ID: ${process.env.RAZORPAY_KEY_ID ? 'Configured (Active)' : 'Missing'}`);
});
