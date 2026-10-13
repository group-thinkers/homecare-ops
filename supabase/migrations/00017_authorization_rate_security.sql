-- ============================================================
-- Migration: Authorization rate security and effective dating
-- Purpose:
-- - Separate financial rate visibility from scheduler compatibility checks
-- - Version organization-service fallback rates by effective date
-- - Create prospective rate changes and their audit events atomically
-- ============================================================

create extension if not exists btree_gist;

insert into public.role_permission_defaults (role, permission_code, enabled)
values
  ('Agency Administrator', 'authorizations.read_rates', true),
  ('Clinical Manager', 'authorizations.read_rates', true),
  ('Compliance Administrator', 'authorizations.read_rates', true)
on conflict (role, permission_code) do update
  set enabled = excluded.enabled;

create table public.organization_service_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  organization_service_id uuid not null,
  reimbursement_rate numeric(10,2) not null check (reimbursement_rate >= 0),
  rate_unit text not null check (rate_unit in ('Hour', 'Visit', 'Unit')),
  effective_start_date date not null,
  effective_end_date date,
  change_reason text not null check (length(trim(change_reason)) > 0),
  created_by_user_id uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, organization_service_id)
    references public.organization_services(organization_id, id) on delete restrict,
  check (effective_end_date is null or effective_end_date >= effective_start_date),
  exclude using gist (
    organization_id with =,
    organization_service_id with =,
    daterange(
      effective_start_date,
      coalesce(effective_end_date, 'infinity'::date),
      '[]'
    ) with &&
  )
);

create index organization_service_rates_lookup_idx
  on public.organization_service_rates (
    organization_id,
    organization_service_id,
    effective_start_date desc
  );

alter table public.organization_service_rates enable row level security;

create policy "organization_service_rates: read with authorization rate permission"
  on public.organization_service_rates for select to authenticated
  using (
    public.has_org_permission(organization_id, 'authorizations.manage')
    or public.has_org_permission(organization_id, 'authorizations.read_rates')
  );

insert into public.organization_service_rates (
  organization_id,
  organization_service_id,
  reimbursement_rate,
  rate_unit,
  effective_start_date,
  change_reason,
  created_by_user_id
)
select
  organization_id,
  id,
  default_reimbursement_rate,
  default_rate_unit,
  created_at::date,
  'Imported organization-service default baseline',
  created_by_user_id
from public.organization_services
where default_reimbursement_rate is not null;

create or replace function public.can_read_org_authorization_rates(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_org_permission(org_id, 'authorizations.manage')
    or public.has_org_permission(org_id, 'authorizations.read_rates');
$$;

create or replace function public.check_authorization_service_compatibility(
  target_org_id uuid,
  target_patient_id uuid,
  target_organization_service_id uuid,
  service_date date
)
returns table(
  authorization_valid boolean,
  service_authorized boolean,
  has_rate boolean,
  reason_code text,
  rate_source text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  matching_service public.authorization_services;
  authorization_exists boolean;
  active_authorization_exists boolean;
  organization_rate_exists boolean;
begin
  if not public.can_read_org_authorizations(target_org_id) then
    raise exception 'Not authorized to validate authorization compatibility for this organization';
  end if;

  select exists (
    select 1
    from public.patient_authorizations pa
    where pa.organization_id = target_org_id
      and pa.patient_id = target_patient_id
      and pa.archived_at is null
      and service_date between pa.authorization_start_date and pa.authorization_end_date
  ) into authorization_exists;

  select exists (
    select 1
    from public.patient_authorizations pa
    where pa.organization_id = target_org_id
      and pa.patient_id = target_patient_id
      and pa.archived_at is null
      and pa.status = 'Active'
      and service_date between pa.authorization_start_date and pa.authorization_end_date
  ) into active_authorization_exists;

  select authorization_service.* into matching_service
  from public.authorization_services authorization_service
  join public.patient_authorizations pa
    on pa.id = authorization_service.authorization_id
   and pa.organization_id = authorization_service.organization_id
  where authorization_service.organization_id = target_org_id
    and pa.patient_id = target_patient_id
    and pa.archived_at is null
    and pa.status = 'Active'
    and service_date between pa.authorization_start_date and pa.authorization_end_date
    and authorization_service.organization_service_id = target_organization_service_id
    and authorization_service.active = true
    and service_date between authorization_service.effective_start_date and authorization_service.effective_end_date
  order by authorization_service.effective_start_date desc
  limit 1;

  if matching_service.id is null then
    return query select
      active_authorization_exists,
      false,
      false,
      case
        when active_authorization_exists then 'service_not_authorized'
        when authorization_exists then 'authorization_inactive'
        else 'authorization_missing'
      end,
      'missing'::text;
    return;
  end if;

  select exists (
    select 1
    from public.organization_service_rates service_rate
    where service_rate.organization_id = target_org_id
      and service_rate.organization_service_id = target_organization_service_id
      and service_rate.effective_start_date <= service_date
      and (service_rate.effective_end_date is null or service_rate.effective_end_date >= service_date)
  ) into organization_rate_exists;

  if matching_service.reimbursement_rate is not null then
    return query select true, true, true, null::text, 'authorization'::text;
  elsif organization_rate_exists then
    return query select true, true, true, null::text, 'organization_default'::text;
  else
    return query select true, true, false, 'rate_missing'::text, 'missing'::text;
  end if;
end;
$$;

create or replace function public.set_organization_service_rate(
  target_org_id uuid,
  target_organization_service_id uuid,
  reimbursement_rate numeric,
  rate_unit text,
  effective_start_date date,
  change_reason text
)
returns public.organization_service_rates
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.organization_service_rates;
begin
  if not public.can_manage_org_authorizations(target_org_id) then
    raise exception 'Not authorized to manage authorization rates for this organization';
  end if;

  if effective_start_date < current_date then
    raise exception 'Rate changes must be effective today or later';
  end if;

  if reimbursement_rate is null or reimbursement_rate < 0
    or rate_unit not in ('Hour', 'Visit', 'Unit')
    or change_reason is null or length(trim(change_reason)) = 0 then
    raise exception 'Invalid organization-service rate';
  end if;

  if not exists (
    select 1 from public.organization_services
    where id = target_organization_service_id
      and organization_id = target_org_id
  ) then
    raise exception 'Organization service not found';
  end if;

  update public.organization_service_rates
  set effective_end_date = effective_start_date - 1
  where organization_id = target_org_id
    and organization_service_id = target_organization_service_id
    and effective_start_date < set_organization_service_rate.effective_start_date
    and (effective_end_date is null or effective_end_date >= set_organization_service_rate.effective_start_date);

  insert into public.organization_service_rates (
    organization_id,
    organization_service_id,
    reimbursement_rate,
    rate_unit,
    effective_start_date,
    change_reason,
    created_by_user_id
  )
  values (
    target_org_id,
    target_organization_service_id,
    reimbursement_rate,
    rate_unit,
    effective_start_date,
    change_reason,
    auth.uid()
  )
  returning * into result_row;

  insert into public.operational_history_events (
    organization_id,
    actor_user_id,
    action_type,
    resource_type,
    resource_id,
    status,
    summary_code,
    metadata,
    occurred_at
  )
  values (
    target_org_id,
    auth.uid(),
    'organization_service.rate_changed',
    'organization_service_rate',
    result_row.id,
    'Success',
    'prospective_rate_change',
    jsonb_build_object(
      'organization_service_id', target_organization_service_id,
      'effective_start_date', effective_start_date,
      'change_reason', change_reason
    ),
    now()
  );

  return result_row;
end;
$$;

create or replace function public.get_effective_organization_service_rates(
  target_org_id uuid,
  target_organization_service_ids uuid[],
  service_date date
)
returns table(
  organization_service_id uuid,
  reimbursement_rate numeric,
  rate_unit text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    service_rate.organization_service_id,
    service_rate.reimbursement_rate,
    service_rate.rate_unit
  from public.organization_service_rates service_rate
  where service_rate.organization_id = target_org_id
    and service_rate.organization_service_id = any(target_organization_service_ids)
    and service_rate.effective_start_date <= service_date
    and (service_rate.effective_end_date is null or service_rate.effective_end_date >= service_date)
    and public.can_read_org_authorization_rates(target_org_id);
$$;

revoke all on function public.check_authorization_service_compatibility(uuid, uuid, uuid, date) from public;
grant execute on function public.check_authorization_service_compatibility(uuid, uuid, uuid, date) to authenticated;
revoke all on function public.set_organization_service_rate(uuid, uuid, numeric, text, date, text) from public;
grant execute on function public.set_organization_service_rate(uuid, uuid, numeric, text, date, text) to authenticated;
revoke all on function public.get_effective_organization_service_rates(uuid, uuid[], date) from public;
grant execute on function public.get_effective_organization_service_rates(uuid, uuid[], date) to authenticated;
