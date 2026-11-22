-- Authorization read boundaries after migration 00018. All fixtures are synthetic.
begin;
create extension if not exists pgtap with schema extensions;
select plan(74);

create function pg_temp.mk_user(uid uuid, nm text) returns void language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', nm || '@example.test', '', now(), now());
  insert into public.user_profiles (id, first_name, last_name, access_status) values (uid, nm, 'Test', 'Active');
$$;

select pg_temp.mk_user(uid, nm) from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'adminA'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'schedulerA'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'readerA'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'suspendedA'),
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'adminB')
) as users(uid, nm);

insert into public.organizations (id, name, timezone) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Org A', 'America/Chicago'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Org B', 'America/Chicago');

insert into public.organization_memberships (id, organization_id, user_id, roles, status) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', '{"Agency Administrator"}', 'Active'),
  ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', '{"Scheduler"}', 'Active'),
  ('a1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', '{"HR Coordinator"}', 'Active'),
  ('a1000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', '{"Agency Administrator"}', 'Suspended'),
  ('b1000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', '{"Agency Administrator"}', 'Active');

insert into public.membership_permission_grants
  (id, organization_id, membership_id, permission_code, granted_by_user_id)
values
  ('a1100000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000003', 'authorizations.read_rates', 'a0000000-0000-0000-0000-000000000001'),
  ('a1100000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000',
   'a1000000-0000-0000-0000-000000000003', 'shifts.manage', 'a0000000-0000-0000-0000-000000000001');

insert into public.patients (id, organization_id, first_name, last_name, created_by_user_id) values
  ('a2000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'Synthetic', 'A', 'a0000000-0000-0000-0000-000000000001'),
  ('b2000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'Synthetic', 'B', 'b0000000-0000-0000-0000-000000000001');

insert into public.payers (id, organization_id, payer_name, payer_type) values
  ('a4000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'Synthetic payer A', 'Medicaid'),
  ('b4000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'Synthetic payer B', 'Medicaid');

insert into public.billing_services
  (id, billing_code, code_match_type, service_name, service_category, default_unit_type, effective_start_date, source, version)
values
  ('c1000000-0000-0000-0000-000000000001', 'TEST-BOUNDARY', 'Exact', 'Synthetic service', 'Other', 'Hour', '2026-01-01', 'test', 'test');
insert into public.service_code_mappings
  (id, billing_service_id, evv_service_id, evv_service_name, payer_type, effective_start_date, source, version)
values
  ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'test-boundary-1', 'Synthetic service 1', 'Medicaid', '2026-01-01', 'test', 'test'),
  ('c2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'test-boundary-2', 'Synthetic service 2', 'Medicaid', '2026-01-01', 'test', 'test');

insert into public.organization_services
  (id, organization_id, service_code_mapping_id, local_service_name, default_reimbursement_rate, created_by_user_id)
values
  ('a6000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000001', 'Service A1', 30.75, 'a0000000-0000-0000-0000-000000000001'),
  ('a6000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000002', 'Service A2', 30.75, 'a0000000-0000-0000-0000-000000000001'),
  ('b6000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-000000000001', 'Service B1', 25.00, 'b0000000-0000-0000-0000-000000000001');

insert into public.organization_service_rates
  (id, organization_id, organization_service_id, reimbursement_rate, rate_unit, effective_start_date, change_reason, created_by_user_id)
values
  ('a7000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'a6000000-0000-0000-0000-000000000001', 30.75, 'Hour', '2026-01-01', 'Synthetic fixture', 'a0000000-0000-0000-0000-000000000001'),
  ('a7000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'a6000000-0000-0000-0000-000000000002', 30.75, 'Hour', '2026-01-01', 'Synthetic fixture', 'a0000000-0000-0000-0000-000000000001'),
  ('b7000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'b6000000-0000-0000-0000-000000000001', 25.00, 'Hour', '2026-01-01', 'Synthetic fixture', 'b0000000-0000-0000-0000-000000000001');

insert into public.patient_authorizations
  (id, organization_id, patient_id, payer_id, encrypted_prior_auth_number, masked_prior_auth_number, authorization_start_date, authorization_end_date, created_by_user_id)
values
  ('a5000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'synthetic-1234', '****1234', '2026-01-01', '2026-12-31', 'a0000000-0000-0000-0000-000000000001'),
  ('b5000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'b2000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000001', 'synthetic-5678', '****5678', '2020-01-01', '2020-12-31', 'b0000000-0000-0000-0000-000000000001');

insert into public.authorization_services
  (id, organization_id, authorization_id, organization_service_id, authorized_quantity, quantity_unit, quantity_period, reimbursement_rate, rate_unit, effective_start_date, effective_end_date)
values
  ('a8000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'a5000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 10, 'Hours', 'Week', 42.50, 'Hour', '2026-01-01', '2026-12-31'),
  ('a8000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'a5000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000002', 10, 'Hours', 'Week', null, 'Hour', '2026-01-01', '2026-12-31'),
  ('b8000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'b5000000-0000-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000001', 10, 'Hours', 'Week', 21.00, 'Hour', '2026-01-01', '2026-12-31');

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

-- A denied read may raise an authorization error or be filtered to zero rows.
create function pg_temp.read_denied(query text) returns boolean language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || query || ') denied_rows' into n;
  return n = 0;
exception
  when insufficient_privilege or raise_exception then return true;
end $$;
grant execute on all functions in schema pg_temp to public;
create temporary table created_authorization (id uuid);
grant select, insert on table created_authorization to authenticated;
create temporary table created_rate (id uuid, starts_on date);
grant select, insert on table created_rate to authenticated;

-- The create RPC must expose a scalar UUID rather than an authorization row.
select is(
  pg_get_function_result('public.create_authorization_with_services(uuid,uuid,uuid,date,date,text,text,jsonb)'::regprocedure),
  'uuid', 'creation returns only a UUID');

select pg_temp.act_as('a0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.patient_authorizations), 1, 'scheduler sees its safe authorization row');
select is((select count(*)::int from public.authorization_services), 2, 'scheduler sees its safe service rows');
select is((select count(*)::int from public.organization_services), 2, 'scheduler sees its safe organization services');
select is((select masked_prior_auth_number from public.patient_authorizations), '****1234', 'scheduler can select the masked authorization number');
select is((select authorized_quantity from public.authorization_services where id = 'a8000000-0000-0000-0000-000000000001'), 10::numeric, 'scheduler can select the authorized quantity');
select is((select local_service_name from public.organization_services where id = 'a6000000-0000-0000-0000-000000000001'), 'Service A1', 'scheduler can select the service name');
select is((public.get_patient_authorization_detail(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000001', '2026-06-01')->>'id'),
  'a5000000-0000-0000-0000-000000000001', 'scheduler can read the authorization detail model');
select ok(not (public.get_patient_authorization_detail(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000001', '2026-06-01') ? 'encrypted_prior_auth_number'),
  'detail model excludes the encrypted prior authorization number');
select ok(not exists (
  select 1
  from jsonb_array_elements(public.get_patient_authorization_detail(
    'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
    'a5000000-0000-0000-0000-000000000001', '2026-06-01')->'services') as services(value)
  where value->'effective_rate' <> 'null'::jsonb
), 'scheduler detail model omits effective rates');
select ok((public.get_patient_authorization_detail(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000001', '2026-06-01', 1, 1)->'service_count' = '2'::jsonb)
  and jsonb_array_length(public.get_patient_authorization_detail(
    'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
    'a5000000-0000-0000-0000-000000000001', '2026-06-01', 1, 1)->'services') = 1
  and public.get_patient_authorization_detail(
    'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
    'a5000000-0000-0000-0000-000000000001', '2026-06-01', 1, 1)->'services'->0->>'id'
    = 'a8000000-0000-0000-0000-000000000002',
  'authorization detail returns the requested service page and total count');
select ok((select
    jsonb_array_length(read_model->'rows') = 1
    and read_model->'rowCount' = '1'::jsonb
    and read_model->'rows'->0->>'service_count' = '2'
    and not ((read_model->'rows'->0) ? 'encrypted_prior_auth_number')
    and read_model->'rows'->0->>'effective_status' = 'Active'
  from (select public.list_patient_authorizations_for_patient(
    'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 0, 10) read_model) result),
  'scheduler list RPC returns a bounded safe page with SQL status and count');
select ok((select jsonb_array_length(read_model->'rows') = 0 and read_model->'rowCount' = '1'::jsonb
  from (select public.list_patient_authorizations_for_patient(
    'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 1, 10) read_model) result),
  'authorization pagination preserves the database total when a page is empty');
select throws_ok($$select encrypted_prior_auth_number from public.patient_authorizations$$, '42501', null, 'scheduler cannot select the prior authorization secret');
select throws_ok($$select reimbursement_rate from public.authorization_services$$, '42501', null, 'scheduler cannot select the service reimbursement rate');
select throws_ok($$select rate_unit from public.authorization_services$$, '42501', null, 'scheduler cannot select the service rate unit');
select throws_ok($$select default_reimbursement_rate from public.organization_services$$, '42501', null, 'scheduler cannot select the organization default rate');
select is((select count(*)::int from public.organization_service_rates), 0, 'scheduler cannot read rate history via RLS');
select is((select count(*)::int from public.list_active_authorization_services_for_patient(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', '2026-06-01')), 2,
  'scheduler can list active service lines');
select is((select id from public.list_active_authorization_services_for_patient(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', '2026-06-01', 1, 1)),
  'a8000000-0000-0000-0000-000000000002'::uuid, 'scheduler can request a later bounded service page');
select is((select count(*)::int from public.list_active_authorization_services_for_patient(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', '2027-01-01')), 0,
  'service list respects the requested date');
select ok(not exists (
  select 1 from public.list_active_authorization_services_for_patient(
    'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', '2026-06-01') line
  where to_jsonb(line) ?| array['reimbursement_rate', 'reimbursement_amount', 'rate_unit', 'default_reimbursement_rate']
), 'scheduler service list omits reimbursement amounts and rate units');
select is((select to_jsonb(result) from public.check_authorization_service_compatibility(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a6000000-0000-0000-0000-000000000001', '2026-06-01') result),
  '{"authorization_valid":true,"service_authorized":true,"has_rate":true,"reason_code":null,"rate_source":"authorization"}'::jsonb,
  'compatibility exposes only safe flags, reason, and source');
select is((select service_authorized from public.check_authorization_service_compatibility(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'b6000000-0000-0000-0000-000000000001', '2026-06-01')), false,
  'a foreign service ID is not compatible within the caller organization');
select ok(pg_temp.read_denied($q$select * from public.resolve_effective_authorization_service_rates(
  'aaaaaaaa-0000-0000-0000-000000000000', array['a8000000-0000-0000-0000-000000000001'::uuid], '2026-06-01')$q$),
  'scheduler cannot resolve financial rates');
select ok(pg_temp.read_denied($q$select public.set_organization_service_rate(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a6000000-0000-0000-0000-000000000001',
  50.25, 'Hour', greatest(current_date, date '2026-01-01') + 1, 'Synthetic denied change')$q$),
  'scheduler cannot set organization-service rates');
select ok(pg_temp.read_denied($q$select public.create_authorization_with_services(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a4000000-0000-0000-0000-000000000001', '2026-01-01', '2026-12-31')$q$),
  'scheduler cannot create authorizations');
select pg_temp.reset();

select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
insert into created_authorization (id)
  select public.create_authorization_with_services(
    'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
    'a4000000-0000-0000-0000-000000000001', '2026-01-01', '2026-12-31',
    'Active', 'synthetic-9012',
    '[{"organization_service_id":"a6000000-0000-0000-0000-000000000001","authorized_quantity":5,"quantity_unit":"Hours","quantity_period":"Week","reimbursement_rate":45,"rate_unit":"Hour"}]'::jsonb);
select ok((select id is not null from created_authorization), 'authorization manager receives the created UUID');
select is((select masked_prior_auth_number from public.patient_authorizations where id = (select id from created_authorization)),
  '****9012', 'created UUID identifies the authorization with its masked number');
select is((select count(*)::int from public.authorization_services where authorization_id = (select id from created_authorization)),
  1, 'creation also persists the requested service line');
select throws_ok($$select reimbursement_rate from public.authorization_services$$, '42501', null, 'manager also cannot bypass the rate RPC');
select is((select count(*)::int from public.organization_service_rates), 2, 'manager can read own rate history via RLS');
select is((select count(*)::int from public.resolve_effective_authorization_service_rates(
  'aaaaaaaa-0000-0000-0000-000000000000',
  array['a8000000-0000-0000-0000-000000000001'::uuid, 'a8000000-0000-0000-0000-000000000002'::uuid], '2026-06-01')), 2,
  'manager can resolve a batch of service rates');
select ok((public.get_patient_authorization_detail(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000001', '2026-06-01')->'services'->0->'effective_rate')
  @> '{"rate":42.50,"rate_unit":"Hour","source":"authorization"}'::jsonb,
  'authorization manager receives effective rates in the single detail model');
select ok((select to_jsonb(r) @> '{"authorization_service_id":"a8000000-0000-0000-0000-000000000001","reimbursement_rate":42.50,"rate_unit":"Hour","source":"authorization"}'::jsonb
  from public.resolve_effective_authorization_service_rates('aaaaaaaa-0000-0000-0000-000000000000',
    array['a8000000-0000-0000-0000-000000000001'::uuid], '2026-06-01') r),
  'manager resolves the authorization override');
select ok((select to_jsonb(r) @> '{"authorization_service_id":"a8000000-0000-0000-0000-000000000002","reimbursement_rate":30.75,"rate_unit":"Hour","source":"organization_default"}'::jsonb
  from public.resolve_effective_authorization_service_rates('aaaaaaaa-0000-0000-0000-000000000000',
    array['a8000000-0000-0000-0000-000000000002'::uuid], '2026-06-01') r),
  'manager resolves the effective organization fallback');
select ok(not exists (
  select 1 from public.resolve_effective_authorization_service_rates('aaaaaaaa-0000-0000-0000-000000000000',
    array['a8000000-0000-0000-0000-000000000001'::uuid], '2026-06-01') r
  where (select count(*) from jsonb_object_keys(to_jsonb(r))) <> 4
), 'financial RPC returns only the four permitted fields');
select ok(pg_temp.read_denied($q$select * from public.resolve_effective_authorization_service_rates(
  'aaaaaaaa-0000-0000-0000-000000000000', array['b8000000-0000-0000-0000-000000000001'::uuid], '2026-06-01')$q$),
  'manager cannot resolve a foreign service ID in its own organization scope');
select pg_temp.reset();

select pg_temp.act_as('a0000000-0000-0000-0000-000000000003');
select ok(not public.has_org_permission('aaaaaaaa-0000-0000-0000-000000000000', 'authorizations.manage')
  and public.has_org_permission('aaaaaaaa-0000-0000-0000-000000000000', 'authorizations.read_rates')
  and public.has_org_permission('aaaaaaaa-0000-0000-0000-000000000000', 'shifts.manage'),
  'financial reader has rate and authorization-read permission without authorization management');
select is((select count(*)::int from public.organization_service_rates), 2, 'financial reader can read own rate history');
select ok((select to_jsonb(r) @> '{"reimbursement_rate":42.50,"rate_unit":"Hour"}'::jsonb
  from public.resolve_effective_authorization_service_rates('aaaaaaaa-0000-0000-0000-000000000000',
    array['a8000000-0000-0000-0000-000000000001'::uuid], '2026-06-01') r),
  'financial reader can resolve an authorization rate without management permission');
select ok((public.get_patient_authorization_detail(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000001', '2026-06-01')->'services'->0->'effective_rate')
  @> '{"rate":42.50,"rate_unit":"Hour","source":"authorization"}'::jsonb,
  'financial reader receives effective rates in the detail model');
select pg_temp.reset();

select pg_temp.act_as('b0000000-0000-0000-0000-000000000001');
select is((select read_model->'rows'->0->>'effective_status'
  from (select public.list_patient_authorizations_for_patient(
    'bbbbbbbb-0000-0000-0000-000000000000', 'b2000000-0000-0000-0000-000000000001', 0, 10) read_model) result),
  'Expired', 'authorization expiry is derived in the database on read');
select is((select count(*)::int from public.patient_authorizations where organization_id = 'aaaaaaaa-0000-0000-0000-000000000000'), 0, 'foreign manager cannot read authorization rows');
select is((select count(*)::int from public.authorization_services where organization_id = 'aaaaaaaa-0000-0000-0000-000000000000'), 0, 'foreign manager cannot read service rows');
select is((select count(*)::int from public.organization_services where organization_id = 'aaaaaaaa-0000-0000-0000-000000000000'), 0, 'foreign manager cannot read organization services');
select is((select count(*)::int from public.organization_service_rates where organization_id = 'aaaaaaaa-0000-0000-0000-000000000000'), 0, 'foreign manager cannot read rate history');
select ok(pg_temp.read_denied($q$select * from public.list_active_authorization_services_for_patient(
  'bbbbbbbb-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', '2026-06-01')$q$), 'foreign patient ID cannot be listed in the caller organization');
select ok(pg_temp.read_denied($q$select * from public.list_active_authorization_services_for_patient(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', '2026-06-01')$q$), 'foreign manager cannot list service lines');
select ok(pg_temp.read_denied($q$select public.list_patient_authorizations_for_patient(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 0, 10)$q$), 'foreign manager cannot list authorizations');
select ok(pg_temp.read_denied($q$select * from public.check_authorization_service_compatibility(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a6000000-0000-0000-0000-000000000001', '2026-06-01')$q$), 'foreign manager cannot check compatibility');
select ok(pg_temp.read_denied($q$select * from public.resolve_effective_authorization_service_rates(
  'aaaaaaaa-0000-0000-0000-000000000000', array['a8000000-0000-0000-0000-000000000001'::uuid], '2026-06-01')$q$), 'foreign manager cannot resolve rates');
select ok(pg_temp.read_denied($q$select public.get_patient_authorization_detail(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000001', '2026-06-01')$q$), 'foreign manager cannot read the authorization detail model');
select ok(pg_temp.read_denied($q$select public.create_authorization_with_services(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a4000000-0000-0000-0000-000000000001', '2026-01-01', '2026-12-31')$q$), 'foreign manager cannot create authorizations');
select pg_temp.reset();

select pg_temp.act_as('a0000000-0000-0000-0000-000000000004');
select ok(pg_temp.read_denied($q$select * from public.check_authorization_service_compatibility(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a6000000-0000-0000-0000-000000000001', '2026-06-01')$q$), 'suspended manager cannot use an active-organization RPC');
select pg_temp.reset();

select pg_temp.act_as_anon();
select ok(pg_temp.read_denied($q$select id from public.patient_authorizations$q$), 'anon cannot read authorization rows');
select ok(pg_temp.read_denied($q$select id from public.authorization_services$q$), 'anon cannot read service rows');
select ok(pg_temp.read_denied($q$select id from public.organization_services$q$), 'anon cannot read organization services');
select ok(pg_temp.read_denied($q$select id from public.organization_service_rates$q$), 'anon cannot read rate history');
select ok(pg_temp.read_denied($q$select * from public.list_active_authorization_services_for_patient(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', '2026-06-01')$q$), 'anon cannot list service lines');
select ok(pg_temp.read_denied($q$select public.list_patient_authorizations_for_patient(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001', 0, 10)$q$), 'anon cannot list authorizations');
select ok(pg_temp.read_denied($q$select * from public.check_authorization_service_compatibility(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a6000000-0000-0000-0000-000000000001', '2026-06-01')$q$), 'anon cannot check compatibility');
select ok(pg_temp.read_denied($q$select * from public.resolve_effective_authorization_service_rates(
  'aaaaaaaa-0000-0000-0000-000000000000', array['a8000000-0000-0000-0000-000000000001'::uuid], '2026-06-01')$q$), 'anon cannot resolve rates');
select ok(pg_temp.read_denied($q$select public.get_patient_authorization_detail(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a5000000-0000-0000-0000-000000000001', '2026-06-01')$q$), 'anon cannot read the authorization detail model');
select ok(pg_temp.read_denied($q$select public.create_authorization_with_services(
  'aaaaaaaa-0000-0000-0000-000000000000', 'a2000000-0000-0000-0000-000000000001',
  'a4000000-0000-0000-0000-000000000001', '2026-01-01', '2026-12-31')$q$), 'anon cannot create authorizations');
select pg_temp.reset();

select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
select throws_ok(
  $$select public.set_organization_service_rate(
    'aaaaaaaa-0000-0000-0000-000000000000',
    'a6000000-0000-0000-0000-000000000001',
    49.25,
    'Hour',
    current_date - 1,
    'Synthetic backdated rate test'
  )$$,
  'P0001',
  'Rate changes must be effective today or later',
  'manager cannot backdate an ordinary rate change');
insert into created_rate (id, starts_on)
  select id, effective_start_date
  from public.set_organization_service_rate(
    'aaaaaaaa-0000-0000-0000-000000000000',
    'a6000000-0000-0000-0000-000000000001',
    50.25,
    'Hour',
    greatest(current_date, date '2026-01-01') + 1,
    'Synthetic prospective rate test'
  );
select ok((select id is not null from created_rate), 'manager can create a prospective organization-service rate');
select is((select effective_end_date from public.organization_service_rates
  where organization_service_id = 'a6000000-0000-0000-0000-000000000001'
    and effective_start_date = '2026-01-01'),
  (select starts_on - 1 from created_rate), 'setting a future rate closes the previous range one day earlier');
select ok((select to_jsonb(rate) @> '{"reimbursement_rate":30.75,"rate_unit":"Hour"}'::jsonb
  from public.get_effective_organization_service_rates(
    'aaaaaaaa-0000-0000-0000-000000000000',
    array['a6000000-0000-0000-0000-000000000001'::uuid],
    '2026-01-01') rate), 'historical lookup preserves the prior effective rate');
select ok((select to_jsonb(rate) @> '{"reimbursement_rate":50.25,"rate_unit":"Hour"}'::jsonb
  from public.get_effective_organization_service_rates(
    'aaaaaaaa-0000-0000-0000-000000000000',
    array['a6000000-0000-0000-0000-000000000001'::uuid],
    (select starts_on from created_rate)) rate), 'effective lookup returns the prospective version on its start date');
select throws_ok(
  $$select public.set_organization_service_rate(
    'aaaaaaaa-0000-0000-0000-000000000000',
    'a6000000-0000-0000-0000-000000000001',
    51.00,
    'Hour',
    (select starts_on from created_rate),
    'Synthetic overlapping rate test'
  )$$,
  '23P01',
  null,
  'overlapping effective rate periods are rejected');
select pg_temp.reset();
select ok(not exists (
  select 1
  from public.operational_history_events event
  where event.resource_id = (select id from created_rate)
    and (event.metadata ?| array['reimbursement_rate', 'rate', 'rate_unit', 'pay_rate']
      or event.metadata::text like '%50.25%'
      or event.metadata ? 'change_reason')
), 'rate-change event metadata excludes amounts, units, and free-text reasons');
select is((select change_reason from public.organization_service_rates where id = (select id from created_rate)),
  'Synthetic prospective rate test', 'rate history retains its change reason outside operational event metadata');
select pg_temp.act_as('a0000000-0000-0000-0000-000000000001');
update public.patient_authorizations
set status = 'Under Review'
where id = 'a5000000-0000-0000-0000-000000000001';
select throws_ok(
  $$update public.patient_authorizations
    set status = 'Suspended'
    where id = 'a5000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'Invalid authorization status transition',
  'database rejects invalid authorization status transitions');
select pg_temp.reset();

select * from finish();
rollback;
