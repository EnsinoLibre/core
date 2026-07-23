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

Sits on the tenancy seam, in a **separate** module (not this MIT repo):
`../organization/` — **drafted, not applied.** Its README explains the boundary;
`migrations/0001_org_schema.sql` is the follow-up migration and `DESIGN.md`
records the open product decisions.

- [x] **Draft the schema + seam swap.** `../organization/migrations/0001_org_schema.sql`:
      `org.organizations` + `org.org_members(role)` + `org.org_invites`, an
      `org.is_member` helper, the `CREATE OR REPLACE` of
      `el_can_read`/`el_can_write` (signatures verified to match core exactly),
      the reserved `org_id` FKs, and RLS on the org tables. Draft only.
- [ ] **Validate on a Supabase branch** — apply the draft to a branch DB, insert
      org + members + a shared row, verify by role simulation (member reads,
      viewer can't write, non-member sees nothing). Not yet run.
- [ ] **`org_id`-on-write** — set `org_id` at core's MCP + `store.js` insert
      sites (the only core-side change; DESIGN.md decision 1).
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
