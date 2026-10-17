"use strict";
// Trustee PHOTO (only). GET /api/trustees?n=<sheet row>&v=<version>  -> the image.
// The photo is a Google Drive file whose link is written in the "அறங்காவலர்கள்" tab; the Apps Script reads it
// (the file may stay private) and sends a small thumbnail. Login is required; masters do not get trustee data.
const { authenticate } = require("./_lib/auth");
const { send } = require("./_lib/http");
const { allow } = require("./_lib/rateLimit");
const { callScript } = require("./_lib/seva");
const { PLACEHOLDER } = require("./_lib/trustees");

const KEEP_MS = 60 * 60 * 1000;
const cache = new Map(); // "n:v" -> { at, mime, buf }
const MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

module.exports = async (req, res) => {
  try {
    const s = await authenticate(req);
    if (!s) return send(res, 401, { error: "not logged in" });
    if (s.role === "master") return send(res, 403, { error: "forbidden" });
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return send(res, 405, { error: "method not allowed" });
    }
    if (!allow("tphoto:" + s.email, 120, 60 * 1000)) return send(res, 429, { error: "too many requests" });
    const q = req.query || {};
    const n = parseInt(q.n, 10);
    if (!Number.isInteger(n) || n < 2 || n > 300) return send(res, 400, { error: "bad request" });
    const v = String(q.v || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 16);
    const key = n + ":" + v;
    let hit = cache.get(key);
    if (!hit || Date.now() - hit.at > KEEP_MS) {
      try {
        const d = await callScript({ action: "photo", n });
        const mime = String((d && d.mime) || "");
        if (!d || !d.b64 || MIMES.indexOf(mime) < 0) throw new Error("no photo");
        hit = { at: Date.now(), mime, buf: Buffer.from(d.b64, "base64") };
        if (cache.size > 60) cache.clear();
        cache.set(key, hit);
      } catch (e) {
        if (!hit) {
          console.error("trustee photo failed:", e && e.message ? e.message : e);
          res.setHeader("Cache-Control", "no-store");
          res.statusCode = 302;
          res.setHeader("Location", PLACEHOLDER); // never a broken picture
          return res.end();
        }
      }
    }
    res.setHeader("Content-Type", hit.mime);
    res.setHeader("Cache-Control", "private, max-age=86400"); // a new photo link in the Sheet = a new URL (v), so it shows at once
    res.statusCode = 200;
    return res.end(hit.buf);
  } catch (e) {
    console.error("trustees photo error:", e && e.message ? e.message : e);
    return send(res, 500, { error: "server error" });
  }
};
