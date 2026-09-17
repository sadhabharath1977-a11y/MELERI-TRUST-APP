// Single source of truth for the admin email.
// You can override this without touching code by setting an
// ADMIN_EMAIL environment variable in your Vercel project settings.
// If you don't set one, it falls back to the value below (same as before).
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "meleriskyyoga262@gmail.com").toLowerCase();

module.exports = { ADMIN_EMAIL };
