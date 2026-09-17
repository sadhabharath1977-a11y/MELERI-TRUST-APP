const { verifyGoogleToken } = require("./_lib/verifyGoogleToken");
const { readAllowedEmails, writeAllowedEmails } = require("./_lib/store");
const { ADMIN_EMAIL } = require("./_lib/config");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tokenFromRequest(req) {
  // GET requests send the token in an Authorization header (not a URL query
  // string) so it never ends up recorded in server/proxy access logs.
  if (req.method === "GET") {
    const auth = req.headers && req.headers.authorization;
    return auth && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  }
  return req.body && req.body.idToken;
}

async function requireAdmin(req, res) {
  const idToken = tokenFromRequest(req);
  const email = await verifyGoogleToken(idToken);
  if (!email || email !== ADMIN_EMAIL) {
    res.status(403).json({ error: "admin only" });
    return null;
  }
  return email;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    const emails = await readAllowedEmails();
    res.status(200).json({ emails, adminEmail: ADMIN_EMAIL });
    return;
  }

  if (req.method === "POST") {
    const target = String((req.body && req.body.email) || "").trim().toLowerCase();
    if (!EMAIL_RE.test(target)) {
      res.status(400).json({ error: "invalid email" });
      return;
    }
    const emails = await readAllowedEmails();
    if (!emails.includes(target)) {
      emails.push(target);
      await writeAllowedEmails(emails);
    }
    res.status(200).json({ emails });
    return;
  }

  if (req.method === "DELETE") {
    const target = String((req.body && req.body.email) || "").trim().toLowerCase();
    if (target === ADMIN_EMAIL) {
      res.status(400).json({ error: "cannot remove admin" });
      return;
    }
    const emails = (await readAllowedEmails()).filter((e) => e !== target);
    await writeAllowedEmails(emails);
    res.status(200).json({ emails });
    return;
  }

  res.status(405).json({ error: "method not allowed" });
};
