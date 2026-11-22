-- ============================================================
-- Migration: Authorization read boundaries
-- Purpose:
-- - Prevent direct reads of prior-authorization numbers and raw reimbursement rates
-- - Preserve scheduler access through non-financial authorization read contracts
-- - Resolve effective authorization-service rates only for financial readers
-- - Keep free-text rate reasons out of operational event metadata
-- ============================================================

revoke select on table public.patient_authorizations from authenticated;
grant select (
  id,
  organization_id,
  patient_id,
  payer_id,
  masked_prior_auth_number,
  authorization_start_date,
  authorization_end_date,
  status,
  retention_category,
  created_at,
  created_by_user_id,
  updated_at,
  updated_by_user_id,
  archived_at
) on table public.patient_authorizations to authenticated;

revoke select on table public.authorization_services from authenticated;
grant select (
  id,
  organization_id,
  authorization_id,
  organization_service_id,
  authorized_quantity,
  quantity_unit,
  quantity_period,
  service_requirement_code,
  effective_start_date,
  effective_end_date,
  active,
  created_at,
  updated_at
) on table public.authorization_services to authenticated;

revoke select on table public.organization_services from authenticated;
grant select (
  id,
  organization_id,
  service_code_mapping_id,
  local_service_name,
  requires_clinical_approval,
  enabled,
  created_at,
  created_by_user_id,
  updated_at,
  updated_by_user_id
) on table public.organization_services to authenticated;

revoke all on table public.organization_service_rates from anon, authenticated;
grant select on table public.organization_service_rates to authenticated;

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
      'effective_start_date', effective_start_date
    ),
    now()
  );

  return result_row;
end;
$$;

revoke all on function public.set_organization_service_rate(uuid, uuid, numeric, text, date, text)
  from public, anon;
grant execute on function public.set_organization_service_rate(uuid, uuid, numeric, text, date, text)
  to authenticated;

create function public.enforce_authorization_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not (
    (old.status = 'Active' and new.status in ('Under Review', 'Pending Recertification', 'Suspended', 'Expired'))
    or (old.status = 'Pending Recertification' and new.status in ('Active', 'Suspended', 'Expired'))
    or (old.status = 'Under Review' and new.status in ('Active', 'Expired'))
    or (old.status = 'Suspended' and new.status in ('Active', 'Expired'))
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Invalid authorization status transition';
  end if;

  return new;
end;
$$;

create trigger patient_authorizations_status_transition
  before update of status on public.patient_authorizations
  for each row execute function public.enforce_authorization_status_transition();

alter function public.create_authorization_with_services(uuid, uuid, uuid, date, date, text, text, jsonb)
  rename to create_authorization_with_services_internal;

revoke all on function public.create_authorization_with_services_internal(uuid, uuid, uuid, date, date, text, text, jsonb)
  from public, anon, authenticated;

create function public.create_authorization_with_services(
  target_org_id uuid,
  target_patient_id uuid,
  target_payer_id uuid,
  authorization_start_date date,
  authorization_end_date date,
  status text default 'Active',
  prior_auth_number text default null,
  services jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_authorization public.patient_authorizations;
begin
  if not public.can_manage_org_authorizations(target_org_id) then
    raise exception 'Not authorized to manage authorizations for this organization';
  end if;

  created_authorization := public.create_authorization_with_services_internal(
    target_org_id,
    target_patient_id,
    target_payer_id,
    authorization_start_date,
    authorization_end_date,
    status,
    prior_auth_number,
    services
  );

  return created_authorization.id;
end;
$$;

create function public.list_active_authorization_services_for_patient(
  target_org_id uuid,
  target_patient_id uuid,
  on_date date,
  page_offset integer default 0,
  page_size integer default 100
)
returns table(
  id uuid,
  organization_id uuid,
  authorization_id uuid,
  organization_service_id uuid,
  authorized_quantity numeric,
  quantity_unit text,
  quantity_period text,
  service_requirement_code text,
  effective_start_date date,
  effective_end_date date,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  local_service_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_read_org_authorizations(target_org_id) then
    raise exception 'Not authorized to read authorizations for this organization';
  end if;

  if page_offset < 0 or page_size < 1 or page_size > 100 then
    raise exception 'Invalid authorization service page range';
  end if;

  if not exists (
    select 1
    from public.patients patient
    where patient.id = target_patient_id
      and patient.organization_id = target_org_id
      and patient.archived_at is null
  ) then
    raise exception 'Patient not found';
  end if;

  return query
  select
    authorization_service.id,
    authorization_service.organization_id,
    authorization_service.authorization_id,
    authorization_service.organization_service_id,
    authorization_service.authorized_quantity,
    authorization_service.quantity_unit,
    authorization_service.quantity_period,
    authorization_service.service_requirement_code,
    authorization_service.effective_start_date,
    authorization_service.effective_end_date,
    authorization_service.active,
    authorization_service.created_at,
    authorization_service.updated_at,
    organization_service.local_service_name
  from public.authorization_services authorization_service
  join public.patient_authorizations patient_authorization
    on patient_authorization.organization_id = authorization_service.organization_id
    and patient_authorization.id = authorization_service.authorization_id
  join public.organization_services organization_service
    on organization_service.organization_id = authorization_service.organization_id
    and organization_service.id = authorization_service.organization_service_id
  where authorization_service.organization_id = target_org_id
    and patient_authorization.patient_id = target_patient_id
    and patient_authorization.archived_at is null
    and patient_authorization.status = 'Active'
    and on_date between patient_authorization.authorization_start_date and patient_authorization.authorization_end_date
    and authorization_service.active
    and on_date between authorization_service.effective_start_date and authorization_service.effective_end_date
  order by authorization_service.effective_end_date, authorization_service.id
  offset page_offset
  limit page_size;
end;
$$;

create function public.list_patient_authorizations_for_patient(
  target_org_id uuid,
  target_patient_id uuid,
  page_offset integer,
  page_size integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.can_read_org_authorizations(target_org_id) then
    raise exception 'Not authorized to read authorizations for this organization';
  end if;

  if page_offset < 0 or page_size < 1 or page_size > 100 then
    raise exception 'Invalid authorization page range';
  end if;

  with matching_authorizations as (
    select
      patient_authorization.*,
      payer.payer_name,
      payer.payer_type
    from public.patient_authorizations patient_authorization
    join public.payers payer
      on payer.organization_id = patient_authorization.organization_id
      and payer.id = patient_authorization.payer_id
    join public.patients patient
      on patient.organization_id = patient_authorization.organization_id
      and patient.id = patient_authorization.patient_id
      and patient.archived_at is null
    where patient_authorization.organization_id = target_org_id
      and patient_authorization.patient_id = target_patient_id
      and patient_authorization.archived_at is null
  ),
  page_rows as (
    select *
    from matching_authorizations
    order by authorization_end_date, id
    offset page_offset
    limit page_size
  ),
  service_counts as (
    select authorization_service.authorization_id, count(*)::integer as service_count
    from public.authorization_services authorization_service
    where authorization_service.organization_id = target_org_id
      and authorization_service.authorization_id in (select id from page_rows)
    group by authorization_service.authorization_id
  )
  select jsonb_build_object(
    'rows',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', page_row.id,
          'organization_id', page_row.organization_id,
          'patient_id', page_row.patient_id,
          'payer_id', page_row.payer_id,
          'masked_prior_auth_number', page_row.masked_prior_auth_number,
          'authorization_start_date', page_row.authorization_start_date,
          'authorization_end_date', page_row.authorization_end_date,
          'status', page_row.status,
          'retention_category', page_row.retention_category,
          'created_at', page_row.created_at,
          'created_by_user_id', page_row.created_by_user_id,
          'updated_at', page_row.updated_at,
          'updated_by_user_id', page_row.updated_by_user_id,
          'archived_at', page_row.archived_at,
          'payer', jsonb_build_object('payer_name', page_row.payer_name, 'payer_type', page_row.payer_type),
          'service_count', coalesce(service_counts.service_count, 0),
          'effective_status', case
            when page_row.authorization_end_date < current_date
              and page_row.status in ('Active', 'Pending Recertification')
              then 'Expired'
            else page_row.status
          end
        )
        order by page_row.authorization_end_date, page_row.id
      ),
      '[]'::jsonb
    ),
    'rowCount', (select count(*) from matching_authorizations)
  )
  into result
  from page_rows page_row
  left join service_counts on service_counts.authorization_id = page_row.id;

  return result;
end;
$$;

create function public.get_patient_authorization_detail(
  target_org_id uuid,
  target_patient_id uuid,
  target_authorization_id uuid,
  service_date date,
  service_offset integer default 0,
  service_limit integer default 25,
  target_service_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  authorization_row public.patient_authorizations;
  payer_row public.payers;
  rates_visible boolean;
  service_rows jsonb;
  service_count integer;
begin
  if not public.can_read_org_authorizations(target_org_id) then
    raise exception 'Not authorized to read authorizations for this organization';
  end if;

  if service_offset < 0 or service_limit < 1 or service_limit > 100 then
    raise exception 'Invalid authorization detail page range';
  end if;

  select *
  into authorization_row
  from public.patient_authorizations
  where organization_id = target_org_id
    and patient_id = target_patient_id
    and id = target_authorization_id
    and archived_at is null
    and exists (
      select 1
      from public.patients patient
      where patient.organization_id = target_org_id
        and patient.id = target_patient_id
        and patient.archived_at is null
    );

  if not found then
    return null;
  end if;

  select payer.*
  into payer_row
  from public.payers payer
  where payer.organization_id = target_org_id
    and payer.id = authorization_row.payer_id;

  rates_visible := public.can_read_org_authorization_rates(target_org_id);

  select count(*)::integer
  into service_count
  from public.authorization_services authorization_service
  where authorization_service.organization_id = target_org_id
    and authorization_service.authorization_id = target_authorization_id
    and authorization_service.active;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', service_line.id,
        'organization_id', service_line.organization_id,
        'authorization_id', service_line.authorization_id,
        'organization_service_id', service_line.organization_service_id,
        'authorized_quantity', service_line.authorized_quantity,
        'quantity_unit', service_line.quantity_unit,
        'quantity_period', service_line.quantity_period,
        'service_requirement_code', service_line.service_requirement_code,
        'effective_start_date', service_line.effective_start_date,
        'effective_end_date', service_line.effective_end_date,
        'active', service_line.active,
        'created_at', service_line.created_at,
        'updated_at', service_line.updated_at,
        'organization_service', jsonb_build_object('local_service_name', service_line.local_service_name),
        'effective_rate', case
          when not rates_visible then null
          else jsonb_build_object(
            'rate',
            case
              when service_line.reimbursement_rate is not null
                and service_date between service_line.effective_start_date and service_line.effective_end_date
                then service_line.reimbursement_rate
              else service_line.organization_rate
            end,
            'rate_unit',
            case
              when service_line.reimbursement_rate is not null
                and service_date between service_line.effective_start_date and service_line.effective_end_date
                then service_line.rate_unit
              else service_line.organization_rate_unit
            end,
            'source',
            case
              when service_line.reimbursement_rate is not null
                and service_date between service_line.effective_start_date and service_line.effective_end_date
                then 'authorization'
              when service_line.organization_rate is not null
                then 'organization_default'
              else 'missing'
            end
          )
        end
      )
      order by service_line.effective_start_date, service_line.id
    ),
    '[]'::jsonb
  )
  into service_rows
  from (
    select
      authorization_service.id,
      authorization_service.organization_id,
      authorization_service.authorization_id,
      authorization_service.organization_service_id,
      authorization_service.authorized_quantity,
      authorization_service.quantity_unit,
      authorization_service.quantity_period,
      authorization_service.service_requirement_code,
      authorization_service.effective_start_date,
      authorization_service.effective_end_date,
      authorization_service.active,
      authorization_service.created_at,
      authorization_service.updated_at,
      authorization_service.reimbursement_rate,
      authorization_service.rate_unit,
      organization_service.local_service_name,
      organization_rate.reimbursement_rate as organization_rate,
      organization_rate.rate_unit as organization_rate_unit
    from public.authorization_services authorization_service
    join public.organization_services organization_service
      on organization_service.organization_id = authorization_service.organization_id
      and organization_service.id = authorization_service.organization_service_id
    left join lateral (
      select service_rate.reimbursement_rate, service_rate.rate_unit
      from public.organization_service_rates service_rate
      where service_rate.organization_id = target_org_id
        and service_rate.organization_service_id = authorization_service.organization_service_id
        and service_rate.effective_start_date <= service_date
        and (service_rate.effective_end_date is null or service_rate.effective_end_date >= service_date)
      order by service_rate.effective_start_date desc
      limit 1
    ) organization_rate on true
    where authorization_service.organization_id = target_org_id
      and authorization_service.authorization_id = target_authorization_id
      and authorization_service.active
      and (target_service_id is null or authorization_service.id = target_service_id)
    order by authorization_service.effective_start_date, authorization_service.id
    offset case when target_service_id is null then service_offset else 0 end
    limit case when target_service_id is null then service_limit else 1 end
  ) service_line;

  return jsonb_build_object(
    'id', authorization_row.id,
    'organization_id', authorization_row.organization_id,
    'patient_id', authorization_row.patient_id,
    'payer_id', authorization_row.payer_id,
    'masked_prior_auth_number', authorization_row.masked_prior_auth_number,
    'authorization_start_date', authorization_row.authorization_start_date,
    'authorization_end_date', authorization_row.authorization_end_date,
    'status', authorization_row.status,
    'retention_category', authorization_row.retention_category,
    'created_at', authorization_row.created_at,
    'created_by_user_id', authorization_row.created_by_user_id,
    'updated_at', authorization_row.updated_at,
    'updated_by_user_id', authorization_row.updated_by_user_id,
    'archived_at', authorization_row.archived_at,
    'payer', jsonb_build_object('payer_name', payer_row.payer_name, 'payer_type', payer_row.payer_type),
    'services', service_rows,
    'service_count', service_count,
    'effective_status', case
      when authorization_row.authorization_end_date < current_date
        and authorization_row.status in ('Active', 'Pending Recertification')
        then 'Expired'
      else authorization_row.status
    end
  );
end;
$$;

create function public.resolve_effective_authorization_service_rates(
  target_org_id uuid,
  target_authorization_service_ids uuid[],
  service_date date
)
returns table(
  authorization_service_id uuid,
  reimbursement_rate numeric,
  rate_unit text,
  source text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_read_org_authorization_rates(target_org_id) then
    raise exception 'Not authorized to read authorization rates for this organization';
  end if;

  return query
  select
    authorization_service.id,
    case
      when authorization_service.reimbursement_rate is not null
        and service_date between authorization_service.effective_start_date and authorization_service.effective_end_date
        then authorization_service.reimbursement_rate
      else organization_rate.reimbursement_rate
    end,
    case
      when authorization_service.reimbursement_rate is not null
        and service_date between authorization_service.effective_start_date and authorization_service.effective_end_date
        then authorization_service.rate_unit
      else organization_rate.rate_unit
    end,
    case
      when authorization_service.reimbursement_rate is not null
        and service_date between authorization_service.effective_start_date and authorization_service.effective_end_date
        then 'authorization'
      when organization_rate.reimbursement_rate is not null
        then 'organization_default'
      else 'missing'
    end
  from public.authorization_services authorization_service
  left join lateral (
    select service_rate.reimbursement_rate, service_rate.rate_unit
    from public.organization_service_rates service_rate
    where service_rate.organization_id = target_org_id
      and service_rate.organization_service_id = authorization_service.organization_service_id
      and service_rate.effective_start_date <= service_date
      and (service_rate.effective_end_date is null or service_rate.effective_end_date >= service_date)
    order by service_rate.effective_start_date desc
    limit 1
  ) organization_rate on true
  where authorization_service.organization_id = target_org_id
    and authorization_service.id = any(target_authorization_service_ids)
  order by authorization_service.id;
end;
$$;

revoke all on function public.create_authorization_with_services(uuid, uuid, uuid, date, date, text, text, jsonb)
  from public, anon;
grant execute on function public.create_authorization_with_services(uuid, uuid, uuid, date, date, text, text, jsonb)
  to authenticated;

revoke all on function public.list_active_authorization_services_for_patient(uuid, uuid, date, integer, integer)
  from public, anon;
grant execute on function public.list_active_authorization_services_for_patient(uuid, uuid, date, integer, integer)
  to authenticated;

revoke all on function public.list_patient_authorizations_for_patient(uuid, uuid, integer, integer)
  from public, anon;
grant execute on function public.list_patient_authorizations_for_patient(uuid, uuid, integer, integer)
  to authenticated;

revoke all on function public.get_patient_authorization_detail(uuid, uuid, uuid, date, integer, integer, uuid)
  from public, anon;
grant execute on function public.get_patient_authorization_detail(uuid, uuid, uuid, date, integer, integer, uuid)
  to authenticated;

revoke all on function public.resolve_effective_authorization_service_rates(uuid, uuid[], date)
  from public, anon;
grant execute on function public.resolve_effective_authorization_service_rates(uuid, uuid[], date)
  to authenticated;
