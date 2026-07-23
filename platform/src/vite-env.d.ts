/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Your Supabase project URL, e.g. https://xxxx.supabase.co (see SELF-HOSTING.md). */
  readonly VITE_SUPABASE_URL?: string;
  /** Your Supabase publishable (anon) key — safe in client code; RLS does the gating. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
