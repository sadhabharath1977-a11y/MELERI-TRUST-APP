"use strict";
// Service statistics (from the published Google Sheet), cached on the server. Login required.
const { ADMIN_EMAIL } = require("./_lib/config");
const { authenticate } = require("./_lib/auth");
const { getStats } = require("./_lib/stats");
const { send } = require("./_lib/http");

module.exports = async (req, res) => {
  if (!ADMIN_EMAIL) return send(res, 500, { error: "config", detail: "ADMIN_EMAIL" });
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { error: "method not allowed" });
  }
  try {
    const s = await authenticate(req);
    if (!s) {
      res.setHeader("Cache-Control", "no-store");
      return send(res, 401, { error: "not logged in" });
    }
    const data = await getStats();
    // Private (never shared/CDN) but reusable by the browser for a minute.
    res.setHeader("Cache-Control", "private, max-age=15");
    return send(res, 200, data);
  } catch (e) {
    console.error("stats error:", e && e.message ? e.message : e);
    res.setHeader("Cache-Control", "no-store");
    return send(res, 502, { error: "stats unavailable" });
  }
};
