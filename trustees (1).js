const { verifyGoogleToken } = require('./_lib/verifyGoogleToken');
const { readAllowedEmails } = require('./_lib/store');
const { ADMIN_EMAIL, noStore } = require('./_lib/config');
const { TRUSTEES } = require('./_lib/trustees-data');

module.exports = async (req, res) => {
  noStore(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  try {
    const { idToken } = req.body || {};
    const email = await verifyGoogleToken(idToken);
    if (!email) {
      res.status(401).json({ error: 'not logged in' });
      return;
    }
    const emails = await readAllowedEmails();
    if (email !== ADMIN_EMAIL && !emails.includes(email)) {
      res.status(403).json({ error: 'not allowed' });
      return;
    }
    res.status(200).json({ trustees: TRUSTEES });
  } catch (e) {
    res.status(500).json({ error: 'server error' });
  }
};
