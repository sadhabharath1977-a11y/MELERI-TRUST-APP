"use strict";
// Shared test helpers: a fake Google (RSA keys + JWKS), a fake Blob store, and fake req/res objects.
const crypto = require("crypto");

const CLIENT_ID = "323362878068-gpr8osss81v1t2qv85ffedmca7dld54u.apps.googleusercontent.com";
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "test-key-1";

function mintIdToken(claims, opts) {
  opts = opts || {};
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", kid: opts.kid || KID, typ: "JWT" };
  const payload = Object.assign(
    { iss: "https://accounts.google.com", aud: CLIENT_ID, iat: now, exp: now + 3600, email_verified: true },
    claims
  );
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const data = b(header) + "." + b(payload);
  const signer = opts.key || privateKey;
  const sig = crypto.sign("RSA-SHA256", Buffer.from(data), signer).toString("base64url");
  return data + "." + sig;
}

// Replace global fetch with a fake that serves Google's key list and (optionally) a CSV sheet.
function installFakeFetch(state) {
  state.calls = [];
  state.csv = state.csv || "";
  const original = global.fetch;
  global.fetch = async (url) => {
    const u = String(url);
    state.calls.push(u);
    if (u.startsWith("https://www.googleapis.com/oauth2/v3/certs")) {
      const jwk = publicKey.export({ format: "jwk" });
      return new Response(JSON.stringify({ keys: [Object.assign({ kid: KID, alg: "RS256", use: "sig" }, jwk)] }), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" }
      });
    }
    if (u.includes("docs.google.com/spreadsheets")) {
      if (state.csvFail) return new Response("nope", { status: 500 });
      return new Response(state.csv, { status: 200 });
    }
    throw new Error("unexpected fetch: " + u);
  };
  return () => (global.fetch = original);
}

function fakeBlob() {
  const store = { data: null, puts: 0 };
  return {
    store,
    get: async () => (store.data == null ? null : { stream: new Blob([store.data]).stream(), blob: {} }),
    put: async (_path, body) => {
      store.data = body;
      store.puts++;
    }
  };
}

function fakeReq(method, opts) {
  opts = opts || {};
  return {
    method,
    headers: Object.assign({ host: "app.example.com" }, opts.headers || {}),
    body: opts.body,
    query: opts.query || {},
    socket: { remoteAddress: opts.ip || "1.2.3.4" }
  };
}

function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(o) {
      this.body = o;
      return this;
    }
  };
  return res;
}

const CSRF = { "x-requested-with": "meleri", origin: "https://app.example.com" };

module.exports = { CLIENT_ID, KID, mintIdToken, installFakeFetch, fakeBlob, fakeReq, fakeRes, CSRF, privateKey, publicKey };
