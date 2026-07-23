# Versioning & the open-core line

> How EnsinoLibre splits into a free, self-hostable open-source core and a paid,
> multi-tenant **Organisation** product — and the concrete plan to get there
> without painting the schema into a corner.

## The premise

- **Open source (MIT, self-hostable).** The worksheet **builder** (generator +
  30-type engine) and the **single-tenant teacher platform** — one teacher owns
  their classrooms, students, worksheets, resources, live classroom, personal
  knowledge base, MCP agent access. Everything one teacher needs to run their
  own workspace, on their own Supabase.
- **Commercial (per-seat).** The **Organisation** layer: a multi-tenant
  namespace above the teacher, with a **shared org-wide knowledge base**,
  seat-based billing, roles/admin, org reporting, and SSO. Sold per seat to
  schools and other institutions.

The paid value is not a crippled free tier — it is a genuinely *additional
surface* (many teachers, one governed knowledge base) built on the same
machinery the OSS core already ships (the `resources` KB, full-text search, the
knowledge graph, the MCP agent tools).

## Why this is the right line

The sellable feature is an org-wide teaching knowledge base. That machinery
already exists in OSS as the per-teacher `resources` table (full-text search,
graph edges, MCP-writable, agent-audited). The paid product widens its scope
from one teacher to a governed pool of teachers. We are not inventing a new
value proposition to monetise — we are widening the one already built. That is
the strongest signal the boundary is drawn in the right place.

## The boundary, concretely

| Capability | OSS core | Organisation (paid) |
|---|---|---|
| Worksheet generator + engine | ✅ | ✅ |
| Student aula / live classroom | ✅ | ✅ |
| One teacher's workspace + KB | ✅ | ✅ |
| MCP agent access | ✅ (personal keys) | ✅ (+ org-scoped) |
| **Org namespace above teachers** | — | ✅ |
| **Shared, governed org KB** | — | ✅ |
| **Roles / admin console** | — | ✅ |
| **Per-seat billing** | — | ✅ |
| **SSO / SAML, provisioning** | — | ✅ |
| **Org-wide reporting** | — | ✅ |

Ownership stays `teacher_id`-based in OSS; the paid layer adds `org_id` above it
via the [tenancy seam](docs/architecture/tenancy-seam.md).

## Where the paid code lives

**Open-core monorepo + private module** (chosen). The OSS core is MIT. The
Organisation layer lives in a separate, commercially-licensed module that layers
on top through the seam (a swapped pair of SQL authorization functions + new
`org.*` tables + an admin UI). One deployment, clean licence split, no fork.
Rejected: a separate repo wrapping core as a dependency (more integration
friction, and the seam already gives us a clean layering point in-repo).

---

## The plan: from here to there

Three tracks. Track 1 is time-sensitive (it must land before the v1.0 schema
freezes); Tracks 2 and 3 are the OSS-core finish line and the paid build.

### Track 1 — Reserve the seam (before v1.0 freeze) — **IN PROGRESS**

- [x] **Design the seam.** Delegate RLS to replaceable `el_can_read` /
      `el_can_write`; reserve nullable `org_id`. See
      [docs/architecture/tenancy-seam.md](docs/architecture/tenancy-seam.md).
- [x] **Write the migration.**
      [`20260723120000_tenancy_seam.sql`](supabase/migrations/20260723120000_tenancy_seam.sql).
- [ ] **Apply + verify equivalence** on the live project (owner sees exactly
      their rows; anon sees zero) — behaviour-preserving.
- [ ] **Keep the MCP edge function seam-ready.** Its writes are service-role and
      teacher-scoped; confirm they set `teacher_id` (and, later, `org_id`) and
      do not assume the old policy names. No functional change needed now.
- [ ] **Regression-guard.** Add a Postgres/RLS check to the test story so a
      future migration can't silently re-inline the owner check and break the
      seam.

### Track 2 — Finish the OSS core as a *self-hostable* v1.0

The platform is feature-complete for one teacher; what's missing is the
*self-host packaging* and honest docs. (See ROADMAP.md for the agent-native
v1.0 bar; these are the additional open-core-specific items.)

- [ ] **Self-host configuration.** Remove the hardcoded Supabase project id /
      publishable key / demo creds from source; read them from env
      (`.env` + `.env.example`). Today a self-hoster would run against *our* DB.
- [ ] **One-command backend setup.** Bundle the migrations + a seed script + a
      `supabase db push` runbook so a third party can stand up their own
      project. (The migrations already exist under `supabase/migrations/`.)
- [ ] **Deploy story for self-hosters.** Document a static-host + Supabase
      deploy that isn't our Netlify site; ideally a Docker/one-click path.
- [x] **Fix stale status docs.** `core/README.md` no longer claims
      "boilerplate, front-end only" (backend, real auth and realtime shipped).
- [ ] **Licence headers / NOTICE** clarifying MIT core vs. the reserved-name
      Organisation module.

### Track 3 — Build the Organisation layer (paid)

Only starts once Track 1 has landed and Track 2's config seam exists. Sits on
the tenancy seam; see the follow-up-migration sketch in the seam doc.

- [ ] `org.organizations` + `org.org_members(role)`; the follow-up migration
      that swaps `el_can_read`/`el_can_write` bodies and adds the `org_id` FK.
- [ ] **Org KB sharing** — resources/worksheets pooled at org scope, with the
      knowledge graph and MCP tools honouring org visibility.
- [ ] **Admin console** — members, seats, roles, invites.
- [ ] **Billing** — Stripe per-seat, seat count ⇄ `org_members`.
- [ ] **SSO/SAML + provisioning** (SCIM optional, later).
- [ ] **Org reporting** — cross-teacher progress and KB analytics.

---

## Invariants (don't break these)

1. **Never re-inline the owner check.** Any new content-table policy must
   delegate to `el_can_read`/`el_can_write`, never hardcode `teacher_id =
   auth.uid()`. That is what keeps the paid layer a body-swap, not a rewrite.
2. **OSS stays fully functional single-tenant.** The Organisation layer is
   additive; nothing in it may be a prerequisite for the OSS core working.
3. **`org_id` is null in OSS.** No OSS code path sets it.
4. **The MIT core must be self-hostable for real** — no hardcoded pointers to
   our infrastructure.
