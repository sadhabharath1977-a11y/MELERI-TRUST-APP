"use strict";
// Service record. Every logged-in member (trustees, masters, admin).
//   GET  /api/service?year=2026  -> { year, years, services, names, places, agg, recent }
//   POST /api/service            -> { date, name, place, ids:[serviceId,...] }  (one row per service in the Sheet)
const { ADMIN_EMAIL } = require("./_lib/config");
const { authenticate } = require("./_lib/auth");
const { send, csrfOk, noStore } = require("./_lib/http");
const { allow } = require("./_lib/rateLimit");
const { callScript } = require("./_lib/seva");

let cache = {};
module.exports = async (req, res) => {
  noStore(res);
  if (!ADMIN_EMAIL) return send(res, 500, { error: "config", detail: "ADMIN_EMAIL" });
  try {
    const s = await authenticate(req);
    if (!s) return send(res, 401, { error: "not logged in" });
    if (req.method === "GET") {
      const q = String((req.query && req.query.year) || "");
      const year = /^\d{4}$/.test(q) ? q : "";
      const c = cache[year];
      if (c && Date.now() - c.at < 20000) return send(res, 200, c.data);
      const data = await callScript({ action: "data", year });
      cache[year] = { at: Date.now(), data };
      return send(res, 200, data);
    }
    if (req.method === "POST") {
      if (!csrfOk(req)) return send(res, 403, { error: "bad request origin" });
      if (!allow("seva:" + s.email, 30, 60 * 1000)) return send(res, 429, { error: "too many requests" });
      const b = req.body || {};
      const out = await callScript({ action: "add", date: b.date, name: b.name, place: b.place, ids: Array.isArray(b.ids) ? b.ids.slice(0, 20) : [], by: s.email });
      cache = {};
      return send(res, 200, out);
    }
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "method not allowed" });
  } catch (e) {
    if (e && e.status === 400) return send(res, 400, { error: e.message });
    console.error("service error:", e && e.message ? e.message : e);
    return send(res, 502, { error: "service unavailable" });
  }
};
