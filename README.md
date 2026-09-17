# MELERI MVKM TRUST — Trustees App

Static PWA + Vercel serverless API for the trust's internal trustees app.

Live: https://anbu-mvkm-trust-omega.vercel.app

## Structure
- `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.json` — the static app (bilingual Tamil/English, Google Sign-In gated)
- `api/verify-access.js` — verifies a signed-in Google account against the allowed-member list
- `api/admin-emails.js` — admin-only: add/remove members from the allowed list
- `api/trustees.js` — returns trustee contact details (name, phone, WhatsApp, Drive folder) **only** after a verified login — this data is not present anywhere in the static files
- `api/_lib/` — shared server-only helpers (Google token verification, the Blob-backed member-list store, admin email config)

## Deployment
This repo is **not currently connected** to the Vercel project (`anbu-mvkm-trust`). Deploys are pushed directly from a local machine via the Vercel CLI. This repo exists as a source-controlled mirror of what's live.

## Notes
- The allowed-member email list and admin flag live in a Vercel Blob store, not in this repo.
- Do not commit `.env` files or any Vercel API tokens.
