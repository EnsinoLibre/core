/**
 * EnsinoLibre — save a generated worksheet to the teacher's real library.
 *
 * The public generator used to "save" into a localStorage boilerplate store the
 * Supabase-backed platform never reads (issue #18) — a misleading success that
 * silently lost the worksheet. This saves into the actual `worksheets` table.
 *
 * The client reuses the teacher platform's persisted auth session: same URL,
 * same publishable key, and the SAME storageKey, so a teacher already signed in
 * to the platform (same origin in production) can save straight from the
 * generator with no second login. RLS scopes the insert to `teacher_id`.
 */
import { createClient } from '../../vendor/supabase.esm.js';

const SUPABASE_URL = 'https://edgdxuvzyhwqidjjbidq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_E1qrfBQlbs6BVRksbX6zbQ_hc_63063';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ensinolibre.teacher.auth' },
});

const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** The signed-in teacher (user object) or null. */
export async function currentTeacher() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}

/**
 * Insert a worksheet document into the signed-in teacher's library.
 * @returns {Promise<{id:string,title:string}>}
 * @throws  Error with code 'NO_SESSION' when no teacher is signed in; otherwise
 *          an Error carrying the database message.
 */
export async function saveWorksheetToLibrary(doc) {
  const user = await currentTeacher();
  if (!user) { const e = new Error('No teacher signed in.'); e.code = 'NO_SESSION'; throw e; }
  const id = uuid();
  const title = doc.title || 'Untitled worksheet';
  const { error } = await supabase.from('worksheets').insert({
    id, teacher_id: user.id, title, subject: doc.subject || '', doc,
  });
  if (error) throw new Error(error.message);
  return { id, title };
}
