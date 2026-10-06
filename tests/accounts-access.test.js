"use strict";
process.env.ADMIN_EMAIL = "admin@example.com";
process.env.SESSION_SECRET = "unit-test-secret-unit-test-secret";
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers");
const store = require("../api/_lib/store");
const sessionApi = require("../api/session");
const adminApi = require("../api/admin-emails");

let blob, restore;
test.beforeEach(() => { restore && restore(); restore = H.installFakeFetch({}); blob = H.fakeBlob(); store.__setBlobForTests(blob); });
const call = async (handler, method, opts) => { const res = H.fakeRes(); await handler(H.fakeReq(method, opts), res); return res; };
const cookieOf = (res) => { const c = res.headers["set-cookie"]; return (Array.isArray(c) ? c : [c || ""]).map((x) => x.split(";")[0]).join("; "); };
const login = async (email) => { const res = await call(sessionApi, "POST", { headers: H.CSRF, body: { idToken: H.mintIdToken({ email }) } }); return { res, cookie: cookieOf(res) }; };

test("trustee WITHOUT access: old Accounts page unchanged, but none of the 4 options are sent", async () => {
  blob.store.data = JSON.stringify([{ email: "t@example.com", role: "trustee" }]);
  const { res } = await login("t@example.com");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.entryAllowed, false);
  assert.deepEqual(res.body.site.entry, []);
  assert.equal(res.body.site.accounts.length, 4); // Income-Expense Entry, Zone Quarterly, Dashboard, Service/Name/Place sheet
  assert.equal(res.body.site.accounts[0].page, "accounts-entry");
  assert.ok(res.body.site.quick.some((i) => i.dash)); // home Dashboard tile unchanged
  const all = JSON.stringify(res.body);
  for (const k of ["1PntgAmlwn3GGfBLl6vhHAVWU7m_xuTYEqEkoDKfdgqM", "17R5GLj8M9w840ftyRO6ZcyaDeqO0DOco", "1FAIpQLSenlGdJSJFREnT90Tm5Y0nBfQqgIQ3oM7QmAeoNe_I3affLWA"]) assert.ok(!all.includes(k), k + " leaked");
});
test("trustee WITH access gets the 4 options; admin always does", async () => {
  blob.store.data = JSON.stringify([{ email: "t@example.com", role: "trustee", accounts: true }]);
  const t = (await login("t@example.com")).res.body;
  assert.equal(t.entryAllowed, true);
  assert.equal(t.site.entry.length, 4);
  assert.equal((await login("admin@example.com")).res.body.entryAllowed, true);
});
test("master never gets the options; admin can switch access on/off (survives login writes)", async () => {
  blob.store.data = JSON.stringify([{ email: "m@example.com", role: "master", accounts: true }, { email: "t@example.com", role: "trustee" }]);
  assert.equal((await login("m@example.com")).res.body.entryAllowed, false);
  const adm = (await login("admin@example.com")).cookie;
  const h = Object.assign({ cookie: adm }, H.CSRF);
  let r = await call(adminApi, "PATCH", { headers: h, query: { email: "t@example.com" }, body: { action: "set-accounts", allowed: true } });
  assert.equal(r.statusCode, 200);
  const t = await login("t@example.com");
  assert.equal(t.res.body.entryAllowed, true);
  r = await call(adminApi, "PATCH", { headers: h, query: { email: "t@example.com" }, body: { action: "set-accounts", allowed: false } });
  assert.equal(r.body.members.find((m) => m.email === "t@example.com").accounts, false);
  store.__setBlobForTests(blob);
  const g = await call(sessionApi, "GET", { headers: { cookie: t.cookie } });
  assert.equal(g.body.entryAllowed, false);
  assert.deepEqual(g.body.site.entry, []);
});
test("non-admin cannot grant access; re-adding a member keeps their access flag", async () => {
  blob.store.data = JSON.stringify([{ email: "t@example.com", role: "trustee", accounts: true }]);
  const t = await login("t@example.com");
  const bad = await call(adminApi, "PATCH", { headers: Object.assign({ cookie: t.cookie }, H.CSRF), query: { email: "t@example.com" }, body: { action: "set-accounts", allowed: false } });
  assert.equal(bad.statusCode, 403);
  const adm = (await login("admin@example.com")).cookie;
  const r = await call(adminApi, "POST", { headers: Object.assign({ cookie: adm }, H.CSRF), body: { email: "t@example.com", role: "trustee" } });
  assert.equal(r.body.members.find((m) => m.email === "t@example.com").accounts, true);
});
