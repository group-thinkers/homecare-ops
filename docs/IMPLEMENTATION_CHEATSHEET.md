# IMPLEMENTATION_CHEATSHEET.md — How every phase is built in this repo

> Feed this file (plus the relevant phase section of `implementation-plan.md`, `docs/DATABASE.md`,
> `docs/QUERY_PERFORMANCE_BACKLOG.md`, and `docs/API_AUTHORIZATION_OPTIMIZATION_PLAN.md`)
> with any implementation prompt. It is derived from the code that already exists (patients + users modules)
> and is **prescriptive**: match these patterns exactly; do not invent new layers, folders, or styles.

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Zod 4 · Supabase (`@supabase/ssr`) · MUI Material 9 + `@mui/x-data-grid` · Vitest 4 + jsdom.
Read `node_modules/next/dist/docs/` before using a Next API you're unsure about — this Next version differs from training data.

---

## 0. Build order for a phase (always the same)

```
1. Migration      supabase/migrations/000NN_<phase>_rpcs.sql     → RPCs / indexes / policy tweaks. Update docs/DATABASE.md §6, §10 + "Applied through".
2. Types          src/types/index.ts                             → row types (already exist for all tables), new enums, register RPCs in Database.Functions.
3. Schemas        src/lib/schemas/<domain>.schema.ts             → Zod input schemas (.strict()), inferred Input types.
4. Service        src/lib/services/<domain>.service.ts           → all Supabase calls. No auth checks here (RLS + RPC enforce).
5. Actions        src/app/(dashboard)/<route>/actions.ts         → 'use server'; auth → validate → permission → service → revalidate.
6. Pages          src/app/(dashboard)/<route>/**/page.tsx        → server components: auth, membership, permission, fetch, render client component.
7. Components     src/app/(dashboard)/<route>/_components/*.tsx  → 'use client'; List (DataGrid) / Core (detail) / Form (dumb) / Edit (form controller).
8. Nav            src/app/(dashboard)/DashboardFrame.tsx         → add sidebar entry; middleware.ts PROTECTED_ROUTES already lists /caregivers /shifts /call-offs.
9. Tests          tests/unit/actions/<domain>.actions.test.ts, tests/unit/services/<domain>.service.test.ts, tests/unit/schemas/<domain>.schema.test.ts
10. Verify        npx vitest run && npx tsc --noEmit && npx eslint . ; update docs/DATABASE.md; tick boxes in implementation-plan.md
```

Deliver **the whole vertical slice for one entity** (steps 1–9) before starting the next entity. Prefer many small commits: `feat(caregivers): add credential schema/service/actions + tests`.

---

## 1. Naming

| Thing | Convention | Example |
|---|---|---|
| Migration file | `000NN_snake_case.sql`, zero-padded, next number after the highest in `supabase/migrations/` | `00013_caregiver_rpcs.sql` |
| RPC / SQL function | `snake_case` verb-first; args prefixed `target_` for ids, plain names for data | `create_caregiver(target_org_id uuid, first_name text, …)` |
| Zod schema | `PascalCase` + `Schema`; inferred type = same name minus `Schema` + `Input` | `CreateCaregiverSchema`, `CreateCaregiverInput` |
| Service fn | `camelCase` verb: `list*`, `get*`, `create*`, `update*`, `upsert*`, `archive*`, `deactivate*` | `listCaregivers`, `upsertCredential` |
| Server Action | service name + `Action` | `createCaregiverAction` |
| Route folder | plural kebab-case; dynamic segment `[entityId]`; sub-resources singular | `caregivers/[caregiverId]/credential/[credentialId]/edit` |
| Client component | `PascalCase` with role suffix: `<Entity>List`, `<Entity>Core`, `<Entity>Form`, `<Entity>Edit`, `<Sub>List`, `<Sub>Form` | `CaregiverList`, `CredentialForm` |
| DB columns in TS | **snake_case, identical to SQL** (no camelCase mapping). Only the control fields `organizationId`, `patientId`, `caregiverId`, … in schema inputs are camelCase. | `first_name`, `effective_start_date` |
| Test file | `tests/unit/<layer>/<domain>.<layer>.test.ts` | `tests/unit/actions/caregivers.actions.test.ts` |
| Section comments | `// ─── Title ───…` (box-drawing rule to ~80 cols) in every TS file; `-- ====` banners in SQL | see any existing file |

---

## 2. Migrations (`supabase/migrations/000NN_*.sql`)

**When you need one:** any RPC, index, policy change, constraint, or reference-data insert. You almost never need a new table for Phases 5–9 — the schema is complete (`docs/DATABASE.md` §4).

**When to write an RPC instead of client-side supabase-js:**
- Two or more tables change together (transaction) — e.g. create shift + history row.
- A write needs a check RLS can't express (version check, "no overlapping shift", "one active rate").
- The target table has no `authenticated` INSERT/UPDATE policy (`DATABASE.md` §2 table).
- Otherwise, a plain `.from().insert()/update()` in the service is fine — RLS is the guard.

**Template** (copy exactly — header, helper, function, grants):

```sql
-- ============================================================
-- Migration: <Domain> operations RPCs
-- Purpose:
-- - <bullet>
-- - Authorization enforced via has_org_permission() (<perm>)
-- ============================================================

create or replace function public.can_manage_org_caregivers(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_permission(org_id, 'caregivers.manage');
$$;

-- ============================================================
-- 1. <verb_noun>
-- ============================================================

create or replace function public.<verb_noun>(
  target_org_id uuid,
  target_<parent>_id uuid,
  <data args, with `default null` for optional>
)
returns public.<table>          -- or: returns setof public.<table> / returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.<table>;
begin
  if not public.can_manage_org_caregivers(target_org_id) then
    raise exception 'Not authorized to manage caregivers for this organization';
  end if;

  -- validate enums explicitly (text + check constraints give ugly errors)
  if <enum_arg> not in ('A', 'B') then
    raise exception 'Invalid <enum_arg>';
  end if;

  -- verify parent belongs to org (composite FK also protects, but fail early)
  if not exists (select 1 from public.<parent> where id = target_<parent>_id and organization_id = target_org_id) then
    raise exception '<Parent> not found';
  end if;

  insert into public.<table> (organization_id, <parent>_id, ..., created_by_user_id)
  values (target_org_id, target_<parent>_id, ..., auth.uid())
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.<verb_noun>(uuid, uuid, <arg types>) from public;
grant execute on function public.<verb_noun>(uuid, uuid, <arg types>) to authenticated;
```

Rules:
- Always `security definer` + `set search_path = public` + explicit `revoke/grant` with the **full argument type list**.
- Use `auth.uid()` for `created_by_user_id` / `approved_by_user_id` / `changed_by_user_id` — never pass the user id from the client.
- Optimistic concurrency on `shifts`: `update … set version = version + 1 where id = … and version = expected_version; if not found then raise exception 'Shift was modified by another user'; end if;`
- Append-only tables (`shift_assignment_history`, `call_off_outreach_events`, `operational_history_events`) are written **only** inside RPCs.
- Never `delete`. Set `archived_at`, `active = false`, or a status.
- Reference-data migrations (rulesets, templates) use `insert … on conflict (<natural key>) do update` so re-runs are idempotent (see `00012`).
- After writing: update `docs/DATABASE.md` (§6 inventory, §10 table, header) and register the RPC in `Database.Functions` (§3 below).
- Deploy flow is in `docs/MIGRATIONS.md` — you never paste SQL into the dashboard anymore.

---

## 3. Types (`src/types/index.ts`)

Hand-written, single file, four sections: **Enums → ActionResponse → row types by domain → `Database`**.

- Row types already exist for all 34 tables. Only **add** what's new: enums, RPC return shapes, joined shapes (`XWithY`), and `Database.Functions` entries.
- Enums are string-literal unions; if a Zod schema also needs the list, export a `const … = [...] as const` array and derive the type (pattern: `ORG_ROLES` / `OrgRole`).
- Joined query results get a named type: `export type CaregiverWithCredentials = Caregiver & { credentials: CaregiverCredential[] }`.
- **Register every new RPC** so `supabase.rpc('name', args)` is typed and `as never` casts are not needed:

```ts
Functions: {
  …
  create_caregiver: {
    Args: { target_org_id: string; first_name: string; last_name: string; classification: CaregiverClassification; email?: string | null; … }
    Returns: Caregiver
  }
}
```
- `Insert`/`Update` are `Partial<Row>` via `TableDef<T>` — that's why services cast `as never` on insert payloads today. Keep the cast for inserts; never widen `TableDef`.
- Fix the drift listed in `docs/DATABASE.md` §9 when you touch that domain.

---

## 4. Zod schemas (`src/lib/schemas/<domain>.schema.ts`)

Pattern (from `patients.schema.ts`):

```ts
import { z } from 'zod'
import { CAREGIVER_CLASSIFICATIONS } from '@/types'   // only if an exported const array exists

const classificationEnum = z.enum(['RN', 'LPN', 'HHA', 'STNA'] as const)

const uuidShape = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Invalid UUID',
)
const dateShape = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
const timeShape = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format (HH:MM)')

// ─── Create Caregiver ─────────────────────────────────────────────────────────

export const CreateCaregiverSchema = z.object({
  organizationId: uuidShape,                 // ALWAYS first; camelCase control field
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email().nullable().optional(),
  classification: classificationEnum,
  max_hours_per_week: z.number().min(0).max(168).nullable().optional(),
}).strict()

export type CreateCaregiverInput = z.infer<typeof CreateCaregiverSchema>

// ─── Update Caregiver ─────────────────────────────────────────────────────────

export const UpdateCaregiverSchema = z.object({
  organizationId: uuidShape,
  caregiverId: uuidShape,
  first_name: z.string().min(1).optional(),
  …
}).strict().refine(
  (obj) => Object.keys(obj).length > 2,      // control fields + at least one data field
  'At least one field must be updated',
)
```

Rules:
- Every schema ends in `.strict()`. Every mutation schema begins with `organizationId` and the target ids (`caregiverId`, `credentialId`, …).
- Optional nullable DB columns → `.nullable().optional()`. Required DB columns → required.
- Dates are `YYYY-MM-DD` strings, times `HH:MM`, timestamps ISO strings — **never `z.date()`** (Server Action inputs are JSON).
- Cross-field rules via `.refine()` with a message: `end_time > start_time`, `effective_end_date >= effective_start_date`, `end_datetime > start_datetime`.
- Read/list actions take plain `(orgId, id, filters?)` args and do **not** get a schema (see §6). Only mutations are validated.
- One `<domain>.schema.ts` per domain even if it holds 8 schemas. Sub-entities (credentials, availability) live in the parent domain file.

---

## 5. Services (`src/lib/services/<domain>.service.ts`)

Services are the **only** place that touches Supabase. They know nothing about auth or permissions (RLS + RPC enforce it), and never import from `next/*`.

```ts
import { createClient } from '@/lib/db/client'
import type { Caregiver, CaregiverCredential } from '@/types'

type CredentialInput = { credential_type: string; credential_name: string; expiration_date?: string | null; … }

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listCaregivers(
  orgId: string,
  filters?: { classification?: string; matching_status?: string },
): Promise<Caregiver[]> {
  const supabase = await createClient()

  let query = supabase
    .from('caregivers')
    .select('*')
    .eq('organization_id', orgId)
    .is('archived_at', null)

  if (filters?.classification) query = query.eq('classification', filters.classification)

  const { data, error } = await query.order('last_name', { ascending: true })

  if (error) {
    console.error('[listCaregivers] query failed:', { orgId, filters, error })
    return []                                   // reads: log + return empty/null
  }
  return (data ?? []) as Caregiver[]
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export async function getCaregiver(orgId: string, caregiverId: string): Promise<Caregiver | null> { … .single(); on error return null }

// ─── Create (RPC) ─────────────────────────────────────────────────────────────

export async function createCaregiver(orgId: string, userId: string, data: {...}): Promise<Caregiver> {
  const supabase = await createClient()
  const { data: row, error } = await supabase.rpc('create_caregiver', {
    target_org_id: orgId,
    first_name: data.first_name,
    …
  })
  if (error) {
    console.error('[createCaregiver] RPC failed:', { orgId, userId, error })
    throw new Error(error.message)              // writes: log + throw
  }
  return row as Caregiver
}

// ─── Update (direct) ──────────────────────────────────────────────────────────

export async function updateCaregiver(orgId, caregiverId, userId, data): Promise<Caregiver> {
  const updateData: Record<string, unknown> = { updated_by_user_id: userId, updated_at: new Date().toISOString() }
  if (data.first_name !== undefined) updateData.first_name = data.first_name
  …
  const { data: row, error } = await supabase.from('caregivers').update(updateData as never)
    .eq('id', caregiverId).eq('organization_id', orgId).select().single()
  …
}
```

Rules:
- Signature order: `(orgId, [parentId], [entityId], userId?, data?)`. `userId` only where the service stamps `updated_by_user_id`.
- **Every query filters `.eq('organization_id', orgId)`** even though RLS would — defence in depth and explicit intent.
- Reads: log `[fnName] … failed:` with context and return `[]` / `null`. Writes: log and `throw new Error(error.message)`.
- Log objects never include PHI values — ids and filters only.
- Sensitive fields are excluded **here**, not in the UI: e.g. `listCaregivers` must never select `caregiver_compensation_rates`; compensation has its own `listCompensationRates` gated by the action's permission check.
- The service-role admin client (`@/lib/db/admin`) is **only** for `auth.admin.*` (invites). Do not use it to bypass RLS — write an RPC.
- `upsert*` for "one active row per key" = deactivate existing (`active = false`) then insert, or an RPC that does both (pattern: `upsertPatientAddress` / `upsert_patient_requirement`).
- Complex read shapes use PostgREST embedding: `.select('*, credentials:caregiver_credentials(*)')`. Name the alias to match the TS joined type.

---

## 6. Server Actions (`src/app/(dashboard)/<route>/actions.ts`)

One `actions.ts` per top-level route, `'use server'` at the top, one exported async function per service function. Two shapes only:

**Read action** — plain args, no schema, permission = the read permission, error is always `'Not authorized.'`:

```ts
export async function listCaregiversAction(
  orgId: string,
  filters?: { classification?: string },
): Promise<ActionResponse<Caregiver[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'caregivers.manage')
    const data = await caregiversService.listCaregivers(orgId, filters)
    return { success: true, data }
  } catch (err) {
    console.error('[listCaregiversAction] failed:', { orgId, filters, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}
```

**Mutation action** — `input: unknown`, Zod first, then permission from `parsed.data.organizationId`, then service, then `revalidatePath`:

```ts
export async function createCaregiverAction(input: unknown): Promise<ActionResponse<Caregiver>> {
  try {
    const user = await requireAuth()
    const parsed = CreateCaregiverSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[createCaregiverAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'caregivers.manage')
    const data = await caregiversService.createCaregiver(parsed.data.organizationId, user.id, {
      first_name: parsed.data.first_name,
      …                                          // explicit field mapping — no spread of parsed.data
    })
    revalidatePath('/caregivers')
    return { success: true, data }
  } catch (err) {
    console.error('[createCaregiverAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}
```

Rules:
- Order is fixed: **auth → validate → permission → service → revalidate**. `requireAuth()` first so unauthenticated callers never see validation output.
- Imports: `requireAuth` from `@/lib/auth/server`, `requirePermission` from `@/lib/permissions`, schemas from `@/lib/schemas/…`, `import * as xService from '@/lib/services/x.service'`, types from `@/types`.
- `ActionResponse<T>` is the only return type. `fieldErrors` for Zod failures, `error` for everything else.
- Permission per action: reads use the read permission (`patients.read_basic`, `caregivers.manage`, `shifts.manage`), writes use the manage permission. Compensation reads/writes additionally `requirePermission(orgId, 'caregivers.read_compensation')`.
- `revalidatePath` targets: list route on create/archive; `/<route>/<id>` on update of the entity or any sub-entity.
- Actions may be called from **server components** for initial data (`page.tsx` does this) and from **client components** for mutations/refresh.
- Never call Supabase or import `@/lib/db/*` in an action.

---

## 7. Pages (`src/app/(dashboard)/<route>/**/page.tsx`)

Server components, no `'use client'`. Route map per entity (mirror `patients/`):

```
<route>/page.tsx                                   list           perm: read
<route>/create/page.tsx                            create form    perm: manage
<route>/[id]/page.tsx                              detail (Core)  perm: read
<route>/[id]/edit/page.tsx                         edit core      perm: manage
<route>/[id]/<sub>/page.tsx                        sub-list       perm: read
<route>/[id]/<sub>/new/page.tsx                    sub-create     perm: manage
<route>/[id]/<sub>/[subId]/edit/page.tsx           sub-edit       perm: manage
```

Template (identical preamble every time):

```tsx
import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import { getCaregiverAction, listCredentialsAction } from '../actions'
import CaregiverCore from '../_components/CaregiverCore'

interface CaregiverPageProps {
  params: Promise<{ caregiverId: string }>          // params is a Promise in this Next version
}

export default async function CaregiverPage({ params }: CaregiverPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'caregivers.manage')
  if (!allowed) {
    return <UnauthorizedMessage />
  }

  const { caregiverId } = await params
  const orgId = membership.organization_id

  const [caregiverResult, credentialsResult] = await Promise.all([
    getCaregiverAction(orgId, caregiverId),
    listCredentialsAction(orgId, caregiverId),
  ])
  const caregiver = caregiverResult.success ? caregiverResult.data ?? null : null

  if (!caregiver) {
    return <Typography sx={{ p: 3 }}>Caregiver not found.</Typography>
  }

  return (
    <CaregiverCore
      caregiver={caregiver}
      orgId={orgId}
      credentials={credentialsResult.success ? credentialsResult.data ?? [] : []}
    />
  )
}
```

Rules:
- Org comes from `getActiveMembership()` — **never** from a query param or the client.
- Permission gate renders `<UnauthorizedMessage />`; missing entity renders the "not found" `Typography`.
- Fetch in parallel with `Promise.all`. Pass plain data + `orgId` down to one client component. No fetching in client components on mount — they receive `initial*` props and re-fetch only on user action (refresh/after mutation).
- Placeholder page for a not-yet-built feature: same preamble, body `<Typography sx={{ p: 3 }}>X isn't available yet. Check back soon</Typography>` (see `patients/[patientId]/matching/page.tsx`).
- Add the route to `DashboardFrame.tsx` `navigation` (`{ kind: 'page', id, title, icon, href }`) and, if it's a new top-level path, to `middleware.ts` `PROTECTED_ROUTES`.

---

## 8. Client components (`src/app/(dashboard)/<route>/_components/`)

All `'use client'`. Use the **crud-dashboard template pieces** — never raw HTML forms/tables, never a new design system:

| Import | Use |
|---|---|
| `PageContainer` from `@/components/templates/crud-dashboard/components/PageContainer` | wraps every screen: `title`, `breadcrumbs=[{title, path?}]`, `actions` slot |
| `useDialogs()` from `…/hooks/useDialogs/useDialogs` | `await dialogs.confirm(msg, { title, severity: 'warning', okText })` before destructive actions |
| `useNotifications()` from `…/hooks/useNotifications/useNotifications` | `notifications.show(msg, { severity: 'success'|'error', autoHideDuration: 3000|4000 })` after every action result |
| `DataGrid`, `GridActionsCellItem`, `GridColDef`, `gridClasses` from `@mui/x-data-grid` | all lists |
| MUI: `Box Button Chip Stack TextField Select MenuItem FormControl InputLabel Alert Card Divider Typography Tooltip IconButton CircularProgress` | forms/detail |
| `@mui/icons-material/{Add,Refresh,Edit,Archive,ArrowBack,Autorenew}` | actions |

Four component roles per entity:

**`<Entity>List`** — props `{ orgId, initial<Entities> }`. State: `rows`, `isLoading`, `error`. `loadData` calls the list action; header `actions` = Refresh icon button + "Create <entity>" contained button (`router.push('/<route>/create')`); columns via `React.useMemo<GridColDef<Entity>[]>`; status column renders `<Chip size="small" variant="outlined" color={STATUS_COLOR[value]}>`; last column `type: 'actions'` with View (→ detail) and Archive (`dialogs.confirm` → action → `notifications.show` → `loadData()`). DataGrid props: `getRowId={(r) => r.id} disableRowSelectionOnClick showToolbar pageSizeOptions={[5,10,25]}` and the `gridClasses` outline reset `sx` from `PatientList`. Filters (status/classification tabs) are `Chip`s or a `Select` in the `actions` slot that set a filter state passed to `loadData`.

**`<Entity>Core`** — detail page. Props `{ entity, orgId, <sub-lists> }`. `PageContainer` with breadcrumbs `[{ title: 'Caregivers', path: '/caregivers' }, { title: fullName }]`; body is a stack of `InfoSection` cards (copy the `InfoSection` helper from `PatientCore`) each with an Edit/Manage button that `router.push`es to the sub-route. Show restricted sections (compensation) **only** if the page passed a `canReadCompensation` boolean it computed with `hasPermission`.

**`<Entity>Form`** — dumb, controlled. Props: `formState: { values, errors }`, `hasChanges`, one `on<Field>Change` per field, `onSubmit`, `onReset`, `onBackClick?`, `isSubmitting`. `<Box component="form" onSubmit>` with `TextField`s (`error={!!errors.x} helperText={errors.x} disabled={isSubmitting}`), `Select` inside `FormControl`+`InputLabel` for enums, date `TextField type="date" InputLabelProps={{ shrink: true }}`. Footer: `Chip` "Unsaved Changes"/"No Changes", Reset + Save buttons (disabled unless `hasChanges`), Back button.

**`<Entity>Edit`** (and `<Entity>Create`) — form controller. Holds `formState`, computes `hasChanges` by JSON-comparing normalized values against `initialValues`, does light required-field checks, calls the action, maps `result.fieldErrors` into `formState.errors` (`Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, v[0]]))`), shows a notification, then `router.push(detail)` + `router.refresh()`. Wrapped in `PageContainer` with breadcrumbs.

Sub-entities (credentials, availability, addresses, services on an authorization) get `<Sub>List` (DataGrid inside the parent's sub-route page, rows come from props) and `<Sub>Form` (+ tiny controller in the `new`/`edit` page component). Mirror `PatientAddressList` / `PatientAddressForm` / `RequirementList` / `RequirementForm`.

Rules:
- No business logic, no Supabase, no permission checks in components — they call actions and render.
- Never display compensation, auth numbers, credential numbers, or diagnoses in a list column.
- Currency/score formatting inline (`toFixed(2)`); dates via `new Date(x)` + DataGrid `type: 'date'`.
- Keep the MUI theme untouched; no `sx` beyond layout spacing and the grid outline reset.

---

## 9. Tests (`tests/unit/`)

Runner: `npx vitest run` (jsdom, globals, alias `@ → src`). Three test files per domain.

**Actions test** — mock everything below the action:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/server',  () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/permissions',  () => ({ requirePermission: vi.fn() }))
vi.mock('next/cache',         () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/services/caregivers.service', () => ({
  listCaregivers: vi.fn(), createCaregiver: vi.fn(), …
}))

import { requireAuth }       from '@/lib/auth/server'
import { requirePermission } from '@/lib/permissions'
import { revalidatePath }    from 'next/cache'
import * as service          from '@/lib/services/caregivers.service'
import { listCaregiversAction, createCaregiverAction } from '@/app/(dashboard)/caregivers/actions'

const mockRequireAuth       = requireAuth       as ReturnType<typeof vi.fn>
const mockRequirePermission = requirePermission as ReturnType<typeof vi.fn>
const mockCreate            = service.createCaregiver as ReturnType<typeof vi.fn>

const ORG_ID  = '00000000-0000-0000-0000-000000000001'
const USER_ID = '00000000-0000-0000-0000-000000000003'

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ id: USER_ID })
  mockRequirePermission.mockResolvedValue(undefined)
})

describe('createCaregiverAction', () => {
  it('returns fieldErrors when first_name missing', async () => { … expect(result.fieldErrors?.first_name).toBeDefined(); expect(mockCreate).not.toHaveBeenCalled() })
  it('rejects unknown fields (strict)', async () => { … { …valid, extra: 1 } … expect(result.success).toBe(false) })
  it('checks permission with the org from input', async () => { … expect(mockRequirePermission).toHaveBeenCalledWith(ORG_ID, 'caregivers.manage') })
  it('calls service with user id and mapped fields, revalidates', async () => { … expect(mockCreate).toHaveBeenCalledWith(ORG_ID, USER_ID, expect.objectContaining({ first_name: 'A' })); expect(revalidatePath).toHaveBeenCalledWith('/caregivers') })
  it('returns error when unauthenticated', …)          // mockRequireAuth.mockRejectedValue
  it('returns error when caller lacks permission', …)  // mockRequirePermission.mockRejectedValue
  it('returns service error message on throw', …)
})
```

Required cases for **every** action: success · unauthenticated · forbidden · (mutations) each required field missing · unknown field rejected · service throw → `success:false`.

**Service test** — mock `@/lib/db/client` with a chainable fake (copy `makeSupabase` from `users.service.test.ts`; extend with `is`, `in`, `gte`, `lte`, `limit`, `insert`, `update`, `select` as needed, all `mockReturnThis()`, terminal `single`/`order`/`rpc` return `{ data, error }`). Assert: correct table, `.eq('organization_id', orgId)` called, RPC name + args, return on success, `[]`/`null` on read error, throw on write error.

**Schema test** (`tests/unit/schemas/<domain>.schema.test.ts`) — for each schema: valid payload parses; each enum rejects a bad value; `.strict()` rejects extra key; refinements (date ordering, "at least one field").

**Pure logic** (matching scoring, rate resolution, conflict detection) lives in `src/lib/services/<x>.service.ts` as exported pure functions with **no Supabase** so they can be tested directly with fixtures — this is the bulk of Phase 8 testing.

Test data rules: synthetic only, fixed UUID constants, no real names/addresses/DOBs.

---

## 10. Definition of Done — per entity slice (paste into every prompt)

- [ ] Migration file added (if any RPC/index/policy), header comment, grants; `docs/DATABASE.md` §6/§10 + "Applied through" updated
- [ ] `src/types/index.ts`: new enums/joined types; new RPCs registered in `Database.Functions`; no `as never` on `rpc()` calls
- [ ] `src/lib/schemas/<domain>.schema.ts`: `.strict()` schemas + exported `*Input` types
- [ ] `src/lib/services/<domain>.service.ts`: org filter on every query; log+return for reads, log+throw for writes; sensitive fields excluded
- [ ] `src/app/(dashboard)/<route>/actions.ts`: auth → validate → permission → service → revalidate; `ActionResponse<T>`
- [ ] `docs/API_AUTHORIZATION_OPTIMIZATION_PLAN.md` applied: request-local auth/org reuse, explicit projections, bounded/paginated reads, no per-row calls or interactive maintenance writes, and transactional multi-step mutations
- [ ] Pages for list / create / detail / edit (+ sub-routes) with identical preamble; nav entry added
- [ ] `_components/`: `<Entity>List` (DataGrid), `<Entity>Core`, `<Entity>Form`, `<Entity>Edit` using PageContainer / useDialogs / useNotifications
- [ ] Tests: actions + service + schema files; `npx vitest run` green
- [ ] `npx tsc --noEmit` and `npx eslint .` clean
- [ ] Checkboxes ticked in `implementation-plan.md`; commit message `feat(<domain>): …`

---

## 11. Prompt template

```
Read docs/IMPLEMENTATION_CHEATSHEET.md, docs/DATABASE.md, docs/QUERY_PERFORMANCE_BACKLOG.md, docs/API_AUTHORIZATION_OPTIMIZATION_PLAN.md, and docs/implementation-plan.md §<N>.
Implement <Phase N — Entity/Slice> end-to-end following the cheatsheet exactly:
migration (if needed) → types → schema → service → actions → pages → components → tests.
Constraints: <anything phase-specific — e.g. "compensation gated by caregivers.read_compensation in the action AND hidden in Core unless canReadCompensation">.
Existing reference implementation to mirror: src/app/(dashboard)/patients/** and src/lib/{schemas,services}/patients.*.
Optimization is a required part of implementation, not a later cleanup pass. Apply API_AUTHORIZATION_OPTIMIZATION_PLAN.md and the phase's optimization checklist wherever immediately feasible: reuse request-local auth/membership/permission context; derive organization context on the server; use URL-backed database pagination, explicit projections, deterministic ordering, and bounded page-specific detail read models; keep separately permissioned sensitive data in separate queries; never issue one Supabase call per displayed row; perform no maintenance writes during interactive reads; use one RLS-protected transactional RPC for multi-step state changes; and never use the service-role client for ordinary user workflows.
Apply QUERY_PERFORMANCE_BACKLOG.md consistently: fetch the parent first, consolidate bounded related previews when safe, stream only genuinely independent sections, render three preview rows plus one sentinel for View more, load full collections only on dedicated pages, and use scoped single-record queries for edit routes. Do not load an entire table to render a page, preview, or one edit form.
Treat scheduled/cron maintenance, durable background queues, materialized summaries, automatic archival/partitioning, and external performance dashboards as stretch goals unless correctness requires them. Record them without blocking the immediately feasible implementation.
Add tests for organization scope, authorization isolation, explicit projections, pagination/bounds, no per-row requests, no interactive maintenance RPCs, transactional/idempotent mutations, and the representative route request budget.
Finish with: npx vitest run, npx tsc --noEmit, npx eslint . — all green. Then update docs/DATABASE.md and tick the plan.
Do not restyle, refactor, or touch unrelated modules. DO NOT WASTE MY DAMN tokens. If you can't figure something out in 2 tries, stop and ask for help.
```
