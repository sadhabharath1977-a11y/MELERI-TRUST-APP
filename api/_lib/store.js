"use strict";
// Allowed-member list, stored as one private object in Vercel Blob.
// Each member is { email, role }. role is "trustee" (default) or "master" (ஆசிரியர்கள்/masters).
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

let cache = { at: 0, list: null }; // list = array of { email, role }

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
    out.push({ email, role: isObj && raw.role === "master" ? "master" : "trustee" });
  }
  return out;
}

function envFallback() {
  return normalizeMembers(String(process.env.ALLOWED_EMAILS || "").split(/[\n,]+/));
}

// opts.fresh = true bypasses the cache (used by the admin screens and before every write).
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

async function roleOf(email, opts) {
  const m = (await readMembers(opts)).find((x) => x.email === email);
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

module.exports = { readMembers, readAllowedEmails, writeMembers, roleOf, normalizeMembers, __setBlobForTests };
