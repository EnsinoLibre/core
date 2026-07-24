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

### Track 1 — Reserve the seam (before v1.0 freeze) — **DONE**

- [x] **Design the seam.** Delegate RLS to replaceable `el_can_read` /
      `el_can_write`; reserve nullable `org_id`. See
      [docs/architecture/tenancy-seam.md](docs/architecture/tenancy-seam.md).
- [x] **Write the migration.**
      [`20260723120000_tenancy_seam.sql`](supabase/migrations/20260723120000_tenancy_seam.sql).
- [x] **Apply + verify equivalence** on the live project — verified by role
      simulation: each teacher sees exactly their own rows, anon sees zero, no
      cross-tenant leakage; no new security-advisor warnings.
- [x] **MCP edge function audited seam-ready.** It writes with the service role,
      scopes every query by `teacher_id` explicitly, and references no policy
      names — the seam is transparent to it. (Its insert sites set `teacher_id`
      only; Track 3 extends them to set `org_id`.)
- [x] **Regression guard.** `tests/run-tests.mjs` §11b: three static guards
      fail the build if the seam loses a helper or a later migration re-inlines
      `auth.uid()` on a seam-governed table (enforces invariant #1).

### Track 2 — Finish the OSS core as a *self-hostable* v1.0

The platform is feature-complete for one teacher; what's missing is the
*self-host packaging* and honest docs. (See ROADMAP.md for the agent-native
v1.0 bar; these are the additional open-core-specific items.)

- [x] **Self-host configuration.** Supabase URL/key are no longer hardcoded:
      the platform reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
      ([`platform/.env.example`](platform/.env.example)); the zero-build site
      reads [`site/assets/js/config.js`](site/assets/js/config.js) (editable
      defaults or a `window.__ENSINOLIBRE__` override). Both fall back to the
      demo project so the current deploy is unaffected. Verified: typecheck +
      build + a live aula RPC round-trip through the new config.
- [x] **Backend setup runbook.** [SELF-HOSTING.md](SELF-HOSTING.md) documents
      `supabase link` → `db push` (migrations already under
      `supabase/migrations/`) → `functions deploy mcp`, plus first-teacher
      signup.
- [x] **One-command / Docker path.** [`Dockerfile`](Dockerfile) +
      [`docker-compose.yml`](docker-compose.yml) build the platform and serve it
      with the public site under nginx (`docker compose up --build` →
      `:8080`), baked with your Supabase URL/key via
      [`scripts/gen-config.mjs`](scripts/gen-config.mjs). The backend stays
      Supabase (cloud or `supabase start`).
- [x] **Fix stale status docs.** `core/README.md` no longer claims
      "boilerplate, front-end only" (backend, real auth and realtime shipped).
- [x] **Licence NOTICE.** [NOTICE](NOTICE) + a README "Licensing" section
      state the MIT single-tenant core vs. the commercial Organisation layer and
      the marks carve-out.

**Track 2 complete** — the OSS core is genuinely self-hostable (config, runbook,
Docker) with an explicit licence boundary.

### Track 3 — Build the Organisation layer (paid)

Sits on the tenancy seam, in a **separate** private repo (not this MIT repo):
`EnsinoLibre/organization`. Its README explains the boundary; `DESIGN.md` records
the open product decisions. Schema, RPCs and the admin console are live/verified;
what remains is org-scoped content sharing and commercial hardening.

- [x] **Schema + seam swap — applied to prod & verified (2026-07-23).**
      `../organization/migrations/0001_org_schema.sql`: `org.organizations` +
      `org.org_members(role)` + `org.org_invites`, `org.is_member`/`is_admin`
      helpers, the `CREATE OR REPLACE` of `el_can_read`/`el_can_write`, the
      reserved `org_id` FKs, org-table RLS, and the schema/execute grants the
      seam functions need. Verified by role simulation: no regression for
      existing teachers/anon; a viewer member reads an org-tagged row but can't
      write it; a non-member sees nothing. Test data torn down; advisors clean.
      (No org rows exist yet, so OSS behaviour is unchanged.)
- [x] **Org CRUD + membership RPCs — applied to prod & verified (2026-07-24).**
      `organization/migrations/0002_org_rpcs.sql`: public `SECURITY DEFINER`
      RPCs (create_org, my_orgs, roster, invite/accept/revoke, role/remove,
      rename) — the only client access path, since the `org` schema isn't
      PostgREST-exposed. Guardrails: authenticated-only, admin-gated, last-admin
      protection, email-matched invite acceptance, seat cap. Verified by role
      simulation.
- [x] **Admin console — built & verified end-to-end (2026-07-24).**
      `organization/admin/` — zero-build console (create org, roster, roles,
      seats, invites). Browser-driven against the live RPCs.
- [x] **`org_id`-on-write — applied to prod & verified (2026-07-24).**
      `organization/migrations/0003_org_write.sql`: a `member_settings` opt-in +
      a `BEFORE INSERT` trigger (keyed on `teacher_id`) that lands a member's new
      resources/worksheets in the shared org KB — for **both** the platform and
      MCP write paths, with **zero core change** (a trigger in the commercial
      layer, so invariant #3 still holds). Verified: with sharing on, new content
      auto-tags `org_id` and a co-member sees it; opt-out keeps it private.
      Console has the per-member toggle.
- [x] **Org KB read surface (platform) — done & verified (2026-07-24).** Turned
      out to be mostly free: `store.js` `hydrate()` already `select('*')`s and
      relies on RLS, so org-shared rows appear automatically once `el_can_read`
      returns them (behaviour-preserving in OSS, where they never do). Added:
      ownership on resource/worksheet state (`ownerId`/`orgId`) + a
      `store.isShared()` helper; a **"👥 Shared" badge** on shared resources and
      worksheets; and shared worksheets hide the "Remove" action (read-only).
      **Plus a security fix** — `20260724120000_seam_write_split.sql`: DELETE on
      the single `ALL` policy only checked `USING`, so a viewer could delete
      org-shared content; the six content tables now use per-command policies
      (read = `el_can_read`, write/update/delete = `el_can_write`). Verified on
      prod: viewer read-only, teacher-member can edit, owner unaffected, OSS
      unchanged (guard §11b still green).
- [~] **Org KB read surface (agent/MCP) — code + DB done; edge-function deploy
      pending.** New seam function `public.el_visible_org_ids(p_user)` (core
      migration `20260724130000`, returns `{}` in OSS; org migration `0004`
      swaps the body to the user's org ids; `service_role`-only). The MCP edge
      function (`supabase/functions/mcp/index.ts`) now fetches those org ids once
      per request and ORs them into the resource/worksheet reads
      (`get_workspace_context`, `list_worksheets`, `search_resources`,
      `get_resource`), marking shared items "(shared, read-only)"; writes and
      idempotency lookups stay owner-only. Both migrations applied to prod and
      `el_visible_org_ids` verified. **Remaining: deploy the edge function** —
      `supabase functions deploy mcp --no-verify-jwt` (needs the Supabase CLI +
      an access token, absent from the current sandbox; not safe to reconstruct
      108 KB of function files inline per HANDOFF §10). Until deployed, agents
      still see own content only.
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
