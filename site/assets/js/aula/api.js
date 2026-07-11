/**
 * EnsinoLibre — student aula API (Supabase, no localStorage for data).
 *
 * The public student page reaches the backend only through code-gated RPCs
 * (get_aula / join_aula / save_progress / get_my_progress). A tiny session
 * marker (which deployment + enrolment this browser joined) is kept in
 * sessionStorage — that is a login token, not stored coursework.
 */
import { createClient } from '../../vendor/supabase.esm.js';

const SUPABASE_URL = 'https://edgdxuvzyhwqidjjbidq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_E1qrfBQlbs6BVRksbX6zbQ_hc_63063';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const SESSION_KEY = 'ensinolibre.aula-session';

export const session = {
  get() { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } },
  set(s) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); },
  clear() { sessionStorage.removeItem(SESSION_KEY); },
};

/** Look up a live deployment by class code (no join). */
export async function getAula(code) {
  const { data, error } = await supabase.rpc('get_aula', { p_code: code });
  if (error) return { error: error.message };
  return data;
}

/** Join a deployment with a code + name (+ password, if required); returns aula, worksheets, enrolment id. */
export async function joinAula(code, name, password) {
  const { data, error } = await supabase.rpc('join_aula', { p_code: code, p_name: name, p_password: password || null });
  if (error) return { error: error.message };
  return data;
}

/** This student's saved progress across the deployment's worksheets. */
export async function getMyProgress(enrollmentId) {
  const { data, error } = await supabase.rpc('get_my_progress', { p_enrollment_id: enrollmentId });
  if (error) return [];
  return data || [];
}

/** Persist a worksheet snapshot for this student. */
export async function saveProgress(enrollmentId, worksheetId, snap) {
  const { error } = await supabase.rpc('save_progress', {
    p_enrollment_id: enrollmentId,
    p_worksheet_id: worksheetId,
    p_total: snap.total,
    p_attempted: snap.attempted,
    p_correct: snap.correct,
    p_done: snap.done,
    p_score: snap.score,
  });
  return !error;
}
