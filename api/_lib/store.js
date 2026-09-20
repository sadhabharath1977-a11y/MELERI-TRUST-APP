"use strict";
// Allowed-member list, stored as one private object in Vercel Blob.
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

let cache = { at: 0, list: null };

function normalizeEmails(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean))];
}

function envFallback() {
  return normalizeEmails(String(process.env.ALLOWED_EMAILS || "").split(/[\n,]+/));
}

// opts.fresh = true bypasses the cache (used by the admin screens and before every write).
async function readAllowedEmails(opts) {
  const fresh = opts && opts.fresh;
  if (!fresh && cache.list && Date.now() - cache.at < CACHE_MS) return cache.list;
  let list;
  let failed = false;
  try {
    const result = await blob().get(PATHNAME, { access: "private", useCache: false });
    if (!result || !result.stream) {
      list = envFallback(); // store exists but the list has not been created yet
    } else {
      list = normalizeEmails(JSON.parse(await new Response(result.stream).text()));
    }
  } catch (e) {
    failed = true;
    console.error("readAllowedEmails:", e && e.message ? e.message : e);
    list = envFallback(); // fail closed: only the env fallback (and the admin) can enter
  }
  // Errors are cached only briefly so the app recovers quickly when Blob comes back.
  cache = { at: failed ? Date.now() - CACHE_MS + 10000 : Date.now(), list };
  return list;
}

async function writeAllowedEmails(emails) {
  const list = normalizeEmails(emails);
  await blob().put(PATHNAME, JSON.stringify(list), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
  cache = { at: Date.now(), list };
  return list;
}

module.exports = { readAllowedEmails, writeAllowedEmails, normalizeEmails, __setBlobForTests };
