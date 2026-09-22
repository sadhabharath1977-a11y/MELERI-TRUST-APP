"use strict";
// Signed session cookie (HMAC-SHA256) + a separate, longer-lived device-identity cookie.
// Both are HttpOnly + Secure + SameSite=Strict, so page JavaScript can never read them
// (an XSS bug can no longer steal the login or spoof the device id).
const crypto = require("crypto");
const { SESSION_TTL_SECONDS } = require("./config");

const COOKIE_NAME = "__Host-meleri_session"; // __Host- prefix: Secure, Path=/, no Domain
const DEVICE_COOKIE_NAME = "__Host-meleri_device";
const DEVICE_TTL_SECONDS = 400 * 24 * 60 * 60; // ~400 days (the maximum browsers honour)
const DEVICE_ID_RE = /^[a-f0-9]{32}$/;

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return crypto.createHash("sha256").update("meleri-session:" + process.env.BLOB_READ_WRITE_TOKEN).digest("hex");
  }
  throw new Error("SESSION_SECRET is not configured");
}

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const mac = (data) => crypto.createHmac("sha256", secret()).update(data).digest();

function sign(email, now = Date.now()) {
  const payload = b64u(JSON.stringify({ e: email, x: Math.floor(now / 1000) + SESSION_TTL_SECONDS }));
  return payload + "." + b64u(mac(payload));
}

function verify(token, now = Date.now()) {
  if (typeof token !== "string" || token.length > 1024) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const given = Buffer.from(parts[1], "base64url");
  const expected = mac(parts[0]);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!p || typeof p.e !== "string" || typeof p.x !== "number") return null;
    if (p.x <= Math.floor(now / 1000)) return null;
    return p.e;
  } catch (e) {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  String(header || "")
    .split(";")
    .forEach((part) => {
      const i = part.indexOf("=");
      if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    });
  return out;
}

function readSession(req) {
  const c = parseCookies(req.headers && req.headers.cookie);
  return verify(c[COOKIE_NAME]);
}

// The device cookie is NOT signed - it is just a random id, compared against what is stored
// against the email in Blob (see store.js checkAndBindDevice). Reading an invalid/tampered value
// simply means "unrecognised device", which is the safe default.
function readDeviceId(req) {
  const c = parseCookies(req.headers && req.headers.cookie);
  const id = c[DEVICE_COOKIE_NAME];
  return typeof id === "string" && DEVICE_ID_RE.test(id) ? id : null;
}
function newDeviceId() {
  return crypto.randomBytes(16).toString("hex");
}

function setSessionCookie(res, email) {
  res.setHeader(
    "Set-Cookie",
    COOKIE_NAME + "=" + sign(email) + "; Max-Age=" + SESSION_TTL_SECONDS + "; Path=/; HttpOnly; Secure; SameSite=Strict"
  );
}

// Sets the session cookie AND (only when a new device id had to be generated) the device cookie,
// in a single response - Node/Vercel send an array as multiple Set-Cookie headers.
function setAuthCookies(res, email, deviceId, isNewDeviceCookie) {
  const sessionCookie = COOKIE_NAME + "=" + sign(email) + "; Max-Age=" + SESSION_TTL_SECONDS + "; Path=/; HttpOnly; Secure; SameSite=Strict";
  if (!isNewDeviceCookie) {
    res.setHeader("Set-Cookie", sessionCookie);
    return;
  }
  const deviceCookie = DEVICE_COOKIE_NAME + "=" + deviceId + "; Max-Age=" + DEVICE_TTL_SECONDS + "; Path=/; HttpOnly; Secure; SameSite=Strict";
  res.setHeader("Set-Cookie", [sessionCookie, deviceCookie]);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", COOKIE_NAME + "=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict");
}

module.exports = {
  COOKIE_NAME,
  DEVICE_COOKIE_NAME,
  sign,
  verify,
  parseCookies,
  readSession,
  readDeviceId,
  newDeviceId,
  setSessionCookie,
  setAuthCookies,
  clearSessionCookie
};
