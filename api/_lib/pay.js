"use strict";
// "Pay & send details" rows from the Sheet tab: { title, email, upi }. Everything is re-checked here, so a typo
// in the Sheet can never put a strange link or script into the app.
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const UPI_RE = /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,40}$/;

function cleanPay(rows) {
  const out = [];
  (Array.isArray(rows) ? rows : []).slice(0, 30).forEach((r) => {
    const title = String((r && r.title) || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!title) return;
    const email = String((r && r.email) || "").trim().toLowerCase();
    const upi = String((r && r.upi) || "").replace(/\s+/g, "").trim();
    const item = { title, email: EMAIL_RE.test(email) ? email : "", upi: UPI_RE.test(upi) ? upi : "" };
    if (item.email || item.upi) out.push(item);
  });
  return out;
}

module.exports = { cleanPay };
