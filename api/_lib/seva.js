"use strict";
// Talks to the Google Apps Script web app that owns the service-record Sheet. The shared key is sent
// in the POST body (never in a URL) and lives only in Vercel environment variables.
const { SERVICE_SCRIPT_URL, SERVICE_SCRIPT_KEY } = require("./config");

async function callScript(payload) {
  if (!SERVICE_SCRIPT_URL || !SERVICE_SCRIPT_KEY) throw new Error("SERVICE_SCRIPT_URL / SERVICE_SCRIPT_KEY not set");
  const r = await fetch(SERVICE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, key: SERVICE_SCRIPT_KEY }),
    redirect: "follow",
    signal: AbortSignal.timeout(8500)
  });
  if (!r.ok) throw new Error("script status " + r.status);
  const data = await r.json();
  if (data && data.error) {
    const e = new Error(data.error);
    e.status = data.error === "auth" ? 502 : 400; // validation messages are safe to show; "auth" is a setup error
    throw e;
  }
  return data;
}
module.exports = { callScript };
