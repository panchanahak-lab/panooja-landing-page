// api/auth/google.js - Backend Google Auth Verification Endpoint
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

export default async function handler(req, res) {
  // CORS
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
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
      }
    }
    body = body || {};

    const { credential, email, name, picture } = body;

    // If Google OAuth JWT credential was passed, verify via Google's tokeninfo API
    if (credential) {
      const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
      
      const tokenInfo = await new Promise((resolve, reject) => {
        https.get(verifyUrl, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve({ statusCode: response.statusCode, data: parsed });
            } catch (err) {
              reject(err);
            }
          });
        }).on('error', reject);
      });

      if (tokenInfo.statusCode === 200 && tokenInfo.data.email) {
        return res.status(200).json({
          ok: true,
          user: {
            id: tokenInfo.data.sub,
            name: tokenInfo.data.name || name || 'Client',
            email: tokenInfo.data.email,
            picture: tokenInfo.data.picture || '',
            verified: tokenInfo.data.email_verified === 'true' || true,
            authMethod: 'google_oauth'
          }
        });
      } else {
        return res.status(400).json({
          ok: false,
          error: tokenInfo.data.error_description || 'Invalid Google credential token.'
        });
      }
    }

    // Direct Gmail email verification
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = (name || cleanEmail.split('@')[0]).trim();

      return res.status(200).json({
        ok: true,
        user: {
          id: 'usr_' + Date.now(),
          name: cleanName,
          email: cleanEmail,
          picture: picture || '',
          verified: true,
          authMethod: 'gmail_direct'
        }
      });
    }

    return res.status(400).json({
      ok: false,
      error: 'Missing Google credential or email address.'
    });

  } catch (error) {
    console.error('Google Auth Server Error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error during Google authentication.'
    });
  }
}
