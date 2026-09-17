const { put, get } = require('@vercel/blob');

// One stable private object for the allow-list.
const PATHNAME = 'data/allowed-emails.json';

function normalizeEmails(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(v => String(v || '').trim().toLowerCase()).filter(Boolean))];
}

async function readAllowedEmails() {
  try {
    // Vercel Blob's get() returns { stream, blob } for a private object.
    // Older code incorrectly expected result.statusCode === 200, which made
    // every successful read look empty and caused valid users to be rejected.
    const result = await get(PATHNAME, { access: 'private', useCache: false });
    if (!result || !result.stream) return [];
    const text = await new Response(result.stream).text();
    return normalizeEmails(JSON.parse(text));
  } catch (e) {
    // Optional deployment fallback. This keeps login usable if a Blob store
    // has not yet been attached. Set ALLOWED_EMAILS as comma/newline-separated
    // emails in Vercel if you want a static fallback.
    return normalizeEmails(String(process.env.ALLOWED_EMAILS || '').split(/[\n,]+/));
  }
}

async function writeAllowedEmails(emails) {
  await put(PATHNAME, JSON.stringify(normalizeEmails(emails)), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json'
  });
}

module.exports = { readAllowedEmails, writeAllowedEmails, normalizeEmails };
