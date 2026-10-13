# Query Performance Backlog

Reusable query and loading improvements derived from the Phase 4 patient module. Each section can be copied into a GitHub issue for another module.

## 1. URL-backed server pagination

Implemented once in `src/components/shared/useServerPagination.ts` and consumed by `CaregiverList`, `PatientList`, and `UserList`. New list screens should use the hook rather than re-implementing any of the boxes below.

- [x] Define one shared default page size and one allowed page-size list.
- [x] Parse `page` and `pageSize` from route search parameters on the server.
- [x] Treat URL page numbers as one-based and database/DataGrid page numbers as zero-based.
- [x] Reject unsupported, negative, fractional, or malformed values and use safe defaults.
- [x] Pass the parsed pagination model into both the initial database query and client grid.
- [x] Update the URL when the user changes page or rows per page so reload/back/share preserves the selection.
- [x] Preserve unrelated filters and search parameters while updating pagination.
- [x] Reset to page one when a filter or sort changes.
- [x] Skip the mount fetch — the server component already rendered that exact page (also makes StrictMode's double mount a no-op).
- [x] Discard out-of-order responses so rapid page/page-size changes cannot paint an older page over a newer one.
- [x] Clamp a page that no longer exists (rows archived out from under it, or a hand-edited `?page=99`) back to the last valid page.

**Acceptance criteria**

- Initial SSR fetch size always matches the grid's selected rows-per-page option.
- A reload preserves page and page size.
- The browser never downloads the entire table merely to display one page.
- **Seed/demo data must exceed the default page size**, or pagination cannot be exercised at all and correct behaviour reads as a bug.

## 2. Database-side pagination and counts

- [x] Request an exact row count with the same filters used by the data query.
- [x] Apply deterministic ordering before `.range(start, end)`.
- [x] Return a page object such as `{ rows, rowCount }`, not a bare array.
- [x] Keep page calculations in the service, not components.
- [ ] Add or verify indexes for organization scope, common filters, and ordering columns.

**Acceptance criteria**

- The database returns no more than the selected page size.
- `rowCount` reflects the filtered query.
- Pagination is stable when records are added between requests.
- **Every filter must run in the database, never in JS after the fetch.** A post-fetch
  `.filter()` silently breaks pagination: the exact count still includes the excluded
  rows and each page renders fewer than `pageSize`. `listOrgMembers` had exactly this
  bug — it dropped `Pending` profiles in JS — and now uses an inner-joined embed instead.
- **Order by something unique.** `joined_at`/`created_at` are not unique, so a secondary
  `id` sort is required or rows can repeat or vanish across page boundaries.

## 3. List-specific projections

- [x] Select only columns rendered in the list.
- [x] Exclude clinical, restricted, large JSON, encrypted, and detail-only columns.
- [x] Join only small display fields needed by the grid, such as creator name.
- [x] Define a dedicated list-row type instead of reusing the full entity type.

**Acceptance criteria**

- No `select('*')` is used for a paginated list.
- Sensitive/detail-only data is absent from the list response.

## 4. Parent-first detail loading

- [ ] Fetch the primary entity first so missing/unauthorized records fail quickly.
- [ ] Render the page shell and primary details as soon as the parent is available.
- [ ] Start independent child queries without awaiting them as one blocking `Promise.all`.
- [ ] Stream independent sections through separate Suspense boundaries.
- [ ] Give each boundary a stable, compact loading state.

**Acceptance criteria**

- A slow child table does not delay the primary detail section.
- One failed or empty child query does not prevent unrelated sections from rendering.

## 5. Bounded detail previews

- [ ] Display a fixed preview size, currently three rows.
- [ ] Query `preview size + 1` rows; the extra row is only a sentinel indicating more data exists.
- [ ] Render only the first preview-size rows.
- [ ] Show a centered `View more` link only when the sentinel row exists.
- [ ] Route `View more` to the dedicated full-table page.

**Acceptance criteria**

- A detail dashboard never loads an unbounded child table.
- Exactly three rows are displayed when four or more exist.
- No separate count query is needed solely to show `View more`.

## 6. Full data only on dedicated pages

- [ ] Load the complete relevant collection only on its list/manage route.
- [ ] Keep detail dashboards to bounded previews.
- [ ] Add server pagination to dedicated pages once collections can grow beyond small business limits.
- [ ] Preserve existing permission and organization filters on both preview and full queries.

## 7. Single-record edit queries

- [ ] Add `getChild(orgId, parentId, childId)` service functions.
- [ ] Filter by organization ID, parent ID, child ID, and active/archive state.
- [ ] Replace `listChildren(...).find(id)` on edit routes.
- [ ] Return `null` on read failure using the repository's established read-error convention.

**Acceptance criteria**

- Opening an edit form retrieves one child row, not the entire sibling collection.
- Cross-organization and cross-parent IDs cannot resolve.

## 8. Avoid repeated server-page authorization work

- [ ] Server pages perform the standard auth, membership, and permission preamble once.
- [ ] After authorization, server pages call read services directly.
- [ ] Reserve server actions for client-triggered reads/mutations and revalidation.
- [ ] Keep authorization in actions because client-triggered calls still cross a trust boundary.

## 9. Parallelize only genuinely independent required queries

- [ ] Use `Promise.all` on dedicated pages when every result is required before that page can render.
- [ ] Do not use one blocking `Promise.all` for independent dashboard sections that can stream.
- [ ] Start independent promises as early as possible after required identifiers and permissions are known.
- [ ] Avoid sequential request waterfalls unless one query depends on the previous result.

## 10. Tests required for each optimized module

- [ ] Service test: correct projection and organization filter.
- [ ] Service test: correct database range for page and page size.
- [ ] Service test: filtered row count returned.
- [ ] Service test: bounded preview applies the sentinel limit.
- [ ] Service test: single-child query includes organization, parent, child, and active filters.
- [ ] Component test: only three preview rows render.
- [ ] Component test: `View more` appears only when a fourth row exists.
- [ ] Pagination utility test: valid options, invalid fallback, one-based/zero-based conversion, and parameter preservation.
- [ ] Full module tests, TypeScript, and ESLint remain clean.

## User management application backlog

- [ ] Convert members grid to URL-backed server pagination.
- [ ] Convert pending invites grid to URL-backed server pagination.
- [ ] Replace full membership/profile projections with list-specific fields.
- [ ] Move status, role, and search filters into the database query.
- [ ] Return `{ rows, rowCount }` from member and invite list services.
- [ ] Fetch one membership directly for view/edit routes instead of loading the member list.
- [ ] Fetch role and permission detail only on the member detail/edit route.
- [ ] Stream independent member-detail sections if they require separate queries.
- [ ] Add bounded previews for audit/access-review history when those sections are introduced.
- [ ] Add the pagination, scope, projection, and single-record tests listed above.
