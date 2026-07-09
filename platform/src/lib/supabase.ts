/**
 * EnsinoLibre teacher platform — Supabase client.
 *
 * The teacher app is authenticated (email/password). Unlike the public student
 * page (which only ever calls code-gated RPCs and does NOT persist a session),
 * the teacher client persists its session and auto-refreshes the token so a
 * logged-in teacher stays logged in across reloads. All teacher table access is
 * RLS-scoped to `auth.uid()`.
 */
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://edgdxuvzyhwqidjjbidq.supabase.co';
// Publishable (anon) key — safe to ship in client code; RLS does the gating.
export const SUPABASE_KEY = 'sb_publishable_E1qrfBQlbs6BVRksbX6zbQ_hc_63063';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'ensinolibre.teacher.auth',
  },
});
