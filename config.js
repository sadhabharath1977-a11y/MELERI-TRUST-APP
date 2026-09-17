// Single source of truth for the admin email.
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'meleriskyyoga262@gmail.com').trim().toLowerCase();

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

module.exports = { ADMIN_EMAIL, noStore };
