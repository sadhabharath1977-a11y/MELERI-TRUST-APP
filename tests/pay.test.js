"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanPay } = require("../api/_lib/pay");

test("pay rows: good rows pass, bad e-mail / UPI are dropped, rows with neither are removed", () => {
  const out = cleanPay([
    { title: "  பில் தொகை  ", email: "Office@Example.com", upi: "trust @okbank" },
    { title: "Only UPI", email: "not-an-email", upi: "name@oksbi" },
    { title: "Nothing valid", email: "x", upi: "y" },
    { title: "", email: "a@b.co", upi: "a@b" },
    { title: "Script", email: 'a"><script>@x.com', upi: "javascript:alert(1)@x" }
  ]);
  assert.deepEqual(out, [
    { title: "பில் தொகை", email: "office@example.com", upi: "trust@okbank" },
    { title: "Only UPI", email: "", upi: "name@oksbi" }
  ]);
});

test("pay rows: junk input never throws", () => {
  assert.deepEqual(cleanPay(null), []);
  assert.deepEqual(cleanPay([null, 5, {}]), []);
});
