"use strict";
// Trustee list (name, role, WhatsApp number, photo, folder).
// Source of truth = the "அறங்காவலர்கள்" tab of the Google Sheet (read through the same Apps Script web app
// that the service record uses). If the tab / script is not ready or does not answer, the built-in list in
// trustees-data.js is used instead, so the Trustees page can never go blank.
const { TRUSTEES: BUILTIN } = require("./trustees-data");
const { SERVICE_SCRIPT_URL, SERVICE_SCRIPT_KEY } = require("./config");
const { callScript } = require("./seva");

const FRESH_MS = 60 * 1000;      // reuse the last good list for 1 minute
const FAIL_PAUSE_MS = 30 * 1000; // after a failure, do not retry for 30 s (the page must stay quick)
const WAIT_MS = 4500;
const PLACEHOLDER = "/icons/icon-192.png";

let good = null;   // { at, list }
let failedAt = 0;

const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
const builtinPhoto = {};
BUILTIN.forEach((t) => { builtinPhoto[norm(t.name)] = t.img; });

function fromSheet(rows) {
  const out = [];
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    const name = String((r && r.name) || "").trim();
    if (!name) return;
    const n = Number(r.n);
    const phone = String(r.phone || "").replace(/\D/g, "");
    let img = builtinPhoto[norm(name)] || PLACEHOLDER; // no photo link in the Sheet -> the old built-in photo (same name) or the logo
    if (r.photo && Number.isInteger(n) && n >= 2 && n <= 300) {
      img = "/api/trustees?n=" + n + "&v=" + String(r.photo).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 16);
    }
    out.push({ img, name, role: String(r.role || "").trim(), folder: String(r.folder || "").trim(), phone });
  });
  return out;
}

async function getTrustees() {
  if (!SERVICE_SCRIPT_URL || !SERVICE_SCRIPT_KEY) return BUILTIN;
  const now = Date.now();
  if (good && now - good.at < FRESH_MS) return good.list;
  if (now - failedAt < FAIL_PAUSE_MS) return good ? good.list : BUILTIN;
  try {
    let timer;
    const data = await Promise.race([
      callScript({ action: "trustees" }),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("trustees timeout")), WAIT_MS); })
    ]).finally(() => clearTimeout(timer));
    if (!data || !Array.isArray(data.trustees)) throw new Error("trustees: old script");
    const list = fromSheet(data.trustees);
    if (!list.length) throw new Error("trustees: empty tab");
    good = { at: Date.now(), list };
    failedAt = 0;
    return list;
  } catch (e) {
    failedAt = Date.now();
    console.error("trustees from sheet failed (using last good / built-in list):", e && e.message ? e.message : e);
    return good ? good.list : BUILTIN;
  }
}

function _reset() { good = null; failedAt = 0; }
module.exports = { getTrustees, fromSheet, PLACEHOLDER, _reset };
