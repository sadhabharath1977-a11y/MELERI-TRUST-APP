"use strict";
// Pay & send details. Every logged-in member (trustees, masters, admin).
//   GET /api/pay -> { items: [{ title, email, upi }] }   (read from the "செலுத்துதல்" tab of the Sheet)
const { ADMIN_EMAIL } = require("./_lib/config");
const { authenticate } = require("./_lib/auth");
const { send, noStore } = require("./_lib/http");
const { callScript } = require("./_lib/seva");
const { cleanPay } = require("./_lib/pay");

let good = null; // { at, items }
module.exports = async (req, res) => {
  noStore(res);
  if (!ADMIN_EMAIL) return send(res, 500, { error: "config", detail: "ADMIN_EMAIL" });
  try {
    const s = await authenticate(req);
    if (!s) return send(res, 401, { error: "not logged in" });
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return send(res, 405, { error: "method not allowed" });
    }
    if (good && Date.now() - good.at < 60000) return send(res, 200, { items: good.items });
    try {
      const data = await callScript({ action: "pay" });
      if (!data || !Array.isArray(data.items)) throw new Error("old script: no pay action");
      good = { at: Date.now(), items: cleanPay(data.items) };
      return send(res, 200, { items: good.items });
    } catch (e) {
      if (good) return send(res, 200, { items: good.items }); // Sheet is slow right now: show the last good copy
      throw e;
    }
  } catch (e) {
    console.error("pay error:", e && e.message ? e.message : e);
    return send(res, 502, { error: "pay unavailable" });
  }
};
