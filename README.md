# MELERI MVKM TRUST – Secured App

This package is ready to upload to a GitHub repository and connect to the existing Vercel project.

## Important
- Keep all files in the repository root as provided.
- The Google Sign-In client ID is configured in `app.js`.
- Vercel serverless functions are under `api/`.
- Do not commit private secrets or `.env` files.

## Vercel
Connect this GitHub repository to the existing `anbu-mvkm-trust` Vercel project. A push to the production branch can trigger a new deployment.

## Security update
The Content Security Policy includes the Google Identity Services endpoints required for the Sign in with Google button. This fixes the sign-in button being blocked after the stricter security headers were added.
