"use strict";
// Talks to the Google Apps Script web app that owns the service-record Sheet. The shared key is sent
// in the POST body (never in a URL) and lives only in Vercel environment variables.
// Reads are retried once (Apps Script sometimes needs a second try after being idle); writes are NEVER
// retried here, so a slow reply can't create a duplicate row.
const { SERVICE_SCRIPT_URL, SERVICE_SCRIPT_KEY } = require("./config");

async function once(payload, ms) {
  const r = await fetch(SERVICE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, key: SERVICE_SCRIPT_KEY }),
    redirect: "follow",
    signal: AbortSignal.timeout(ms)
  });
  if (!r.ok) throw new Error("script status " + r.status);
  return r.json(); // throws if the script returned an HTML error page
}

async function callScript(payload) {
  if (!SERVICE_SCRIPT_URL || !SERVICE_SCRIPT_KEY) throw new Error("SERVICE_SCRIPT_URL / SERVICE_SCRIPT_KEY not set");
  const isRead = payload.action !== "add";
  let data;
  try {
    data = await once(payload, isRead ? 5000 : 8500);
  } catch (e) {
    if (!isRead) throw e;
    data = await once(payload, 4000); // second try, total stays under the 10 s function limit
  }
  if (data && data.error) {
    const e = new Error(data.error);
    e.status = data.error === "auth" ? 502 : 400; // validation messages are safe to show; "auth" is a setup error
    throw e;
  }
  return data;
}
module.exports = { callScript };
