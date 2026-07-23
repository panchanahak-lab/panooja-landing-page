export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, status: 'error', message: 'Method Not Allowed' });
  }

  // Ensure content type is JSON
  if (req.headers['content-type'] !== 'application/json') {
    return res.status(415).json({ ok: false, status: 'error', message: 'Unsupported Media Type' });
  }

  try {
    const body = req.body;
    
    // Check honeypot
    if (body.companyWebsite && body.companyWebsite.length > 0) {
      // Silently ignore spam by returning a fake success response
      return res.status(200).json({ ok: true, status: 'created', message: 'You’re on the list. We’ll let you know when PANOOJA launches.' });
    }

    // Validate email
    let email = typeof body.email === 'string' ? body.email.trim() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ ok: false, status: 'invalid', message: 'Please enter a valid email address.' });
    }
    
    email = email.toLowerCase();

    // Sanitize other fields
    const name = typeof body.name === 'string' ? body.name.trim().substring(0, 100) : '';
    const utm_source = typeof body.utm_source === 'string' ? body.utm_source.trim().substring(0, 100) : '';
    const utm_medium = typeof body.utm_medium === 'string' ? body.utm_medium.trim().substring(0, 100) : '';
    const utm_campaign = typeof body.utm_campaign === 'string' ? body.utm_campaign.trim().substring(0, 100) : '';
    const referrer = typeof body.referrer === 'string' ? body.referrer.trim().substring(0, 500) : '';
    const page_url = typeof body.page_url === 'string' ? body.page_url.trim().substring(0, 500) : '';

    // Fetch secrets
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const formSecret = process.env.FORM_SECRET;

    if (!scriptUrl || !formSecret) {
      console.error('Missing server environment variables');
      return res.status(500).json({ ok: false, status: 'error', message: 'We couldn’t save your details right now. Please try again.' });
    }

    // Prepare payload for Apps Script
    const appsScriptPayload = {
      email,
      name,
      utm_source,
      utm_medium,
      utm_campaign,
      referrer,
      page_url,
      secret: formSecret // Inject secret
    };

    // Forward to Apps Script with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const scriptResponse = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(appsScriptPayload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!scriptResponse.ok) {
      console.error('Apps script returned non-OK status:', scriptResponse.status);
      return res.status(500).json({ ok: false, status: 'error', message: 'We couldn’t save your details right now. Please try again.' });
    }

    const scriptData = await scriptResponse.json();

    // Pass the safe json response back to the frontend
    return res.status(200).json(scriptData);

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Apps script request timed out');
    } else {
      console.error('Server error processing form:', error);
    }
    return res.status(500).json({ ok: false, status: 'error', message: 'We couldn’t save your details right now. Please try again.' });
  }
}
