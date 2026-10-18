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
    { title: "பில் தொகை", email: "office@example.com", upi: "trust@okbank", phone: "" },
    { title: "Only UPI", email: "", upi: "name@oksbi", phone: "" }
  ]);
});

test("pay rows: junk input never throws", () => {
  assert.deepEqual(cleanPay(null), []);
  assert.deepEqual(cleanPay([null, 5, {}]), []);
});

test("pay rows: phone numbers are normalised, a row with only a phone is kept, bad numbers are dropped", () => {
  const out = cleanPay([
    { title: "A", phone: 9876543210 },
    { title: "B", email: "b@x.com", phone: "+91 98765 43210" },
    { title: "C", email: "c@x.com", phone: "098765 43210" },
    { title: "D", email: "d@x.com", phone: "12345" },
    { title: "E", phone: "abc" }
  ]);
  assert.deepEqual(out.map((r) => [r.title, r.phone]), [["A", "919876543210"], ["B", "919876543210"], ["C", "919876543210"], ["D", ""]]);
});
