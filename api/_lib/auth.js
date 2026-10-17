"use strict";
const { ADMIN_EMAIL } = require("./config");
const { readSession, readDeviceId } = require("./token");
const { readAllowedEmails, getMember } = require("./store");

// The admin can always enter, even before any allow-list exists.
async function isAllowed(email, opts) {
  if (!email) return false;
  if (ADMIN_EMAIL && email === ADMIN_EMAIL) return true;
  return (await readAllowedEmails(opts)).includes(email);
}

// Access is re-checked on EVERY request: removing someone (or resetting their device) from the
// list locks them out within a minute, even if their login cookie has not expired yet.
// The admin account is exempt from the one-device lock (they may need to manage the app from more
// than one device); everyone else's session is only valid on the device it was issued on.
async function authenticate(req) {
  const email = readSession(req);
  if (!email) return null;
  const isAdmin = !!ADMIN_EMAIL && email === ADMIN_EMAIL;
  if (isAdmin) return { email, isAdmin: true, role: "admin" };
  const member = await getMember(email);
  if (!member) return null; // removed from the allow-list
  if (member.deviceId && member.deviceId !== readDeviceId(req)) return null; // a different device holds the lock
  return { email, isAdmin: false, role: member.role };
}

module.exports = { isAllowed, authenticate };
