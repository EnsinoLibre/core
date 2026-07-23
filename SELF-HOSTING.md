# Self-hosting EnsinoLibre

EnsinoLibre's worksheet builder and **single-tenant teacher platform** are
open-source (MIT) and self-hostable: run the whole thing against your own
Supabase project and your own static host. This guide is the end-to-end setup.

> The multi-tenant, per-seat **Organisation** product (shared org-wide knowledge
> base) is a separate commercial layer — see [VERSIONING.md](VERSIONING.md). The
> OSS core self-hosts as one workspace per teacher.

## What you need

- A [Supabase](https://supabase.com) project (the free tier is enough to start).
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase`).
- Node + npm (only to build the teacher platform; the public site is zero-build).
- Any static host for the built site (Netlify, Cloudflare Pages, Nginx, S3…).

## Quickstart (Docker)

If you just want the web app running against a Supabase project you already
created (step 1 below), Docker is one command:

```bash
cp .env.example .env      # fill in SUPABASE_URL and SUPABASE_KEY
docker compose up --build # → http://localhost:8080
```

That builds the teacher platform and serves it with the public site under
nginx, baked with your Supabase URL/key. The backend itself is still Supabase —
Docker only runs the web app. To rebuild against a different project, change
`.env` and re-run `docker compose up --build`. The rest of this guide is the
manual, non-Docker path and the backend setup the Docker image assumes.

## 1. Create your Supabase project and apply the schema

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # applies everything under supabase/migrations/
supabase functions deploy mcp --no-verify-jwt   # optional: the agent MCP endpoint
```

`supabase db push` runs every migration in [`supabase/migrations/`](supabase/migrations/),
which creates all tables, row-level-security policies (scoped per teacher), the
code-gated student RPCs, and the [tenancy seam](docs/architecture/tenancy-seam.md).
`--no-verify-jwt` is required for the `mcp` function because it does its own
agent-key auth.

Grab your project's **URL** and **publishable (anon) key** from
*Project Settings → API*. The anon key is safe to ship in client code — RLS does
the gating. Never put the `service_role` key in any client config.

## 2. Point the apps at your project

There are two surfaces, configured separately.

### Teacher platform (`platform/`, built with Vite)

```bash
cd platform
cp .env.example .env
# edit .env:
#   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
#   VITE_SUPABASE_ANON_KEY=sb_publishable_...
npm install
npm run build            # outputs platform/dist
```

Config lives in [`platform/src/lib/supabase.ts`](platform/src/lib/supabase.ts),
which reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` at build time and
falls back to the public demo project if unset.

### Public site (`site/`, zero-build)

The generator and student aula have no build step, so they read config at
runtime from [`site/assets/js/config.js`](site/assets/js/config.js). Either:

- **Edit the defaults** in `config.js`, or
- **Inject a global** before the modules load (keeps `config.js` pristine for
  updates) — add to the page `<head>`, or ship a gitignored `config.local.js`:
  ```html
  <script>window.__ENSINOLIBRE__ = {
    SUPABASE_URL: 'https://<your-project-ref>.supabase.co',
    SUPABASE_KEY: 'sb_publishable_...'
  };</script>
  ```

## 3. Deploy the static site

Copy `platform/dist` → `site/app/`, then serve the `site/` directory (and
`core/docs`, `core/schema` if you want the in-app docs/schema) from any static
host. `netlify.toml` shows the reference build; the paths live under `/site/...`
(landing at `/site/index.html`, platform at `/site/app/`, student at
`/site/aula.html`).

Locally: `node server.mjs` serves the whole thing at http://localhost:3210.

## 4. Create your first teacher

Sign up from the platform's login screen (Supabase Auth, email + password); a
`profiles` row is created automatically by the `handle_new_user` trigger. That
account owns its own classrooms, students, worksheets and resources under RLS.

## Notes

- **Everything stays single-tenant.** Each teacher account is an isolated
  workspace; there is no cross-teacher sharing in the OSS core by design.
- **Keeping the demo defaults** (no env / unedited `config.js`) points your
  build at the shared public EnsinoLibre project — fine for a quick look, but
  set your own before real use so your data lives in your own database.
- **Updating:** migrations are additive; `git pull` then `supabase db push` +
  rebuild the platform.
