import test from 'node:test';
import assert from 'node:assert/strict';

test('Auth Security - rejects invalid or malformed Google ID tokens', async () => {
  const res = await fetch('http://localhost:3000/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: 'invalid.jwt.token' })
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.ok, false);
});

test('Auth Security - rejects unverified or tampered Google ID tokens', async () => {
  // Craft a JWT payload with an unverified signature
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    aud: 'fake-client-id-12345.apps.googleusercontent.com',
    iss: 'accounts.google.com',
    email: 'hacker@example.com',
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 3600
  })).toString('base64url');
  const fakeToken = `${header}.${payload}.fakesig`;

  const res = await fetch('http://localhost:3000/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: fakeToken })
  });
  
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.ok, false);
});

test('Auth Security - marks direct email login as unverified guest profile', async () => {
  const res = await fetch('http://localhost:3000/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'guest@example.com', name: 'Guest User' })
  });
  
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.user.verified, false, 'Direct email entries must be marked verified: false');
  assert.equal(data.user.authMethod, 'guest_convenience_profile');
});
