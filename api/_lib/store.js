const { put, get } = require("@vercel/blob");

const PATHNAME = "data/allowed-emails.json";

async function readAllowedEmails() {
  try {
    const result = await get(PATHNAME, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return [];
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

async function writeAllowedEmails(emails) {
  await put(PATHNAME, JSON.stringify(emails), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
}

module.exports = { readAllowedEmails, writeAllowedEmails };
