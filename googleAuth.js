"use strict";
// Verifies a Google Sign-In ID token LOCALLY (RSA signature against Google's public keys,
// which are downloaded once and cached). No network round-trip per login, and no use of the
// "tokeninfo" debugging endpoint.
const crypto = require("crypto");
const { GOOGLE_CLIENT_ID } = require("./config");

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const CLOCK_SKEW_S = 60;

let keyCache = { keys: new Map(), expires: 0, fetchedAt: 0 };

async function loadKeys(force) {
  const now = Date.now();
  if (!force && keyCache.keys.size && now < keyCache.expires) return keyCache.keys;
  const r = await fetch(JWKS_URL, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error("jwks fetch failed: " + r.status);
  const body = await r.json();
  const keys = new Map();
  for (const jwk of (body && body.keys) || []) {
    if (jwk && jwk.kid && jwk.kty === "RSA") keys.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }));
  }
  const m = /max-age=(\d+)/.exec((r.headers && r.headers.get && r.headers.get("cache-control")) || "");
  const ttl = Math.max(300, Math.min(m ? Number(m[1]) : 3600, 86400));
  keyCache = { keys, expires: now + ttl * 1000, fetchedAt: now };
  return keys;
}

// Returns the verified, lower-cased e-mail address, or null.
async function verifyGoogleToken(idToken) {
  if (typeof idToken !== "string" || idToken.length > 4096) return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;

  let header, payload;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch (e) {
    return null;
  }
  if (!header || header.alg !== "RS256" || !header.kid || !payload) return null;

  try {
    let keys = await loadKeys(false);
    let key = keys.get(header.kid);
    // Unknown key id: Google may have rotated keys. Re-fetch, but at most once a minute
    // so a forged token cannot be used to hammer Google.
    if (!key && Date.now() - keyCache.fetchedAt > 60000) {
      keys = await loadKeys(true);
      key = keys.get(header.kid);
    }
    if (!key) return null;
    const ok = crypto.verify(
      "RSA-SHA256",
      Buffer.from(parts[0] + "." + parts[1]),
      key,
      Buffer.from(parts[2], "base64url")
    );
    if (!ok) return null;
  } catch (e) {
    console.error("verifyGoogleToken:", e && e.message ? e.message : e);
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!ISSUERS.includes(payload.iss)) return null;
  if (payload.aud !== GOOGLE_CLIENT_ID) return null;
  if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_S <= now) return null;
  if (typeof payload.iat === "number" && payload.iat - CLOCK_SKEW_S > now) return null;
  if (!payload.email || String(payload.email_verified).toLowerCase() !== "true") return null;
  return String(payload.email).trim().toLowerCase();
}

function _resetKeyCacheForTests() {
  keyCache = { keys: new Map(), expires: 0, fetchedAt: 0 };
}

module.exports = { verifyGoogleToken, _resetKeyCacheForTests };
