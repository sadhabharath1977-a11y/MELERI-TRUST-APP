"use strict";
// One endpoint for the whole login lifecycle AND the data the app needs after login:
//   GET    /api/session  -> is the cookie still valid (and still on the bound device)?  returns { email, isAdmin, role, trustees, site }
//   POST   /api/session  -> exchange a Google ID token for a login cookie (same response)
//   DELETE /api/session  -> log out (clears the login cookie only; the device stays remembered)
// Previously the app made 2-3 separate calls (verify-access, trustees, admin-emails), each of which
// re-verified the token with Google and re-read the Blob store.
//
// One-device rule: each non-admin email is locked to the first device it logs in from (its device
// cookie). A login attempt from a second device is rejected with 409 until an admin resets it.
const { ADMIN_EMAIL } = require("./_lib/config");
const { verifyGoogleToken } = require("./_lib/googleAuth");
const { isAllowed, authenticate } = require("./_lib/auth");
const { checkAndBindDevice } = require("./_lib/store");
const { readDeviceId, newDeviceId, setAuthCookies, clearSessionCookie } = require("./_lib/token");
const { noStore, send, clientIp, csrfOk } = require("./_lib/http");
const { allow } = require("./_lib/rateLimit");
const { TRUSTEES } = require("./_lib/trustees-data");
const { SITE, MASTER_SITE } = require("./_lib/site-data");

function bootstrap(s) {
  const base = { authenticated: true, email: s.email, isAdmin: s.isAdmin, role: s.role };
  // Admin always gets the full (trustee) view plus the master view, to preview/switch client-side.
  if (s.isAdmin) return { ...base, trustees: TRUSTEES, site: SITE, masterSite: MASTER_SITE };
  if (s.role === "master") return { ...base, trustees: [], site: MASTER_SITE };
  return { ...base, trustees: TRUSTEES, site: SITE };
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

      const isAdmin = email === ADMIN_EMAIL;
      if (isAdmin) {
        // Admin is exempt from the one-device lock; no device cookie needed for them.
        setAuthCookies(res, email, null, false);
        return send(res, 200, bootstrap({ email, isAdmin: true, role: "admin" }));
      }

      const existingDeviceId = readDeviceId(req);
      const deviceId = existingDeviceId || newDeviceId();
      const bind = await checkAndBindDevice(email, deviceId);
      if (!bind.ok) {
        if (bind.other) {
          console.log(JSON.stringify({ audit: "device-locked-out", email }));
          return send(res, 409, { allowed: false, error: "device-locked", email });
        }
        return send(res, 403, { allowed: false, email }); // isAllowed said yes but member vanished between the two reads - very rare
      }
      setAuthCookies(res, email, deviceId, !existingDeviceId);
      return send(res, 200, bootstrap({ email, isAdmin: false, role: bind.role }));
    }

    if (req.method === "DELETE") {
      if (!csrfOk(req)) return send(res, 403, { error: "bad request origin" });
      clearSessionCookie(res); // the device cookie is left alone on purpose - re-login from the same phone must not need an admin reset
      return send(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return send(res, 405, { error: "method not allowed" });
  } catch (e) {
    console.error("session error:", e && e.message ? e.message : e);
    return send(res, 500, { error: "server error" });
  }
};
