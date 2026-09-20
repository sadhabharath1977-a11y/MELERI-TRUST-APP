"use strict";
const { ADMIN_EMAIL } = require("./config");
const { readSession } = require("./token");
const { readAllowedEmails } = require("./store");

// The admin can always enter, even before any allow-list exists.
async function isAllowed(email, opts) {
  if (!email) return false;
  if (ADMIN_EMAIL && email === ADMIN_EMAIL) return true;
  return (await readAllowedEmails(opts)).includes(email);
}

// Access is re-checked on EVERY request: removing someone from the list locks them out
// within a minute, even if their login cookie has not expired yet.
async function authenticate(req) {
  const email = readSession(req);
  if (!email) return null;
  if (!(await isAllowed(email))) return null;
  return { email, isAdmin: !!ADMIN_EMAIL && email === ADMIN_EMAIL };
}

module.exports = { isAllowed, authenticate };
