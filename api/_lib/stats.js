"use strict";
// Service-statistics sheet -> compact JSON. Parsed on the server, cached for a couple of minutes
// and shared by all users, so the browser no longer downloads and parses the Google Sheet itself.
const { parseCSV } = require("./csv");
const { STATS_CSV_URL } = require("./config");

const CACHE_MS = 2 * 60 * 1000;
let cache = { at: 0, data: null };
let inflight = null;

// The first cell of the sheet doubles as an on/off switch: text starting with "OFF" means the
// accounts are being updated and the dashboard should not be opened.
function parseStats(text) {
  const clean = String(text || "").replace(/^\uFEFF/, "");
  const open = !clean.trim().toUpperCase().startsWith("OFF");
  const rows = parseCSV(clean);
  const headerIdx = rows.findIndex((r) => r.some((c) => c.includes("பிரிவு")));
  if (headerIdx < 0) return { open, labels: [], total: null, year: null };
  const header = rows[headerIdx];
  const body = rows.slice(headerIdx + 1);
  const totalRow = body.find((r) => r[0] && r[0].includes("இதுவரை"));
  const yearRow = body.find((r) => r[0] && (r[0].includes("இந்த ஆண்டு") || r[0].includes("நடப்பாண்டு")));
  const cols = [];
  for (let i = 1; i < header.length; i++) if (header[i]) cols.push(i);
  const pick = (row) => (row ? cols.map((i) => row[i] || "0") : null);
  return { open, labels: cols.map((i) => header[i]), total: pick(totalRow), year: pick(yearRow) };
}

async function fetchStats() {
  const url = STATS_CSV_URL + (STATS_CSV_URL.includes("?") ? "&" : "?") + "_=" + Date.now();
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error("sheet fetch failed: " + r.status);
  return parseStats(await r.text());
}

async function getStats() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (!inflight) {
    inflight = fetchStats()
      .then((data) => {
        cache = { at: Date.now(), data };
        return data;
      })
      .catch((e) => {
        if (cache.data) return cache.data; // serve the last good copy if Google is unreachable
        throw e;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

function _resetForTests() {
  cache = { at: 0, data: null };
  inflight = null;
}

module.exports = { getStats, parseStats, _resetForTests };
