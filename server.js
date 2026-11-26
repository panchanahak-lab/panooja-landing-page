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
import productSeoHandler from './api/product-seo.js';
import sitemapHandler from './api/sitemap.js';

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

const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB payload limit

// Helper to adapt Node http request & response to Vercel/Express-like handler
function adaptReqRes(req, res, handler) {
  // Set standard security headers on all responses
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  let bodyData = '';
  let bodyLength = 0;

  req.on('data', chunk => {
    bodyLength += chunk.length;
    if (bodyLength > MAX_BODY_SIZE) {
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Payload Too Large' }));
      req.destroy();
      return;
    }
    bodyData += chunk;
  });

  req.on('end', async () => {
    if (bodyLength > MAX_BODY_SIZE) return;

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

    res.send = function(data) {
      if (!this.getHeader('Content-Type')) {
        this.setHeader('Content-Type', 'text/html; charset=utf-8');
      }
      this.end(data);
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
  // Global security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const [pathname] = req.url.split('?');

  // Product SEO Deep Links (/product/:slug)
  if (pathname.startsWith('/product/')) {
    const slug = pathname.replace('/product/', '').replace(/\/$/, '');
    req.query = { slug };
    return adaptReqRes(req, res, productSeoHandler);
  }

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
  if (pathname === '/api/product-seo') {
    return adaptReqRes(req, res, productSeoHandler);
  }
  if (pathname === '/sitemap.xml' || pathname === '/api/sitemap') {
    return adaptReqRes(req, res, sitemapHandler);
  }

  // Security Check: Block sensitive files (.env, .git, data, node_modules)
  const normalizedPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (
    normalizedPath.includes('..') ||
    /(^|[\\/])\./.test(normalizedPath) ||
    normalizedPath.toLowerCase().includes('.env') ||
    normalizedPath.startsWith('/data') ||
    normalizedPath.startsWith('\\data') ||
    normalizedPath.startsWith('/node_modules') ||
    normalizedPath.startsWith('\\node_modules')
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Access Denied');
    return;
  }

  // Static File Serving
  let reqPath = pathname;

  // Clean URL redirect: /index.html -> /
  if (pathname === '/index.html') {
    res.writeHead(301, {
      'Location': '/',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end();
    return;
  }

  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  let filePath = path.resolve(__dirname, '.' + reqPath);

  // Clean URL support (matches Vercel cleanUrls: true): /shipping -> shipping.html
  if (!path.extname(filePath)) {
    const htmlCandidate = filePath + '.html';
    if (fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
      filePath = htmlCandidate;
    }
  }

  // Path Traversal containment check
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        const notFoundPath = path.join(__dirname, '404.html');
        fs.readFile(notFoundPath, (err404, html404) => {
          if (!err404 && html404) {
            res.writeHead(404, {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(html404);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          }
        });
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
