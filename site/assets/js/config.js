/**
 * EnsinoLibre — public-site runtime configuration (zero-build).
 *
 * The public site (worksheet generator + student aula) has no build step, so it
 * can't read Vite `.env` files. To self-host, point it at your own Supabase
 * project in one of two ways (see SELF-HOSTING.md):
 *
 *   1. Edit the fallback defaults below, OR
 *   2. Set a global before this module loads — e.g. drop an inline script (or a
 *      deploy-generated, gitignored `config.local.js`) in the page <head>:
 *          <script>window.__ENSINOLIBRE__ = {
 *            SUPABASE_URL: 'https://YOURPROJECT.supabase.co',
 *            SUPABASE_KEY: 'sb_publishable_...'
 *          };</script>
 *
 * The publishable (anon) key is safe in client code — row-level security does
 * the gating. The defaults are the public EnsinoLibre demo project so an
 * unconfigured deploy still runs.
 */
const cfg = (typeof window !== 'undefined' && window.__ENSINOLIBRE__) || {};

export const SUPABASE_URL = cfg.SUPABASE_URL || 'https://edgdxuvzyhwqidjjbidq.supabase.co';
export const SUPABASE_KEY = cfg.SUPABASE_KEY || 'sb_publishable_E1qrfBQlbs6BVRksbX6zbQ_hc_63063';
