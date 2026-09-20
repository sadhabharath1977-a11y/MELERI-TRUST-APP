"use strict";
// One endpoint for the whole login lifecycle AND the data the app needs after login:
//   GET    /api/session  -> is the cookie still valid?  returns { email, isAdmin, trustees, site }
//   POST   /api/session  -> exchange a Google ID token for a login cookie (same response)
//   DELETE /api/session  -> log out (clears the cookie)
// Previously the app made 2-3 separate calls (verify-access, trustees, admin-emails), each of which
// re-verified the token with Google and re-read the Blob store.
const { ADMIN_EMAIL } = require("./_lib/config");
const { verifyGoogleToken } = require("./_lib/googleAuth");
const { isAllowed, authenticate } = require("./_lib/auth");
const { setSessionCookie, clearSessionCookie } = require("./_lib/token");
const { noStore, send, clientIp, csrfOk } = require("./_lib/http");
const { allow } = require("./_lib/rateLimit");
const { TRUSTEES } = require("./_lib/trustees-data");
const { SITE } = require("./_lib/site-data");

function bootstrap(s) {
  return { authenticated: true, email: s.email, isAdmin: s.isAdmin, trustees: TRUSTEES, site: SITE };
}

module.exports = async (req, res) => {
  noStore(res);
  if (!ADMIN_EMAIL) {
    console.error("ADMIN_EMAIL environment variable is not set");
    return send(res, 500, { error: "config", detail: "ADMIN_EMAIL" });
  }
  try {
    if (req.method === "GET") {
      const s = await authenticate(req);
      if (!s) return send(res, 401, { authenticated: false });
      return send(res, 200, bootstrap(s));
    }

    if (req.method === "POST") {
      if (!csrfOk(req)) return send(res, 403, { error: "bad request origin" });
      if (!allow("login:" + clientIp(req), 20, 60 * 1000)) return send(res, 429, { error: "too many attempts" });
      const email = await verifyGoogleToken(req.body && req.body.idToken);
      if (!email) return send(res, 401, { allowed: false, error: "invalid or expired google token" });
      if (!(await isAllowed(email, { fresh: true }))) return send(res, 403, { allowed: false, email });
      setSessionCookie(res, email);
      return send(res, 200, bootstrap({ email, isAdmin: email === ADMIN_EMAIL }));
    }

    if (req.method === "DELETE") {
      if (!csrfOk(req)) return send(res, 403, { error: "bad request origin" });
      clearSessionCookie(res);
      return send(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return send(res, 405, { error: "method not allowed" });
  } catch (e) {
    console.error("session error:", e && e.message ? e.message : e);
    return send(res, 500, { error: "server error" });
  }
};
