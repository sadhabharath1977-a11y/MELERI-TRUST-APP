# MELERI MVKM Trust – Trustees App (v2)

Static PWA (`index.html`, `style.css`, `js/`) + Vercel serverless API (`api/`). Setup and deployment notes (Tamil): `SETUP-TA.txt`.

```
api/session.js        login / session / bootstrap data (GET, POST, DELETE)
api/admin-emails.js   admin only: allowed e-mail list
api/stats.js          service statistics (server-cached Google Sheet)
api/_lib/             config, token (cookie), googleAuth (local JWT verify), store (Blob),
                      csv, stats, rateLimit, http, auth, site-data, trustees-data   (server only, never public)
js/                   main, auth, views, stats, api, i18n, util   (ES modules)
img/  icons/          content-hashed WebP photos, compressed PNG icons
sw.js  manifest.json  vercel.json (region, security headers, cache headers)
tests/                `npm test` – 19 API tests (Google token, cookie, CSRF, admin, stats, store)
```

Required env vars: `ADMIN_EMAIL`. Recommended: `SESSION_SECRET`.
