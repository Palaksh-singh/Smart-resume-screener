// Lazy helper to obtain an access token via Application Default Credentials or
// a service-account key file using google-auth-library. If the optional
// dependency isn't installed, this module fails gracefully and returns null.

let cached = { token: null, expiry: 0 };

export async function getApplicationDefaultAccessToken() {
  // Return cached token if still valid (with 60s buffer)
  if (cached.token && Date.now() < cached.expiry - 60000) {
    return cached.token;
  }

  let mod;
  try {
    mod = await import('google-auth-library');
  } catch (e) {
    console.warn('google-auth-library not installed; skipping ADC token retrieval');
    return null;
  }

  const { GoogleAuth } = mod;
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

  try {
    const client = await auth.getClient();
    const res = await client.getAccessToken();
    // res may be { token: 'ya29...' } or a string
    const token = typeof res === 'string' ? res : res?.token;
    if (!token) return null;

    // attempt to determine expiry
    let expiry = Date.now() + 60 * 60 * 1000; // default to 1h
    try {
      const sts = await client.getRequestHeaders();
      // no reliable expiry from getRequestHeaders; rely on default
    } catch (e) {
      // ignore
    }

    cached = { token, expiry };
    return token;
  } catch (err) {
    console.warn('Failed to retrieve ADC access token:', err.message || err);
    return null;
  }
}
