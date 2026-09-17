// SIMPLE VERSION: The allowed list is a fixed list of 12 trustee emails,
// written directly in code below. No Vercel Blob store is needed at all,
// so there is nothing to misconfigure and no "server verification" errors
// caused by storage. To add/remove a person, just edit the list below and
// redeploy (upload the changed file to GitHub).

const ALLOWED_EMAILS = [
  "vivekanandanb1963@gmail.com",
  "venuthami@gmail.com",
  "vayyapurim@gmail.com",
  "umayoga2019@gmail.com",
  "narayanan1982v@gmail.com",
  "thangaraj9687@gmail.com",
  "venkatesanvvv1987@gmail.com",
  "muraliprabhuranji@gmail.com",
  "jmk20786@gmail.com",
  "menakaiarul2@gmail.com",
  "vsbfinesolutions@gmail.com",
  "meleriskyyoga262@gmail.com"
];

function normalizeEmails(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(v => String(v || "").trim().toLowerCase()).filter(Boolean))];
}

async function readAllowedEmails() {
  return normalizeEmails(ALLOWED_EMAILS);
}

// Kept only so admin-emails.js does not crash if it is ever called.
// It does NOT persist anywhere -- edit the ALLOWED_EMAILS list above instead.
async function writeAllowedEmails() {
  return;
}

module.exports = { readAllowedEmails, writeAllowedEmails, normalizeEmails };
