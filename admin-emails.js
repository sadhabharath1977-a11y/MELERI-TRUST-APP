"use strict";
// Admin only: list / add / remove members, each with a role ("trustee" or "master").
const { ADMIN_EMAIL } = require("./_lib/config");
const { authenticate } = require("./_lib/auth");
const { readMembers, writeMembers } = require("./_lib/store");
const { noStore, send, csrfOk } = require("./_lib/http");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAILS = 500;

function emailFrom(req) {
  const fromQuery = req.query && req.query.email;
  const fromBody = req.body && req.body.email;
  return String(fromQuery || fromBody || "").trim().toLowerCase();
}
function roleFrom(req) {
  const r = (req.body && req.body.role) || (req.query && req.query.role);
  return r === "master" ? "master" : "trustee";
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
      const members = await readMembers({ fresh: true });
      return send(res, 200, { members, adminEmail: ADMIN_EMAIL });
    }

    if (req.method === "POST") {
      const target = emailFrom(req);
      const role = roleFrom(req);
      if (!EMAIL_RE.test(target) || target.length > 254) return send(res, 400, { error: "invalid email" });
      if (target === ADMIN_EMAIL) return send(res, 400, { error: "already admin" });
      const current = await readMembers({ fresh: true });
      if (current.length >= MAX_EMAILS) return send(res, 400, { error: "list is full" });
      const next = [...current.filter((m) => m.email !== target), { email: target, role }];
      await writeMembers(next);
      console.log(JSON.stringify({ audit: "member-added", by: s.email, target, role }));
      return send(res, 200, { members: next });
    }

    if (req.method === "DELETE") {
      const target = emailFrom(req);
      if (target === ADMIN_EMAIL) return send(res, 400, { error: "cannot remove admin" });
      const current = await readMembers({ fresh: true });
      const next = current.filter((m) => m.email !== target);
      await writeMembers(next);
      console.log(JSON.stringify({ audit: "member-removed", by: s.email, target }));
      return send(res, 200, { members: next });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return send(res, 405, { error: "method not allowed" });
  } catch (e) {
    console.error("admin-emails error:", e && e.message ? e.message : e);
    return send(res, 500, { error: "storage is not connected or could not be updated" });
  }
};
