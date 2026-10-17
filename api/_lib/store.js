"use strict";
// Allowed-member list, stored as one private object in Vercel Blob.
// Each member is { email, role, deviceId }. role is "trustee" (default) or "master" (ஆசிரியர்கள்/masters).
// deviceId (opaque random string, or null) is the device this email is currently locked to — see auth.js.
// A short in-memory cache avoids a Blob read on every single request.
const PATHNAME = "data/allowed-emails.json";
const CACHE_MS = 60 * 1000;

let blobLib = null; // lazily required so tests can inject a fake
function blob() {
  return blobLib || (blobLib = require("@vercel/blob"));
}
function __setBlobForTests(fake) {
  blobLib = fake;
  cache = { at: 0, list: null };
}

let cache = { at: 0, list: null }; // list = array of { email, role, deviceId }

// Accepts the old plain-string format too, so existing stored data keeps working.
function normalizeMembers(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of value) {
    const isObj = raw && typeof raw === "object";
    const email = String((isObj ? raw.email : raw) || "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({
      email,
      role: isObj && raw.role === "master" ? "master" : "trustee",
      deviceId: (isObj && typeof raw.deviceId === "string" && raw.deviceId) || null
    });
  }
  return out;
}

function envFallback() {
  return normalizeMembers(String(process.env.ALLOWED_EMAILS || "").split(/[\n,]+/));
}

// opts.fresh = true bypasses the cache (used by the admin screens, login, and before every write).
async function readMembers(opts) {
  const fresh = opts && opts.fresh;
  if (!fresh && cache.list && Date.now() - cache.at < CACHE_MS) return cache.list;
  let list;
  let failed = false;
  try {
    const result = await blob().get(PATHNAME, { access: "private", useCache: false });
    if (!result || !result.stream) {
      list = envFallback(); // store exists but the list has not been created yet
    } else {
      list = normalizeMembers(JSON.parse(await new Response(result.stream).text()));
    }
  } catch (e) {
    failed = true;
    console.error("readMembers:", e && e.message ? e.message : e);
    list = cache.list || envFallback(); // outage: keep the last good list so members are not locked out
  }
  // Errors are cached only briefly so the app recovers quickly when Blob comes back.
  cache = { at: failed ? Date.now() - CACHE_MS + 10000 : Date.now(), list };
  return list;
}

async function readAllowedEmails(opts) {
  return (await readMembers(opts)).map((m) => m.email);
}

async function getMember(email, opts) {
  return (await readMembers(opts)).find((m) => m.email === email) || null;
}

async function roleOf(email, opts) {
  const m = await getMember(email, opts);
  return (m && m.role) || "trustee";
}

async function writeMembers(members) {
  const list = normalizeMembers(members);
  await blob().put(PATHNAME, JSON.stringify(list), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
  cache = { at: Date.now(), list };
  return list;
}

// Fresh-reads once, checks/locks this email to this device, and returns its role - used by the
// login endpoint so a login needs only one Blob read+write instead of two.
// Returns { ok: true, role } if this device is now (or already was) the bound one,
// { ok: false, other: true, role } if a DIFFERENT device already holds the lock,
// or { ok: false, other: false, role: null } if the email is not a member at all.
async function checkAndBindDevice(email, deviceId) {
  const current = await readMembers({ fresh: true });
  const m = current.find((x) => x.email === email);
  if (!m) return { ok: false, other: false, role: null };
  if (m.deviceId && m.deviceId !== deviceId) return { ok: false, other: true, role: m.role };
  if (m.deviceId !== deviceId) {
    m.deviceId = deviceId;
    await writeMembers(current);
  }
  return { ok: true, other: false, role: m.role };
}

// Admin action: releases the device lock so the member can log in again from any device.
async function resetDevice(email) {
  const current = await readMembers({ fresh: true });
  const m = current.find((x) => x.email === email);
  if (!m) return null;
  m.deviceId = null;
  return writeMembers(current);
}

module.exports = {
  readMembers,
  readAllowedEmails,
  getMember,
  writeMembers,
  roleOf,
  checkAndBindDevice,
  resetDevice,
  normalizeMembers,
  __setBlobForTests
};
