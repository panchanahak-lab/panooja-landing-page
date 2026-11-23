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
        const expectedClientId = process.env.GOOGLE_CLIENT_ID || '63300831514-5qg0db4qmdnfa5g4vkfqh339e3asriv2.apps.googleusercontent.com';
        
        // 1. Audience validation
        if (expectedClientId && tokenInfo.data.aud !== expectedClientId) {
          return res.status(400).json({
            ok: false,
            error: 'Google credential audience mismatch.'
          });
        }

        // 2. Issuer validation
        const iss = tokenInfo.data.iss;
        if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
          return res.status(400).json({
            ok: false,
            error: 'Invalid token issuer.'
          });
        }

        // 3. Expiration validation
        const exp = parseInt(tokenInfo.data.exp, 10);
        if (!exp || (exp * 1000) < (Date.now() - 300000)) { // 5-minute clock drift tolerance
          return res.status(400).json({
            ok: false,
            error: 'Google authentication token has expired.'
          });
        }

        // 4. Email verified validation
        const isEmailVerified = tokenInfo.data.email_verified === 'true' || tokenInfo.data.email_verified === true;
        if (!isEmailVerified) {
          return res.status(400).json({
            ok: false,
            error: 'Google account email is not verified.'
          });
        }

        return res.status(200).json({
          ok: true,
          user: {
            id: tokenInfo.data.sub,
            name: tokenInfo.data.name || name || 'Client',
            givenName: tokenInfo.data.given_name || (tokenInfo.data.name ? tokenInfo.data.name.split(' ')[0] : 'Client'),
            email: tokenInfo.data.email,
            picture: tokenInfo.data.picture || '',
            verified: true,
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

    // Direct email entry: Clearly marked as unverified guest profile for local device convenience
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = (name || cleanEmail.split('@')[0]).trim();

      return res.status(200).json({
        ok: true,
        user: {
          id: 'guest_' + Date.now(),
          name: cleanName,
          givenName: cleanName.split(' ')[0],
          email: cleanEmail,
          picture: '',
          verified: false, // Explicitly false: Not a verified Google account
          authMethod: 'guest_convenience_profile'
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
