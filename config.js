"use strict";
// ---------------------------------------------------------------
// Central configuration. Everything that may change between
// deployments is read from Vercel Environment Variables.
//
//   ADMIN_EMAIL     (REQUIRED)    the one admin Google account
//   SESSION_SECRET  (recommended) long random string used to sign login cookies
//                                 (if missing, a key is derived from the Blob token)
//   GOOGLE_CLIENT_ID (optional)   public OAuth client id (not a secret)
//   ALLOWED_EMAILS  (optional)    fallback list if the Blob store is unavailable
//   STATS_CSV_URL   (optional)    published-CSV link of the service statistics sheet
// ---------------------------------------------------------------

const GOOGLE_CLIENT_ID = String(
  process.env.GOOGLE_CLIENT_ID ||
    "323362878068-gpr8osss81v1t2qv85ffedmca7dld54u.apps.googleusercontent.com"
).trim();

// No hard-coded admin address any more: it must come from the environment.
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();

const STATS_CSV_URL = String(
  process.env.STATS_CSV_URL ||
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2Hhw3RiD-YHcQfE_V_rc_pH-B9cubbV_Q4CzP6vhPPXSofSp-MjZOVkD8xb-CtmMvhuNddJGqPOs6/pub?gid=1803561821&single=true&output=csv"
).trim();

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days (access is re-checked on every request)

module.exports = { GOOGLE_CLIENT_ID, ADMIN_EMAIL, STATS_CSV_URL, SESSION_TTL_SECONDS };
