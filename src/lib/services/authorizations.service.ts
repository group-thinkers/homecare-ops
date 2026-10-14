import { createClient } from '@/lib/db/client'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/lib/pagination'
import type {
  AuthorizationService,
  AuthorizationServiceCompatibility,
  AuthorizationServiceWithEffectiveRate,
  AuthorizationStatus,
  EffectiveRate,
  OrganizationService,
  OrganizationServiceRate,
  OrganizationServiceListPage,
  OrganizationServiceWithMapping,
  PatientAuthorization,
  PatientAuthorizationDetail,
  PatientAuthorizationListItem,
  PatientAuthorizationListPage,
  Payer,
  PayerListPage,
} from '@/types'
import type {
  ActivateOrgServiceInput,
  AuthorizationServiceInput,
  ArchiveAuthorizationInput,
  DeactivateAuthorizationServiceInput,
  UpdateAuthorizationInput,
  UpdateOrgServiceInput,
  UpsertAuthorizationServiceInput,
  UpsertPayerInput,
} from '@/lib/schemas/authorizations.schema'

const PAYER_LIST_COLUMNS = `
  id,
  organization_id,
  payer_name,
  payer_type,
  program_name,
  status,
  created_at
`

const ORGANIZATION_SERVICE_LIST_COLUMNS = `
  id,
  organization_id,
  service_code_mapping_id,
  local_service_name,
  default_rate_unit,
  requires_clinical_approval,
  enabled,
  created_at,
  created_by_user_id,
  updated_at,
  updated_by_user_id,
  service_code_mapping:service_code_mappings(
    id,
    evv_service_id,
    evv_service_name,
    payer_type,
    program_name,
    billing_service:billing_services(
      billing_code,
      service_name,
      service_category
    )
  )
`

const AUTHORIZATION_LIST_COLUMNS = `
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
  archived_at,
  payer:payers(
    payer_name,
    payer_type
  ),
  services:authorization_services(
    id
  )
`

export const ALLOWED_AUTH_TRANSITIONS: Record<AuthorizationStatus, AuthorizationStatus[]> = {
  Active: ['Under Review', 'Pending Recertification', 'Suspended', 'Expired'],
  'Pending Recertification': ['Active', 'Suspended', 'Expired'],
  'Under Review': ['Active', 'Expired'],
  Suspended: ['Active', 'Expired'],
  Expired: [],
}

function pagination(filters?: { page?: number; pageSize?: number }): { rangeStart: number; rangeEnd: number } {
  const requestedPage = filters?.page ?? 0
  const requestedPageSize = filters?.pageSize ?? DEFAULT_PAGE_SIZE
  const page = Number.isInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE
  return { rangeStart: page * pageSize, rangeEnd: page * pageSize + pageSize - 1 }
}

function effectiveStatus(status: AuthorizationStatus, endDate: string, today = new Date().toISOString().slice(0, 10)): AuthorizationStatus {
  return endDate < today && (status === 'Active' || status === 'Pending Recertification') ? 'Expired' : status
}

function toUtcDays(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  return Math.floor(Date.UTC(year, (month ?? 1) - 1, day ?? 1) / 86_400_000)
}

export function pickEffectiveRate(
  authorizationService: Pick<AuthorizationService, 'reimbursement_rate' | 'rate_unit' | 'effective_start_date' | 'effective_end_date'>,
  organizationRate: Pick<OrganizationServiceRate, 'reimbursement_rate' | 'rate_unit'> | null,
  serviceDate: string,
): EffectiveRate {
  const date = toUtcDays(serviceDate)
  if (
    authorizationService.reimbursement_rate !== null
    && date >= toUtcDays(authorizationService.effective_start_date)
    && date <= toUtcDays(authorizationService.effective_end_date)
  ) {
    return {
      rate: authorizationService.reimbursement_rate,
      rate_unit: authorizationService.rate_unit,
      source: 'authorization',
    }
  }
  if (organizationRate) {
    return {
      rate: organizationRate.reimbursement_rate,
      rate_unit: organizationRate.rate_unit,
      source: 'organization_default',
    }
  }
  return { rate: null, rate_unit: null, source: 'missing' }
}

export async function listPayers(
  orgId: string,
  filters?: { includeInactive?: boolean; page?: number; pageSize?: number },
): Promise<PayerListPage> {
  const supabase = await createClient()
  const { rangeStart, rangeEnd } = pagination(filters)
  let query = supabase.from('payers').select(PAYER_LIST_COLUMNS, { count: 'exact' }).eq('organization_id', orgId)
  if (!filters?.includeInactive) query = query.eq('status', 'Active')
  const { data, error, count } = await query.order('payer_name').order('id').range(rangeStart, rangeEnd)
  if (error) {
    console.error('[listPayers] query failed:', { orgId, filters, error })
    return { rows: [], rowCount: 0 }
  }
  return { rows: (data ?? []) as PayerListPage['rows'], rowCount: count ?? 0 }
}

export async function upsertPayer(orgId: string, data: Omit<UpsertPayerInput, 'organizationId'>): Promise<Payer> {
  const supabase = await createClient()
  const payload = {
    organization_id: orgId,
    payer_name: data.payer_name,
    payer_type: data.payer_type,
    program_name: data.program_name ?? null,
    status: data.status ?? 'Active',
    updated_at: new Date().toISOString(),
  }
  const query = data.payerId
    ? supabase.from('payers').update(payload as never).eq('id', data.payerId).eq('organization_id', orgId)
    : supabase.from('payers').insert(payload as never)
  const { data: row, error } = await query.select().single()
  if (error) {
    console.error('[upsertPayer] write failed:', { orgId, payerId: data.payerId, error })
    throw new Error(error.message)
  }
  return row as Payer
}

export async function listAvailableServiceCodeMappings(): Promise<OrganizationServiceWithMapping['service_code_mapping'][]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('service_code_mappings')
    .select(`
      id,
      evv_service_id,
      evv_service_name,
      payer_type,
      program_name,
      billing_service:billing_services(
        billing_code,
        service_name,
        service_category
      )
    `)
    .eq('active', true)
    .order('evv_service_name')
    .order('id')
  if (error) {
    console.error('[listAvailableServiceCodeMappings] query failed:', { error })
    return []
  }
  return (data ?? []) as unknown as OrganizationServiceWithMapping['service_code_mapping'][]
}

export async function listOrgServices(
  orgId: string,
  filters?: { includeDisabled?: boolean; page?: number; pageSize?: number },
): Promise<OrganizationServiceListPage> {
  const supabase = await createClient()
  const { rangeStart, rangeEnd } = pagination(filters)
  let query = supabase
    .from('organization_services')
    .select(ORGANIZATION_SERVICE_LIST_COLUMNS, { count: 'exact' })
    .eq('organization_id', orgId)
  if (!filters?.includeDisabled) query = query.eq('enabled', true)
  const { data, error, count } = await query.order('local_service_name').order('id').range(rangeStart, rangeEnd)
  if (error) {
    console.error('[listOrgServices] query failed:', { orgId, filters, error })
    return { rows: [], rowCount: 0 }
  }
  return { rows: (data ?? []) as unknown as OrganizationServiceWithMapping[], rowCount: count ?? 0 }
}

export async function activateOrgService(
  orgId: string,
  userId: string,
  data: Omit<ActivateOrgServiceInput, 'organizationId'>,
): Promise<OrganizationService> {
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('organization_services')
    .insert({
      organization_id: orgId,
      service_code_mapping_id: data.service_code_mapping_id,
      local_service_name: data.local_service_name ?? null,
      requires_clinical_approval: data.requires_clinical_approval,
      created_by_user_id: userId,
    } as never)
    .select()
    .single()
  if (error) {
    console.error('[activateOrgService] insert failed:', { orgId, error })
    if (error.code === '23505') throw new Error('Service already activated')
    throw new Error(error.message)
  }
  return row as OrganizationService
}

export async function updateOrgService(
  orgId: string,
  userId: string,
  data: Omit<UpdateOrgServiceInput, 'organizationId'>,
): Promise<OrganizationService> {
  const supabase = await createClient()
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by_user_id: userId }
  if (data.local_service_name !== undefined) updateData.local_service_name = data.local_service_name
  if (data.requires_clinical_approval !== undefined) updateData.requires_clinical_approval = data.requires_clinical_approval
  if (data.enabled !== undefined) updateData.enabled = data.enabled
  const { data: row, error } = await supabase
    .from('organization_services')
    .update(updateData as never)
    .eq('id', data.organizationServiceId)
    .eq('organization_id', orgId)
    .select()
    .single()
  if (error) {
    console.error('[updateOrgService] update failed:', { orgId, organizationServiceId: data.organizationServiceId, error })
    throw new Error(error.message)
  }
  return row as OrganizationService
}

export async function listPatientAuthorizations(
  orgId: string,
  patientId: string,
  filters?: { page?: number; pageSize?: number },
): Promise<PatientAuthorizationListPage> {
  const supabase = await createClient()
  const { rangeStart, rangeEnd } = pagination(filters)
  const { data, error, count } = await supabase
    .from('patient_authorizations')
    .select(AUTHORIZATION_LIST_COLUMNS, { count: 'exact' })
    .eq('organization_id', orgId)
    .eq('patient_id', patientId)
    .is('archived_at', null)
    .order('authorization_end_date', { ascending: true })
    .order('id')
    .range(rangeStart, rangeEnd)
  if (error) {
    console.error('[listPatientAuthorizations] query failed:', { orgId, patientId, filters, error })
    return { rows: [], rowCount: 0 }
  }
  const rows = (data ?? []).map((row) => {
    const typed = row as unknown as Omit<PatientAuthorizationListItem, 'service_count' | 'effective_status'>
      & { services: { id: string }[] }
    const { services, ...authorization } = typed
    return {
      ...authorization,
      service_count: services.length,
      effective_status: effectiveStatus(authorization.status, authorization.authorization_end_date),
    }
  })
  return { rows, rowCount: count ?? 0 }
}

export async function getAuthorizationDetail(
  orgId: string,
  patientId: string,
  authorizationId: string,
  serviceDate = new Date().toISOString().slice(0, 10),
): Promise<PatientAuthorizationDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('patient_authorizations')
    .select(`
      id, organization_id, patient_id, payer_id, masked_prior_auth_number,
      authorization_start_date, authorization_end_date, status, retention_category,
      created_at, created_by_user_id, updated_at, updated_by_user_id, archived_at,
      payer:payers(payer_name, payer_type),
      services:authorization_services(
        id, organization_id, authorization_id, organization_service_id,
        authorized_quantity, quantity_unit, quantity_period, reimbursement_rate,
        rate_unit, service_requirement_code, restricted_note_id,
        effective_start_date, effective_end_date, active, created_at, updated_at,
        organization_service:organization_services(local_service_name)
      )
    `)
    .eq('organization_id', orgId)
    .eq('patient_id', patientId)
    .eq('id', authorizationId)
    .is('archived_at', null)
    .single()
  if (error) {
    console.error('[getAuthorizationDetail] query failed:', { orgId, patientId, authorizationId, error })
    return null
  }
  const result = data as unknown as Omit<PatientAuthorizationDetail, 'effective_status'>
  const activeServices = result.services
    .filter((service) => service.active)
    .sort((left, right) => left.effective_start_date.localeCompare(right.effective_start_date) || left.id.localeCompare(right.id))
    .slice(0, 4)
  const { data: organizationRates, error: ratesError } = await supabase.rpc('get_effective_organization_service_rates', {
    target_org_id: orgId,
    target_organization_service_ids: activeServices.map((service) => service.organization_service_id),
    service_date: serviceDate,
  })
  if (ratesError) {
    console.error('[getAuthorizationDetail] effective rate lookup failed:', { orgId, authorizationId, ratesError })
    throw new Error(ratesError.message)
  }
  const ratesByServiceId = new Map(
    organizationRates.map((rate) => [rate.organization_service_id, rate]),
  )
  return {
    ...result,
    effective_status: effectiveStatus(result.status, result.authorization_end_date),
    services: activeServices
      .map((service): AuthorizationServiceWithEffectiveRate => ({
        ...service,
        effective_rate: pickEffectiveRate(service, ratesByServiceId.get(service.organization_service_id) ?? null, serviceDate),
      })),
  }
}

export async function createAuthorization(
  orgId: string,
  data: {
    patientId: string
    payer_id: string
    authorization_start_date: string
    authorization_end_date: string
    status?: AuthorizationStatus
    prior_auth_number?: string | null
    services: AuthorizationServiceInput[]
  },
): Promise<PatientAuthorization> {
  const supabase = await createClient()
  const { data: row, error } = await supabase.rpc('create_authorization_with_services', {
    target_org_id: orgId,
    target_patient_id: data.patientId,
    target_payer_id: data.payer_id,
    authorization_start_date: data.authorization_start_date,
    authorization_end_date: data.authorization_end_date,
    status: data.status,
    prior_auth_number: data.prior_auth_number ?? null,
    services: data.services,
  })
  if (error) {
    console.error('[createAuthorization] RPC failed:', { orgId, patientId: data.patientId, error })
    throw new Error(error.message)
  }
  return row
}

export async function updateAuthorization(
  orgId: string,
  userId: string,
  data: Omit<UpdateAuthorizationInput, 'organizationId' | 'patientId'>,
): Promise<PatientAuthorization> {
  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase
    .from('patient_authorizations')
    .select('status')
    .eq('organization_id', orgId)
    .eq('id', data.authorizationId)
    .single()
  if (currentError || !current) throw new Error('Authorization not found')
  if (data.status && !ALLOWED_AUTH_TRANSITIONS[current.status as AuthorizationStatus].includes(data.status)) {
    throw new Error('Invalid authorization status transition')
  }
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by_user_id: userId }
  if (data.payer_id !== undefined) updateData.payer_id = data.payer_id
  if (data.authorization_start_date !== undefined) updateData.authorization_start_date = data.authorization_start_date
  if (data.authorization_end_date !== undefined) updateData.authorization_end_date = data.authorization_end_date
  if (data.status !== undefined) updateData.status = data.status
  const { data: row, error } = await supabase
    .from('patient_authorizations')
    .update(updateData as never)
    .eq('organization_id', orgId)
    .eq('id', data.authorizationId)
    .select()
    .single()
  if (error) {
    console.error('[updateAuthorization] update failed:', { orgId, authorizationId: data.authorizationId, error })
    throw new Error(error.message)
  }
  return row as PatientAuthorization
}

export async function archiveAuthorization(
  orgId: string,
  userId: string,
  data: Omit<ArchiveAuthorizationInput, 'organizationId' | 'patientId'>,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('patient_authorizations')
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by_user_id: userId,
    } as never)
    .eq('organization_id', orgId)
    .eq('id', data.authorizationId)
  if (error) {
    console.error('[archiveAuthorization] update failed:', { orgId, authorizationId: data.authorizationId, error })
    throw new Error(error.message)
  }
}

export async function upsertAuthorizationService(
  orgId: string,
  data: Omit<UpsertAuthorizationServiceInput, 'organizationId' | 'patientId'>,
): Promise<AuthorizationService> {
  const supabase = await createClient()
  const { data: authorization, error: authorizationError } = await supabase
    .from('patient_authorizations')
    .select('authorization_start_date, authorization_end_date')
    .eq('organization_id', orgId)
    .eq('id', data.authorizationId)
    .is('archived_at', null)
    .single()
  if (authorizationError || !authorization) {
    console.error('[upsertAuthorizationService] authorization lookup failed:', {
      orgId,
      authorizationId: data.authorizationId,
      error: authorizationError,
    })
    throw new Error('Authorization not found')
  }
  const payload = {
    organization_id: orgId,
    authorization_id: data.authorizationId,
    organization_service_id: data.organization_service_id,
    authorized_quantity: data.authorized_quantity,
    quantity_unit: data.quantity_unit,
    quantity_period: data.quantity_period,
    reimbursement_rate: data.reimbursement_rate ?? null,
    rate_unit: data.rate_unit,
    service_requirement_code: data.service_requirement_code ?? null,
    effective_start_date: data.effective_start_date ?? authorization.authorization_start_date,
    effective_end_date: data.effective_end_date ?? authorization.authorization_end_date,
    updated_at: new Date().toISOString(),
  }
  const query = data.authorizationServiceId
    ? supabase
      .from('authorization_services')
      .update(payload as never)
      .eq('id', data.authorizationServiceId)
      .eq('organization_id', orgId)
      .eq('authorization_id', data.authorizationId)
    : supabase.from('authorization_services').insert(payload as never)
  const { data: row, error } = await query.select().single()
  if (error) {
    console.error('[upsertAuthorizationService] write failed:', {
      orgId,
      authorizationId: data.authorizationId,
      authorizationServiceId: data.authorizationServiceId,
      error,
    })
    throw new Error(error.message)
  }
  return row as AuthorizationService
}

export async function deactivateAuthorizationService(
  orgId: string,
  data: Omit<DeactivateAuthorizationServiceInput, 'organizationId' | 'patientId'>,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('authorization_services')
    .update({ active: false, updated_at: new Date().toISOString() } as never)
    .eq('id', data.authorizationServiceId)
    .eq('organization_id', orgId)
    .eq('authorization_id', data.authorizationId)
  if (error) {
    console.error('[deactivateAuthorizationService] update failed:', {
      orgId,
      authorizationId: data.authorizationId,
      authorizationServiceId: data.authorizationServiceId,
      error,
    })
    throw new Error(error.message)
  }
}

export async function checkAuthorizationServiceCompatibility(
  orgId: string,
  patientId: string,
  organizationServiceId: string,
  serviceDate: string,
): Promise<AuthorizationServiceCompatibility> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('check_authorization_service_compatibility', {
    target_org_id: orgId,
    target_patient_id: patientId,
    target_organization_service_id: organizationServiceId,
    service_date: serviceDate,
  })
  if (error) {
    console.error('[checkAuthorizationServiceCompatibility] RPC failed:', {
      orgId,
      patientId,
      organizationServiceId,
      error,
    })
    throw new Error(error.message)
  }
  return data[0]
}

export async function setOrganizationServiceRate(
  orgId: string,
  organizationServiceId: string,
  input: {
    reimbursement_rate: number
    rate_unit: OrganizationServiceRate['rate_unit']
    effective_start_date: string
    change_reason: string
  },
): Promise<OrganizationServiceRate> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('set_organization_service_rate', {
    target_org_id: orgId,
    target_organization_service_id: organizationServiceId,
    ...input,
  })
  if (error) {
    console.error('[setOrganizationServiceRate] RPC failed:', { orgId, organizationServiceId, error })
    throw new Error(error.message)
  }
  return data
}

export async function listActiveAuthorizationServicesForPatient(
  orgId: string,
  patientId: string,
  onDate: string,
): Promise<AuthorizationService[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('authorization_services')
    .select(`
      id, organization_id, authorization_id, organization_service_id,
      authorized_quantity, quantity_unit, quantity_period, reimbursement_rate,
      rate_unit, service_requirement_code, restricted_note_id,
      effective_start_date, effective_end_date, active, created_at, updated_at,
      authorization:patient_authorizations!inner(
        patient_id, status, authorization_start_date, authorization_end_date, archived_at
      )
    `)
    .eq('organization_id', orgId)
    .eq('authorization.patient_id', patientId)
    .eq('authorization.status', 'Active')
    .is('authorization.archived_at', null)
    .eq('active', true)
    .lte('effective_start_date', onDate)
    .gte('effective_end_date', onDate)
    .order('effective_end_date')
    .order('id')
  if (error) {
    console.error('[listActiveAuthorizationServicesForPatient] query failed:', { orgId, patientId, onDate, error })
    return []
  }
  return (data ?? []) as unknown as AuthorizationService[]
}
