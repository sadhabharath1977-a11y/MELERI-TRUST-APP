const { verifyGoogleToken } = require("./_lib/verifyGoogleToken");
const { readAllowedEmails } = require("./_lib/store");
const { ADMIN_EMAIL } = require("./_lib/config");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  try {
    const { idToken } = req.body || {};
    const email = await verifyGoogleToken(idToken);
    if (!email) {
      res.status(401).json({ allowed: false });
      return;
    }
    const emails = await readAllowedEmails();
    const allowed = emails.includes(email);
    res.status(200).json({ allowed, isAdmin: allowed && email === ADMIN_EMAIL, email });
  } catch (e) {
    res.status(500).json({ error: "server error" });
  }
};
