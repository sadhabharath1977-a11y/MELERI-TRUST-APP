const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "323362878068-gpr8osss81v1t2qv85ffedmca7dld54u.apps.googleusercontent.com";

// Verifies a Google Sign-In ID token by asking Google itself (signature + audience + expiry
// are all checked by Google's endpoint) — returns the verified email, or null if invalid.
async function verifyGoogleToken(idToken) {
  if (!idToken || typeof idToken !== "string") return null;
  try {
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
    if (!r.ok) return null;
    const data = await r.json();
    if (data.aud !== GOOGLE_CLIENT_ID) return null;
    if (!data.email || data.email_verified !== "true") return null;
    return String(data.email).toLowerCase();
  } catch (e) {
    return null;
  }
}

module.exports = { verifyGoogleToken, GOOGLE_CLIENT_ID };
