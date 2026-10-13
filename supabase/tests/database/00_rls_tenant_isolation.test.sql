-- Row level security: tenant isolation and permission gating.
-- Run with `supabase test db` (CI: the "migrations" job). Everything happens inside one transaction and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

-- ------------------------------------------------------------------
-- Fixtures (inserted as the superuser, which bypasses RLS)
-- ------------------------------------------------------------------
-- Org A: admin, scheduler, hr, clinical, a suspended member, a member with an expiring grant. Org B: admin.
-- "outsider" belongs to no organization.
create function pg_temp.mk_user(uid uuid, nm text) returns void language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', nm || '@example.test', '', now(), now());
  insert into public.user_profiles (id, first_name, last_name, access_status) values (uid, nm, 'Test', 'Active');
$$;

select pg_temp.mk_user(u, n) from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'adminA'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'schedulerA'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'hrA'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'clinicalA'),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'suspendedA'),
  ('a0000000-0000-0000-0000-000000000006'::uuid, 'grantedA'),
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'adminB'),
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'outsider')
) as t(u, n);

insert into public.organizations (id, name, timezone) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Org A', 'America/Chicago'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Org B', 'America/Chicago');

insert into public.organization_memberships (id, organization_id, user_id, roles, status) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', '{"Agency Administrator"}', 'Active'),
  ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', '{"Scheduler"}', 'Active'),
  ('a1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', '{"HR Coordinator"}', 'Active'),
  ('a1000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', '{"Clinical Manager"}', 'Active'),
  ('a1000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', '{"Agency Administrator"}', 'Suspended'),
  ('a1000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000006', '{"Scheduler"}', 'Active'),
  ('b1000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', '{"Agency Administrator"}', 'Active');

insert into public.patients (id, organization_id, first_name, last_name, created_by_user_id) values
  ('a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'Pat', 'InA', 'a0000000-0000-0000-0000-000000000001'),
  ('b2000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'Pat', 'InB', 'b0000000-0000-0000-0000-000000000001');

insert into public.caregivers (id, organization_id, first_name, last_name, classification, created_by_user_id) values
  ('a3000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'Care', 'InA', 'HHA', 'a0000000-0000-0000-0000-000000000001'),
  ('b3000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'Care', 'InB', 'HHA', 'b0000000-0000-0000-0000-000000000001');

insert into public.caregiver_compensation_rates
  (organization_id, caregiver_id, pay_rate, rate_unit, effective_start_date, approved_by_user_id, approved_at) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a3000000-0000-0000-0000-000000000001', 21.50, 'Hour', '2026-01-01', 'a0000000-0000-0000-0000-000000000001', now()),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'b3000000-0000-0000-0000-000000000001', 19.00, 'Hour', '2026-01-01', 'b0000000-0000-0000-0000-000000000001', now());

insert into public.payers (id, organization_id, payer_name, payer_type) values
  ('a4000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'Payer A', 'Medicaid'),
  ('b4000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'Payer B', 'Medicaid');

insert into public.patient_authorizations
  (id, organization_id, patient_id, payer_id, authorization_start_date, authorization_end_date, created_by_user_id) values
  ('a5000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
   'a4000000-0000-0000-0000-000000000001', '2026-01-01', '2026-12-31', 'a0000000-0000-0000-0000-000000000001'),
  ('b5000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'b2000000-0000-0000-0000-000000000001',
   'b4000000-0000-0000-0000-000000000001', '2026-01-01', '2026-12-31', 'b0000000-0000-0000-0000-000000000001');

-- Impersonate a signed-in user the way PostgREST does.
create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;
create function pg_temp.reset() returns void language plpgsql as $$
begin execute 'reset role'; end $$;
grant execute on all functions in schema pg_temp to public;

-- ------------------------------------------------------------------
-- 1. Guard: no public table may ship without row level security
-- ------------------------------------------------------------------
select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  '',
  'every public table has row level security enabled');

-- ------------------------------------------------------------------
-- 2. Signed-out (anon) users get nothing
-- ------------------------------------------------------------------
select pg_temp.act_as_anon();
-- Supabase grants anon table access by default, so the protection is RLS (no policy for anon), not a permission error.
select is((select count(*)::int from public.patients), 0, 'anon sees no patients');
select is((select count(*)::int from public.organizations), 0, 'anon sees no organizations');
select is((select count(*)::int from public.caregiver_compensation_rates), 0, 'anon sees no compensation rates');
select throws_ok(
  $$insert into public.patients (organization_id, first_name, last_name, created_by_user_id)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'Anon', 'Insert', 'a0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'anon cannot insert patients');
select pg_temp.reset();

-- ------------------------------------------------------------------
-- 3. Tenant isolation: an org admin sees their own org and nothing else
-- ------------------------------------------------------------------
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.patients), 1, 'admin A sees exactly one patient');
select is((select last_name from public.patients), 'InA', '... and it is org A''s patient');
select is((select count(*)::int from public.patients where organization_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 0,
  'admin A cannot see org B patients');
select is((select count(*)::int from public.caregivers), 1, 'admin A sees only org A caregivers');
select is((select count(*)::int from public.organizations), 1, 'admin A sees only their own organization');
select is((select count(*)::int from public.patient_authorizations), 1, 'admin A sees only org A authorizations');
select is((select count(*)::int from public.caregiver_compensation_rates), 1, 'admin A sees only org A compensation rates');

select throws_ok(
  $$insert into public.patients (organization_id, first_name, last_name, created_by_user_id)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 'Evil', 'Insert', 'a0000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'admin A cannot insert a patient into org B');

with upd as (update public.patients set first_name = 'Hacked' where id = 'b2000000-0000-0000-0000-000000000001' returning 1)
select is((select count(*)::int from upd), 0, 'admin A cannot update an org B patient');
select pg_temp.reset();
select is((select first_name from public.patients where id = 'b2000000-0000-0000-0000-000000000001'), 'Pat',
  'the org B patient is unchanged');

-- ------------------------------------------------------------------
-- 4. People with no membership see nothing
-- ------------------------------------------------------------------
select pg_temp.act_as('c0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.patients), 0, 'outsider sees no patients');
select is((select count(*)::int from public.organizations), 0, 'outsider sees no organizations');
select is((select count(*)::int from public.organization_memberships), 0, 'outsider sees no memberships');
select pg_temp.reset();

-- ------------------------------------------------------------------
-- 5. Permission gating inside one organization
-- ------------------------------------------------------------------
-- Scheduler: reads patients and authorizations (needed for shifts) but never pay rates; cannot manage patients.
select pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.patients), 1, 'scheduler can read patients');
select is((select count(*)::int from public.patient_authorizations), 1, 'scheduler can read authorizations (shifts.manage)');
select is((select count(*)::int from public.caregiver_compensation_rates), 0, 'scheduler cannot read caregiver pay rates');
select throws_ok(
  $$insert into public.patients (organization_id, first_name, last_name, created_by_user_id)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'No', 'Permission', 'a0000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'scheduler cannot create patients');
select pg_temp.reset();

-- HR coordinator: reads pay rates, but has no authorizations access.
select pg_temp.act_as('a0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.caregiver_compensation_rates), 1, 'HR coordinator can read caregiver pay rates');
select is((select count(*)::int from public.patient_authorizations), 0, 'HR coordinator cannot read authorizations');
select pg_temp.reset();

-- Clinical manager: authorizations yes, pay rates no.
select pg_temp.act_as('a0000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.patient_authorizations), 1, 'clinical manager can read authorizations');
select is((select count(*)::int from public.caregiver_compensation_rates), 0, 'clinical manager cannot read caregiver pay rates');
select pg_temp.reset();

-- A suspended administrator has no access at all.
select pg_temp.act_as('a0000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.patients), 0, 'a suspended member loses access to patients');
select is((select count(*)::int from public.caregiver_compensation_rates), 0, 'a suspended member loses access to pay rates');
select pg_temp.reset();

-- ------------------------------------------------------------------
-- 6. Explicit grants: honoured while valid, ignored once revoked or expired
-- ------------------------------------------------------------------
select pg_temp.act_as('a0000000-0000-0000-0000-000000000006');
select is((select count(*)::int from public.caregiver_compensation_rates), 0, 'a scheduler without a grant cannot read pay rates');
select pg_temp.reset();

insert into public.membership_permission_grants (organization_id, membership_id, permission_code, granted_by_user_id)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000006', 'caregivers.read_compensation',
        'a0000000-0000-0000-0000-000000000001');
select pg_temp.act_as('a0000000-0000-0000-0000-000000000006');
select is((select count(*)::int from public.caregiver_compensation_rates), 1, 'an active grant allows reading pay rates');
select pg_temp.reset();

update public.membership_permission_grants set expires_at = now() - interval '1 minute';
select pg_temp.act_as('a0000000-0000-0000-0000-000000000006');
select is((select count(*)::int from public.caregiver_compensation_rates), 0, 'an expired grant no longer applies');
select pg_temp.reset();

update public.membership_permission_grants set expires_at = null, revoked_at = now();
select pg_temp.act_as('a0000000-0000-0000-0000-000000000006');
select is((select count(*)::int from public.caregiver_compensation_rates), 0, 'a revoked grant no longer applies');
select pg_temp.reset();

-- ------------------------------------------------------------------
-- 7. Privilege escalation: a non-admin cannot change who has which role
-- ------------------------------------------------------------------
select pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
with upd as (
  update public.organization_memberships set roles = '{"Agency Administrator"}'
  where user_id = 'a0000000-0000-0000-0000-000000000002' returning 1)
select is((select count(*)::int from upd), 0, 'a scheduler cannot promote themselves by updating their membership');
select throws_ok(
  $$select public.set_org_member_roles('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', array['Agency Administrator'])$$,
  null, 'Not authorized to manage users for this organization', 'a scheduler cannot call set_org_member_roles');
select throws_ok(
  $$select public.suspend_org_member('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003')$$,
  null, null, 'a scheduler cannot suspend another member');
select pg_temp.reset();

-- An admin of org A cannot manage users in org B.
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
select throws_ok(
  $$select public.set_org_member_roles('bbbbbbbb-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', array['Scheduler'])$$,
  null, 'Not authorized to manage users for this organization', 'an admin of org A cannot change roles in org B');
select pg_temp.reset();

select * from finish();
rollback;
