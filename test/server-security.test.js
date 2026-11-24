import test from 'node:test';
import assert from 'node:assert/strict';

test('Server Security - blocks .env and sensitive file access', async () => {
  const res = await fetch('http://localhost:3000/.env');
  assert.equal(res.status, 403, 'Access to .env must return 403 Forbidden');
});

test('Server Security - blocks directory traversal attacks', async () => {
  const res = await fetch('http://localhost:3000/..%2f..%2fpackage.json');
  assert.equal(res.status, 403, 'Path traversal must return 403 Forbidden');
});

test('Server Security - serves proper security headers', async () => {
  const res = await fetch('http://localhost:3000/');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
});

test('Server Security - redirects /index.html to / for clean URLs', async () => {
  const res = await fetch('http://localhost:3000/index.html', { redirect: 'manual' });
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), '/');
});

test('Server Security - early access rate limits spam attempts', async () => {
  const payload = JSON.stringify({ email: `test_ratelimit_${Date.now()}@example.com` });
  
  // Make multiple requests from the same IP
  const responses = [];
  for (let i = 0; i < 7; i++) {
    const res = await fetch('http://localhost:3000/api/early-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    });
    responses.push(res.status);
  }

  // At least one of the requests beyond limit (5/hr) should return 429
  assert.ok(responses.includes(429), 'Spamming early-access should return 429 Too Many Requests');
});
