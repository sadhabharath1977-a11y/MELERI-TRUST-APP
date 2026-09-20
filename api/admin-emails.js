"use strict";
// Admin only: list / add / remove allowed e-mail addresses.
const { ADMIN_EMAIL } = require("./_lib/config");
const { authenticate } = require("./_lib/auth");
const { readAllowedEmails, writeAllowedEmails } = require("./_lib/store");
const { noStore, send, csrfOk } = require("./_lib/http");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAILS = 500;

function emailFrom(req) {
  const fromQuery = req.query && req.query.email;
  const fromBody = req.body && req.body.email;
  return String(fromQuery || fromBody || "").trim().toLowerCase();
}

module.exports = async (req, res) => {
  noStore(res);
  if (!ADMIN_EMAIL) return send(res, 500, { error: "config", detail: "ADMIN_EMAIL" });
  try {
    const s = await authenticate(req);
    if (!s) return send(res, 401, { error: "not logged in" }); // lets the app return to the login screen
    if (!s.isAdmin) return send(res, 403, { error: "admin only" });

    if (req.method !== "GET" && !csrfOk(req)) return send(res, 403, { error: "bad request origin" });

    // Always start from a fresh read so two admins cannot overwrite each other with stale data.
    if (req.method === "GET") {
      const emails = await readAllowedEmails({ fresh: true });
      return send(res, 200, { emails: [...new Set([ADMIN_EMAIL, ...emails])], adminEmail: ADMIN_EMAIL });
    }

    if (req.method === "POST") {
      const target = emailFrom(req);
      if (!EMAIL_RE.test(target) || target.length > 254) return send(res, 400, { error: "invalid email" });
      const current = await readAllowedEmails({ fresh: true });
      if (current.length >= MAX_EMAILS) return send(res, 400, { error: "list is full" });
      const next = [...new Set([ADMIN_EMAIL, ...current, target])];
      await writeAllowedEmails(next);
      console.log(JSON.stringify({ audit: "email-added", by: s.email, target }));
      return send(res, 200, { emails: next });
    }

    if (req.method === "DELETE") {
      const target = emailFrom(req);
      if (target === ADMIN_EMAIL) return send(res, 400, { error: "cannot remove admin" });
      const current = await readAllowedEmails({ fresh: true });
      const next = [...new Set([ADMIN_EMAIL, ...current.filter((e) => e !== target)])];
      await writeAllowedEmails(next);
      console.log(JSON.stringify({ audit: "email-removed", by: s.email, target }));
      return send(res, 200, { emails: next });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return send(res, 405, { error: "method not allowed" });
  } catch (e) {
    console.error("admin-emails error:", e && e.message ? e.message : e);
    return send(res, 500, { error: "storage is not connected or could not be updated" });
  }
};
