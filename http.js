"use strict";
function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function send(res, status, body) {
  res.status(status).json(body);
}

function clientIp(req) {
  const xf = req.headers && req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

// CSRF defence for every state-changing request (in addition to SameSite=Strict cookies):
// a custom header (which a cross-site form/image cannot send) and a same-origin Origin header.
function csrfOk(req) {
  const h = req.headers || {};
  if (h["x-requested-with"] !== "meleri") return false;
  if (h.origin) {
    try {
      if (new URL(h.origin).host !== h.host) return false;
    } catch (e) {
      return false;
    }
  }
  return true;
}

module.exports = { noStore, send, clientIp, csrfOk };
