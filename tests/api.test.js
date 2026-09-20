"use strict";
process.env.ADMIN_EMAIL = "Admin@Example.com"; // deliberately mixed case: must be normalised
process.env.SESSION_SECRET = "unit-test-secret-unit-test-secret";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const H = require("./helpers");

const { verifyGoogleToken, _resetKeyCacheForTests } = require("../api/_lib/googleAuth");
const token = require("../api/_lib/token");
const store = require("../api/_lib/store");
const { parseCSV } = require("../api/_lib/csv");
const stats = require("../api/_lib/stats");
const rate = require("../api/_lib/rateLimit");
const sessionApi = require("../api/session");
const adminApi = require("../api/admin-emails");
const statsApi = require("../api/stats");

const fetchState = {};
let restoreFetch;
let blob;
test.beforeEach(() => {
  restoreFetch && restoreFetch();
  Object.keys(fetchState).forEach((k) => delete fetchState[k]);
  restoreFetch = H.installFakeFetch(fetchState);
  _resetKeyCacheForTests();
  stats._resetForTests();
  rate._resetForTests();
  blob = H.fakeBlob();
  store.__setBlobForTests(blob);
});

const call = async (handler, method, opts) => {
  const res = H.fakeRes();
  await handler(H.fakeReq(method, opts), res);
  return res;
};
const cookieOf = (res) => (res.headers["set-cookie"] || "").split(";")[0];
const login = async (email) => {
  const res = await call(sessionApi, "POST", { headers: H.CSRF, body: { idToken: H.mintIdToken({ email }) } });
  return { res, cookie: cookieOf(res) };
};

// ---------- Google token verification ----------
test("valid Google token -> lower-cased e-mail", async () => {
  assert.equal(await verifyGoogleToken(H.mintIdToken({ email: "User@Example.com" })), "user@example.com");
});
test("keys are downloaded once and cached", async () => {
  await verifyGoogleToken(H.mintIdToken({ email: "a@b.co" }));
  await verifyGoogleToken(H.mintIdToken({ email: "a@b.co" }));
  assert.equal(fetchState.calls.filter((u) => u.includes("oauth2/v3/certs")).length, 1);
});
test("rejects: wrong audience, expired, unverified e-mail, wrong issuer", async () => {
  assert.equal(await verifyGoogleToken(H.mintIdToken({ email: "a@b.co", aud: "someone-else" })), null);
  const past = Math.floor(Date.now() / 1000) - 7200;
  assert.equal(await verifyGoogleToken(H.mintIdToken({ email: "a@b.co", iat: past - 3600, exp: past })), null);
  assert.equal(await verifyGoogleToken(H.mintIdToken({ email: "a@b.co", email_verified: false })), null);
  assert.equal(await verifyGoogleToken(H.mintIdToken({ email: "a@b.co", iss: "https://evil.example" })), null);
});
test("rejects: forged signature, unknown key id, garbage", async () => {
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  assert.equal(await verifyGoogleToken(H.mintIdToken({ email: "a@b.co" }, { key: other })), null);
  assert.equal(await verifyGoogleToken(H.mintIdToken({ email: "a@b.co" }, { kid: "nope" })), null);
  for (const bad of [null, undefined, "", "a.b", "a.b.c", 42, "x".repeat(5000)]) assert.equal(await verifyGoogleToken(bad), null);
});
test("alg=none / HS256 tokens are rejected", async () => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: "accounts.google.com", aud: H.CLIENT_ID, exp: now + 999, email: "a@b.co", email_verified: true };
  assert.equal(await verifyGoogleToken(b({ alg: "none", kid: H.KID }) + "." + b(payload) + "."), null);
  assert.equal(await verifyGoogleToken(b({ alg: "HS256", kid: H.KID }) + "." + b(payload) + ".AAAA"), null);
});

// ---------- session cookie ----------
test("session token: round trip, tamper, expiry", () => {
  const t = token.sign("a@b.co");
  assert.equal(token.verify(t), "a@b.co");
  const [p, m] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ e: "admin@example.com", x: 9999999999 })).toString("base64url");
  assert.equal(token.verify(forged + "." + m), null);
  assert.equal(token.verify(p + "." + m.slice(0, -2) + "AA"), null);
  assert.equal(token.verify(token.sign("a@b.co", Date.now() - 8 * 24 * 3600 * 1000)), null);
  assert.equal(token.verify("garbage"), null);
});

// ---------- CSV / stats ----------
test("CSV parser handles quotes, commas, newlines, BOM", () => {
  assert.deepEqual(parseCSV('\uFEFFa,"1,250","he said ""hi"""\r\nb,"x\ny",3\n\n'), [["a", "1,250", 'he said "hi"'], ["b", "x\ny", "3"]]);
});
test("stats parsing: header/total/year rows and OFF switch", () => {
  const csv = 'ON,,,\nபிரிவு,தீட்சை,"பிரம்மஞான",\nஇதுவரை,"12,345",600,\nஇந்த ஆண்டு,10,,\n';
  const r = stats.parseStats(csv);
  assert.equal(r.open, true);
  assert.deepEqual(r.labels, ["தீட்சை", "பிரம்மஞான"]);
  assert.deepEqual(r.total, ["12,345", "600"]);
  assert.deepEqual(r.year, ["10", "0"]);
  assert.equal(stats.parseStats("OFF\n" + csv).open, false);
  assert.deepEqual(stats.parseStats("nothing useful"), { open: true, labels: [], total: null, year: null });
});

// ---------- /api/session ----------
test("admin can log in even when the allow-list is empty; cookie is HttpOnly/Secure/Strict", async () => {
  const { res } = await login("admin@example.com");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.isAdmin, true);
  assert.equal(res.body.trustees.length, 11);
  const sc = res.headers["set-cookie"];
  assert.match(sc, /^__Host-meleri_session=/);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/"]) assert.ok(sc.includes(flag), flag);
  assert.equal(res.headers["cache-control"].includes("no-store"), true);
});
test("stranger is refused with 403 and gets no cookie or data", async () => {
  const { res } = await login("stranger@example.com");
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.allowed, false);
  assert.equal(res.headers["set-cookie"], undefined);
  assert.equal(res.body.trustees, undefined);
});
test("invalid token -> 401; missing CSRF header -> 403; foreign Origin -> 403", async () => {
  assert.equal((await call(sessionApi, "POST", { headers: H.CSRF, body: { idToken: "x.y.z" } })).statusCode, 401);
  assert.equal((await call(sessionApi, "POST", { body: { idToken: H.mintIdToken({ email: "admin@example.com" }) } })).statusCode, 403);
  const evil = { "x-requested-with": "meleri", origin: "https://evil.example" };
  assert.equal((await call(sessionApi, "POST", { headers: evil, body: { idToken: H.mintIdToken({ email: "admin@example.com" }) } })).statusCode, 403);
});
test("GET with cookie returns the bootstrap payload; without cookie -> 401", async () => {
  assert.equal((await call(sessionApi, "GET")).statusCode, 401);
  const { cookie } = await login("admin@example.com");
  const r = await call(sessionApi, "GET", { headers: { cookie } });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.email, "admin@example.com");
  assert.ok(r.body.site.quick.length === 4);
});
test("removing someone from the list locks them out even with a valid cookie", async () => {
  blob.store.data = JSON.stringify(["member@example.com"]);
  const { res, cookie } = await login("member@example.com");
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.isAdmin, false);
  assert.equal((await call(sessionApi, "GET", { headers: { cookie } })).statusCode, 200);
  blob.store.data = JSON.stringify([]);
  store.__setBlobForTests(blob); // drops the 60s cache, as a new server instance would
  assert.equal((await call(sessionApi, "GET", { headers: { cookie } })).statusCode, 401);
});
test("logout clears the cookie", async () => {
  const r = await call(sessionApi, "DELETE", { headers: H.CSRF });
  assert.equal(r.statusCode, 200);
  assert.match(r.headers["set-cookie"], /Max-Age=0/);
});
test("login attempts are rate limited", async () => {
  let last;
  for (let i = 0; i < 22; i++) last = await call(sessionApi, "POST", { headers: H.CSRF, body: { idToken: "x.y.z" } });
  assert.equal(last.statusCode, 429);
});
test("ADMIN_EMAIL is required by the handlers", () => {
  const src = require("fs").readFileSync(require.resolve("../api/session.js"), "utf8");
  assert.ok(src.includes("if (!ADMIN_EMAIL)"));
  assert.ok(!/@gmail\.com/.test(require("fs").readFileSync(require.resolve("../api/_lib/config.js"), "utf8")), "no hard-coded admin address");
});

// ---------- /api/admin-emails ----------
test("admin panel API: only admin; add / list / remove; audit; can't remove admin", async () => {
  const adm = (await login("admin@example.com")).cookie;
  blob.store.data = JSON.stringify(["member@example.com"]);
  const member = (await login("member@example.com")).cookie;

  assert.equal((await call(adminApi, "GET")).statusCode, 401);
  assert.equal((await call(adminApi, "GET", { headers: { cookie: member } })).statusCode, 403);

  const list = await call(adminApi, "GET", { headers: { cookie: adm } });
  assert.deepEqual(list.body.emails, ["admin@example.com", "member@example.com"]);

  const h = Object.assign({ cookie: adm }, H.CSRF);
  assert.equal((await call(adminApi, "POST", { headers: { cookie: adm }, body: { email: "x@y.co" } })).statusCode, 403); // no CSRF header
  assert.equal((await call(adminApi, "POST", { headers: h, body: { email: "not-an-email" } })).statusCode, 400);
  const added = await call(adminApi, "POST", { headers: h, body: { email: "  New@Example.com " } });
  assert.deepEqual(added.body.emails, ["admin@example.com", "member@example.com", "new@example.com"]);
  assert.deepEqual(JSON.parse(blob.store.data), ["admin@example.com", "member@example.com", "new@example.com"]);

  const removed = await call(adminApi, "DELETE", { headers: h, query: { email: "member@example.com" } });
  assert.deepEqual(removed.body.emails, ["admin@example.com", "new@example.com"]);
  assert.equal((await call(adminApi, "DELETE", { headers: h, query: { email: "admin@example.com" } })).statusCode, 400);
});

// ---------- /api/stats ----------
test("stats: login required, served from server cache, survives Google outage", async () => {
  fetchState.csv = 'ON\nபிரிவு,தீட்சை\nஇதுவரை,5\nநடப்பாண்டு,2\n';
  assert.equal((await call(statsApi, "GET")).statusCode, 401);
  const cookie = (await login("admin@example.com")).cookie;
  const a = await call(statsApi, "GET", { headers: { cookie } });
  assert.equal(a.statusCode, 200);
  assert.deepEqual(a.body, { open: true, labels: ["தீட்சை"], total: ["5"], year: ["2"] });
  await call(statsApi, "GET", { headers: { cookie } });
  assert.equal(fetchState.calls.filter((u) => u.includes("spreadsheets")).length, 1, "second call hit the cache");
  assert.match(a.headers["cache-control"], /private/);
  fetchState.csvFail = true;
  stats._resetForTests();
  assert.equal((await call(statsApi, "GET", { headers: { cookie } })).statusCode, 502);
});

// ---------- store ----------
test("store: normalises, falls back to ALLOWED_EMAILS when Blob is down, fails closed", async () => {
  store.__setBlobForTests({ get: async () => { throw new Error("blob down"); }, put: async () => {} });
  process.env.ALLOWED_EMAILS = "A@x.co\nb@x.co, a@x.co";
  assert.deepEqual(await store.readAllowedEmails({ fresh: true }), ["a@x.co", "b@x.co"]);
  delete process.env.ALLOWED_EMAILS;
  assert.deepEqual(await store.readAllowedEmails({ fresh: true }), []);
});
