const { verifyGoogleToken } = require('./_lib/verifyGoogleToken');
const { readAllowedEmails, writeAllowedEmails } = require('./_lib/store');
const { ADMIN_EMAIL, noStore } = require('./_lib/config');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tokenFromRequest(req) {
  if (req.method === 'GET') {
    const auth = req.headers && req.headers.authorization;
    return auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  }
  return req.body && req.body.idToken;
}

async function requireAdmin(req, res) {
  const idToken = tokenFromRequest(req);
  const email = await verifyGoogleToken(idToken);
  if (!email || email !== ADMIN_EMAIL) {
    noStore(res);
    res.status(403).json({ error: 'admin only' });
    return null;
  }
  return email;
}

module.exports = async (req, res) => {
  noStore(res);
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  try {
    if (req.method === 'GET') {
      const emails = await readAllowedEmails();
      // Always display the admin in the list, even on a fresh deployment.
      const result = [...new Set([ADMIN_EMAIL, ...emails])];
      res.status(200).json({ emails: result, adminEmail: ADMIN_EMAIL });
      return;
    }

    if (req.method === 'POST') {
      const target = String((req.body && req.body.email) || '').trim().toLowerCase();
      if (!EMAIL_RE.test(target)) {
        res.status(400).json({ error: 'invalid email' });
        return;
      }
      const emails = [...new Set([ADMIN_EMAIL, ...(await readAllowedEmails()), target])];
      await writeAllowedEmails(emails);
      res.status(200).json({ emails });
      return;
    }

    if (req.method === 'DELETE') {
      const target = String((req.body && req.body.email) || '').trim().toLowerCase();
      if (target === ADMIN_EMAIL) {
        res.status(400).json({ error: 'cannot remove admin' });
        return;
      }
      const emails = (await readAllowedEmails()).filter(e => e !== target);
      await writeAllowedEmails([ADMIN_EMAIL, ...emails]);
      res.status(200).json({ emails: [ADMIN_EMAIL, ...emails] });
      return;
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error('admin-emails error:', e && e.message ? e.message : e);
    res.status(500).json({ error: 'storage is not connected or could not be updated' });
  }
};
