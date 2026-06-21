# Artfile Inventory

Inventory admin site for Artfile.

This project has been migrated from an old Create React App setup to Vite, React, TypeScript, and modular data services.

## Environment variables

Copy the template and fill in your values locally:

```bash
cp .env.example .env.local
```

Required for the app (`npm run dev`, production builds):

| Variable | Where to get it |
|----------|-----------------|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API → publishable key |

Optional:

| Variable | Purpose |
|----------|---------|
| `VITE_DASHBOARD_RECORD_LIMIT` | Stock records shown on dashboard cards (default `3`) |

Migration scripts use separate variables — see `.env.example`. Never commit `.env` or `.env.local`.

## Development

Install dependencies:

```bash
npm install
```

Run the local dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Vite outputs production files to `dist`.

## Firebase Data Export

To download the current Firebase data for a later Supabase migration:

```powershell
$env:FIREBASE_API_KEY = "<firebase api key>"
$env:FIREBASE_AUTH_DOMAIN = "<project>.firebaseapp.com"
$env:FIREBASE_DATABASE_URL = "https://<project>.firebaseio.com"
$env:FIREBASE_PROJECT_ID = "<project id>"
$env:FIREBASE_STORAGE_BUCKET = "<project>.appspot.com"
$env:FIREBASE_APP_ID = "<firebase app id>"
$env:FIREBASE_EXPORT_EMAIL = "<export account email>"
$env:FIREBASE_EXPORT_PASSWORD = "<export account password>"
npm run export:firebase
```

The export writes to a timestamped local folder under `exports/`, which is ignored by git.

Each export contains:

- `firestore/Stock__Stocks.json`: the root `Stock/Stocks` document, including the category list and any extra root fields.
- `firestore/categories/<category>/documents.json`: raw Firestore documents for each category.
- `images/by-reference/<category>/<item-id>.*`: images downloaded from each item's `img` field where the URL is valid.
- `storage/<category>/<file>.*`: all listable Firebase Storage files under each category folder.
- `manifest.json`: category counts, saved paths, image metadata, Storage metadata, and any export errors.

Known export note: older records can contain placeholder or stale `blob:` image URLs. Those are logged in `manifest.json` under `errors`; real uploaded category images should still be available under `storage/` when present.

## Supabase

The app calls Supabase through Edge Functions, not directly through the frontend Supabase SDK.

Edge Functions:

- `inventory-api`: categories, items, item CRUD, stock record CRUD.
- `image-upload`: item image upload to the `images` bucket.
- `storage-status`: bucket usage and warning threshold.

Authentication:

- The frontend uses Supabase Auth (email/password) via the REST API.
- All Edge Functions require a signed-in user JWT. Anonymous/publishable-key requests are rejected.
- `verify_jwt = true` is set in `supabase/config.toml`, and each function also validates the user with `auth.getUser()`.
- Create admin users in the Supabase dashboard (Auth > Users). Sign-up from the app is not exposed.

Apply schema and deploy functions:

```bash
supabase db push --include-all
supabase functions deploy inventory-api
supabase functions deploy image-upload
supabase functions deploy storage-status
```

Import a Firebase export into Supabase:

```powershell
$env:SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:SUPABASE_SECRET_KEY = "<your Supabase secret key>"
npm run import:supabase
Remove-Item Env:\SUPABASE_URL, Env:\SUPABASE_SECRET_KEY
```

The import script reads `exports/firebase-2026-06-21T13-09-48-282Z`, uploads images into the `images` bucket, and inserts:

- `categories`
- `items`
- `stock_records`

## GitHub Pages (testing)

Preview URL:

```text
https://smellypotato.github.io/artilfe-revamp/
```

Repository: [github.com/smellypotato/artilfe-revamp](https://github.com/smellypotato/artilfe-revamp)

The Vite build uses base path `/artilfe-revamp/` for GitHub Pages. Local dev still uses `/`.

### One-time GitHub setup

1. **Settings → Pages → Source**: choose **GitHub Actions**.
2. **Settings → Secrets and variables → Actions → New repository secret**:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` — your Supabase publishable key
3. Push to `master` (or run **Deploy GitHub Pages** manually under Actions).

Build locally for Pages:

```bash
# requires .env.local with VITE_* values
npm run build:pages
npm run preview -- --base /artilfe-revamp/
```

### One-time Supabase setup

In **Authentication → URL Configuration**, set **Site URL** to:

```text
https://smellypotato.github.io/artilfe-revamp/
```

Create admin users under **Authentication → Users** (sign-up from the app is not exposed).

When moving to the Wix-managed domain later, update the Site URL to `https://admin.artfile-hk.com` (or your chosen admin URL).

## Current Hosting Notes

Current live admin domain:

```text
admin.artfile-hk.com
```

Current DNS / hosting findings as of 2026-06-21:

- The root domain DNS is managed by Wix nameservers, e.g. `ns12.wixdns.net`.
- `admin.artfile-hk.com` resolves to Firebase Hosting / Fastly IPs:
  - `151.101.1.195`
  - `151.101.65.195`
- The live response includes `Vary: x-fh-requested-host`, which indicates Firebase Hosting.
- The old Firebase project used by the app is `artfile-database`.
- There is currently no `firebase.json` or `.firebaserc` in this repo.

If deploying to the current host before the migration, the expected target is Firebase Hosting for project `artfile-database`, with Vite output from `dist`.

## Planned Production Hosting

After GitHub Pages testing is validated, point the Wix-managed admin domain to the production host.

Planned setup:

- Static Vite build hosted on GitHub Pages (testing) or another static host (production).
- Wix remains the domain/DNS manager for `artfile-hk.com`.
- Wix DNS should point `admin.artfile-hk.com` to the production target when ready.
- Add the required GitHub Pages `CNAME` file or configure the custom domain in the GitHub repository settings during migration.

Firebase should be completely replaced later. The current Firebase code is intentionally isolated under `src/services/` so a Supabase-backed implementation can replace it without rewriting the UI.
