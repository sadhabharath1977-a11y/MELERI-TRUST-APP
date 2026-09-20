"use strict";
// Best-effort, per-instance rate limiter (in memory). It slows down brute-force attempts on the
// login endpoint. For a hard, global limit also add a rule in Vercel Firewall (see SETUP-TA.txt).
const buckets = new Map();

function allow(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { n: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.n += 1;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
  return b.n <= limit;
}

function _resetForTests() {
  buckets.clear();
}

module.exports = { allow, _resetForTests };
