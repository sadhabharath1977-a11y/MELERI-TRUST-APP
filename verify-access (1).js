const { verifyGoogleToken } = require('./_lib/verifyGoogleToken');
const { readAllowedEmails } = require('./_lib/store');
const { ADMIN_EMAIL, noStore } = require('./_lib/config');

module.exports = async (req, res) => {
  noStore(res);
  if (req.method !== 'POST') {
    res.status(405).json({ allowed: false, error: 'method not allowed' });
    return;
  }
  try {
    const { idToken } = req.body || {};
    const email = await verifyGoogleToken(idToken);
    if (!email) {
      res.status(401).json({ allowed: false, error: 'google token invalid or expired' });
      return;
    }

    const emails = await readAllowedEmails();
    // The configured admin is always allowed to enter, even when the Blob
    // allow-list has not been created yet. The admin can then add trustees.
    const allowed = email === ADMIN_EMAIL || emails.includes(email);
    res.status(200).json({ allowed, isAdmin: email === ADMIN_EMAIL, email });
  } catch (e) {
    console.error('verify-access error:', e && e.message ? e.message : e);
    res.status(500).json({ allowed: false, error: 'server verification error' });
  }
};
