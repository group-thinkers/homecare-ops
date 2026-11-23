import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/db/client'
import {
  ALLOWED_AUTH_TRANSITIONS,
  activateOrgService,
  createAuthorization,
  getAuthorizationDetail,
  listActiveAuthorizationServicesForPatient,
  listAvailableServiceCodeMappings,
  listPatientAuthorizations,
  listOrganizationServiceRates,
  listPayers,
  pickEffectiveRate,
  setOrganizationServiceRate,
  updateAuthorization,
} from '@/lib/services/authorizations.service'

const mockClient = createClient as ReturnType<typeof vi.fn>
const ORG_ID = '00000000-0000-0000-0000-000000000001'
const PATIENT_ID = '00000000-0000-0000-0000-000000000002'
const AUTHORIZATION_ID = '00000000-0000-0000-0000-000000000003'
const SERVICE_ID = '00000000-0000-0000-0000-000000000004'
const USER_ID = '00000000-0000-0000-0000-000000000005'

function makeSupabase() {
  const supabase = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    rpc: vi.fn(),
    single: vi.fn(),
  }
  for (const method of ['from', 'select', 'eq', 'is', 'order', 'insert', 'update'] as const) {
    supabase[method].mockReturnValue(supabase)
  }
  supabase.range.mockResolvedValue({ data: [], error: null, count: 0 })
  mockClient.mockResolvedValue(supabase)
  return supabase
}

beforeEach(() => vi.clearAllMocks())

describe('pickEffectiveRate', () => {
  const service = {
    reimbursement_rate: 25,
    rate_unit: 'Hour' as const,
    effective_start_date: '2026-10-01',
    effective_end_date: '2026-10-31',
  }
  const organizationRate = { reimbursement_rate: 20, rate_unit: 'Visit' as const }

  it.each([
    ['authorization rate in range', service, organizationRate, '2026-10-15', {
      rate: 25, rate_unit: 'Hour', source: 'authorization',
    }],
    ['null authorization rate', { ...service, reimbursement_rate: null }, organizationRate, '2026-10-15', {
      rate: 20, rate_unit: 'Visit', source: 'organization_default',
    }],
    ['authorization rate out of range', service, organizationRate, '2026-11-01', {
      rate: 20, rate_unit: 'Visit', source: 'organization_default',
    }],
    ['no rate exists', { ...service, reimbursement_rate: null }, null, '2026-10-15', {
      rate: null, rate_unit: null, source: 'missing',
    }],
  ])('resolves %s', (_label, authorizationService, orgRate, date, expected) => {
    expect(pickEffectiveRate(authorizationService, orgRate, date)).toEqual(expected)
  })
})

describe('ALLOWED_AUTH_TRANSITIONS', () => {
  it('rejects every transition not explicitly listed', async () => {
    const statuses = Object.keys(ALLOWED_AUTH_TRANSITIONS) as (keyof typeof ALLOWED_AUTH_TRANSITIONS)[]
    for (const currentStatus of statuses) {
      for (const nextStatus of statuses) {
        if (ALLOWED_AUTH_TRANSITIONS[currentStatus].includes(nextStatus)) continue
        const supabase = makeSupabase()
        supabase.single.mockResolvedValue({ data: { status: currentStatus }, error: null })
        await expect(updateAuthorization(ORG_ID, USER_ID, {
          authorizationId: AUTHORIZATION_ID,
          status: nextStatus,
        })).rejects.toThrow('Invalid authorization status transition')
        expect(supabase.update).not.toHaveBeenCalled()
      }
    }
  })
})

describe('listPayers', () => {
  it('uses a bounded explicit projection and organization filter', async () => {
    const supabase = makeSupabase()
    const rows = [{ id: 'payer-id', payer_name: 'Synthetic payer' }]
    supabase.range.mockResolvedValue({ data: rows, error: null, count: 11 })

    await expect(listPayers(ORG_ID, { page: 1, pageSize: 10 })).resolves.toEqual({ rows, rowCount: 11 })
    expect(supabase.from).toHaveBeenCalledWith('payers')
    expect(supabase.select).toHaveBeenCalledWith(expect.not.stringContaining('reimbursement_rate'), { count: 'exact' })
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
    expect(supabase.range).toHaveBeenCalledWith(10, 19)
  })

  it('surfaces query failures instead of returning an empty page', async () => {
    const supabase = makeSupabase()
    supabase.range.mockResolvedValue({ data: null, error: { code: 'XX000' }, count: null })
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      await expect(listPayers(ORG_ID)).rejects.toThrow('Unable to load payers.')
    } finally {
      errorLog.mockRestore()
    }
  })
})

describe('activateOrgService', () => {
  it('turns the unique service mapping constraint into a friendly duplicate message', async () => {
    const supabase = makeSupabase()
    supabase.single.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } })

    await expect(activateOrgService(ORG_ID, USER_ID, {
      service_code_mapping_id: SERVICE_ID,
      requires_clinical_approval: false,
    })).rejects.toThrow('Service already activated')
  })
})

describe('listAvailableServiceCodeMappings', () => {
  it('uses a bounded projected query for active reference mappings', async () => {
    const supabase = makeSupabase()
    const rows = [{ id: 'mapping-id', evv_service_name: 'Synthetic service' }]
    supabase.range.mockResolvedValue({ data: rows, error: null, count: 1 })

    await expect(listAvailableServiceCodeMappings()).resolves.toEqual(rows)
    expect(supabase.from).toHaveBeenCalledWith('service_code_mappings')
    expect(supabase.select).toHaveBeenCalledWith(expect.stringContaining('billing_code'), { count: 'exact' })
    expect(supabase.eq).toHaveBeenCalledWith('active', true)
    expect(supabase.range).toHaveBeenCalledWith(0, 24)
  })
})

describe('getAuthorizationDetail', () => {
  const detail = {
    id: AUTHORIZATION_ID,
    organization_id: ORG_ID,
    patient_id: PATIENT_ID,
    payer_id: 'payer-id',
    masked_prior_auth_number: '****1234',
    authorization_start_date: '2026-01-01',
    authorization_end_date: '2026-12-31',
    status: 'Active',
    service_count: 1,
    services: [{
      id: SERVICE_ID,
      organization_id: ORG_ID,
      authorization_id: AUTHORIZATION_ID,
      organization_service_id: 'organization-service-id',
      authorized_quantity: 10,
      quantity_unit: 'Hours',
      quantity_period: 'Week',
      service_requirement_code: null,
      effective_start_date: '2026-01-01',
      effective_end_date: '2026-12-31',
      active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: null,
      organization_service: { local_service_name: 'Synthetic service' },
    }],
    payer: { payer_name: 'Synthetic payer', payer_type: 'Medicaid' },
  }

  it('does not request or return raw rates for a non-financial reader', async () => {
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({
      data: { ...detail, services: [{ ...detail.services[0], effective_rate: null }] },
      error: null,
    })

    const result = await getAuthorizationDetail(ORG_ID, PATIENT_ID, AUTHORIZATION_ID, '2026-06-01')

    expect(result?.services[0]?.effective_rate).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith('get_patient_authorization_detail', {
      target_org_id: ORG_ID,
      target_patient_id: PATIENT_ID,
      target_authorization_id: AUTHORIZATION_ID,
      service_date: '2026-06-01',
      service_offset: 0,
      service_limit: 25,
      target_service_id: null,
    })
  })

  it('returns effective rates with the detail read model for a permitted financial reader', async () => {
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({
      data: {
        ...detail,
        services: [{
          ...detail.services[0],
          effective_rate: { rate: 42.5, rate_unit: 'Hour', source: 'authorization' },
        }],
      },
      error: null,
    })

    const result = await getAuthorizationDetail(ORG_ID, PATIENT_ID, AUTHORIZATION_ID, '2026-06-01')

    expect(result?.services[0]?.effective_rate).toEqual({
      rate: 42.5,
      rate_unit: 'Hour',
      source: 'authorization',
    })
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith('get_patient_authorization_detail', {
      target_org_id: ORG_ID,
      target_patient_id: PATIENT_ID,
      target_authorization_id: AUTHORIZATION_ID,
      service_date: '2026-06-01',
      service_offset: 0,
      service_limit: 25,
      target_service_id: null,
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('requests a bounded service page or a specific service for edit flows', async () => {
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({ data: { ...detail, services: [] }, error: null })

    await getAuthorizationDetail(ORG_ID, PATIENT_ID, AUTHORIZATION_ID, '2026-06-01', 25)
    await getAuthorizationDetail(ORG_ID, PATIENT_ID, AUTHORIZATION_ID, '2026-10-01', 0, SERVICE_ID)

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'get_patient_authorization_detail', {
      target_org_id: ORG_ID,
      target_patient_id: PATIENT_ID,
      target_authorization_id: AUTHORIZATION_ID,
      service_date: '2026-06-01',
      service_offset: 25,
      service_limit: 25,
      target_service_id: null,
    })
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'get_patient_authorization_detail', {
      target_org_id: ORG_ID,
      target_patient_id: PATIENT_ID,
      target_authorization_id: AUTHORIZATION_ID,
      service_date: '2026-10-01',
      service_offset: 0,
      service_limit: 25,
      target_service_id: SERVICE_ID,
    })
  })
})

describe('listPatientAuthorizations', () => {
  it('uses the bounded SQL read model with database-derived status and count', async () => {
    const supabase = makeSupabase()
    const page = {
      rows: [{ id: AUTHORIZATION_ID, effective_status: 'Expired', service_count: 2 }],
      rowCount: 7,
    }
    supabase.rpc.mockResolvedValue({ data: page, error: null })

    await expect(listPatientAuthorizations(ORG_ID, PATIENT_ID, { page: 1, pageSize: 10 })).resolves.toEqual(page)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).toHaveBeenCalledWith('list_patient_authorizations_for_patient', {
      target_org_id: ORG_ID,
      target_patient_id: PATIENT_ID,
      page_offset: 10,
      page_size: 10,
    })
  })
})

describe('createAuthorization', () => {
  it('creates the parent and nested service lines through one transaction RPC', async () => {
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({ data: AUTHORIZATION_ID, error: null })
    const input = {
      patientId: PATIENT_ID,
      payer_id: 'payer-id',
      authorization_start_date: '2026-01-01',
      authorization_end_date: '2026-12-31',
      services: [{
        organization_service_id: 'organization-service-id',
        authorized_quantity: 10,
        quantity_unit: 'Hours' as const,
        quantity_period: 'Week' as const,
        rate_unit: 'Hour' as const,
      }],
    }

    await expect(createAuthorization(ORG_ID, input)).resolves.toBe(AUTHORIZATION_ID)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith('create_authorization_with_services', {
      target_org_id: ORG_ID,
      target_patient_id: PATIENT_ID,
      target_payer_id: 'payer-id',
      authorization_start_date: '2026-01-01',
      authorization_end_date: '2026-12-31',
      status: undefined,
      prior_auth_number: null,
      services: input.services,
    })
  })

  it('does not log the prior authorization value when the write fails', async () => {
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Rejected SYNTHETIC-SECRET' },
    })
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      await expect(createAuthorization(ORG_ID, {
        patientId: PATIENT_ID,
        payer_id: 'payer-id',
        authorization_start_date: '2026-01-01',
        authorization_end_date: '2026-12-31',
        prior_auth_number: 'SYNTHETIC-SECRET',
        services: [],
      })).rejects.toThrow('Unable to create authorization')
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain('SYNTHETIC-SECRET')
    } finally {
      errorLog.mockRestore()
    }
  })
})

describe('listActiveAuthorizationServicesForPatient', () => {
  it('uses a bounded safe RPC page rather than selecting financial columns', async () => {
    const supabase = makeSupabase()
    const rows = [{
      id: SERVICE_ID,
      organization_id: ORG_ID,
      authorization_id: AUTHORIZATION_ID,
      organization_service_id: 'organization-service-id',
      authorized_quantity: 10,
      quantity_unit: 'Hours',
      quantity_period: 'Week',
      service_requirement_code: null,
      effective_start_date: '2026-01-01',
      effective_end_date: '2026-12-31',
      active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: null,
      local_service_name: 'Synthetic service',
    }]
    supabase.rpc.mockResolvedValue({ data: rows, error: null })

    await expect(listActiveAuthorizationServicesForPatient(ORG_ID, PATIENT_ID, '2026-06-01', 2, 25)).resolves.toEqual(rows)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).toHaveBeenCalledWith('list_active_authorization_services_for_patient', {
      target_org_id: ORG_ID,
      target_patient_id: PATIENT_ID,
      on_date: '2026-06-01',
      page_offset: 50,
      page_size: 25,
    })
  })
})

describe('listOrganizationServiceRates', () => {
  it('filters by tenant and service with explicit projected pagination', async () => {
    const supabase = makeSupabase()
    const rows = [{ id: 'rate-id', reimbursement_rate: 30.75 }]
    supabase.range.mockResolvedValue({ data: rows, error: null, count: 1 })

    await expect(listOrganizationServiceRates(ORG_ID, 'organization-service-id')).resolves.toEqual({ rows, rowCount: 1 })
    expect(supabase.from).toHaveBeenCalledWith('organization_service_rates')
    expect(supabase.eq).toHaveBeenCalledWith('organization_id', ORG_ID)
    expect(supabase.eq).toHaveBeenCalledWith('organization_service_id', 'organization-service-id')
    expect(supabase.range).toHaveBeenCalledWith(0, 9)
  })
})

describe('setOrganizationServiceRate', () => {
  it('uses the transactional RPC instead of direct table writes', async () => {
    const supabase = makeSupabase()
    const row = { id: 'rate-id', reimbursement_rate: 30.75 }
    supabase.rpc.mockResolvedValue({ data: row, error: null })
    const input = {
      reimbursement_rate: 30.75,
      rate_unit: 'Hour' as const,
      effective_start_date: '2026-12-01',
      change_reason: 'Synthetic payer update',
    }

    await expect(setOrganizationServiceRate(ORG_ID, 'organization-service-id', input)).resolves.toEqual(row)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith('set_organization_service_rate', {
      target_org_id: ORG_ID,
      target_organization_service_id: 'organization-service-id',
      ...input,
    })
  })

  it('does not log the rate amount when the RPC rejects a write', async () => {
    const supabase = makeSupabase()
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: '23P01', message: 'Conflicting row includes amount 50.25' },
    })
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      await expect(setOrganizationServiceRate(ORG_ID, 'organization-service-id', {
        reimbursement_rate: 50.25,
        rate_unit: 'Hour',
        effective_start_date: '2026-12-01',
        change_reason: 'Synthetic prospective test',
      })).rejects.toThrow('Unable to set organization service rate')
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain('50.25')
    } finally {
      errorLog.mockRestore()
    }
  })
})
