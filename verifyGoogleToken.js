const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '323362878068-gpr8osss81v1t2qv85ffedmca7dld54u.apps.googleusercontent.com';

// Verify the Google ID token with Google's tokeninfo endpoint. The endpoint
// validates the token signature, expiry and claims; we additionally enforce
// our own client ID, issuer and verified-email checks.
async function verifyGoogleToken(idToken) {
  if (!idToken || typeof idToken !== 'string') return null;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (data.aud !== GOOGLE_CLIENT_ID) return null;
    if (data.iss && data.iss !== 'https://accounts.google.com' && data.iss !== 'accounts.google.com') return null;
    if (!data.email || String(data.email_verified).toLowerCase() !== 'true') return null;
    if (data.exp && Number(data.exp) <= Math.floor(Date.now() / 1000)) return null;
    return String(data.email).trim().toLowerCase();
  } catch (e) {
    return null;
  }
}

module.exports = { verifyGoogleToken, GOOGLE_CLIENT_ID };
