import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/server', () => ({
  AuthError: class AuthError extends Error {},
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/permissions', () => ({
  requireAnyPermission: vi.fn(),
  requirePermission: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/services/patients.service', () => ({}))
vi.mock('@/lib/services/authorizations.service', () => ({
  listPatientAuthorizations: vi.fn(),
  getAuthorizationDetail: vi.fn(),
  listPayers: vi.fn(),
  listOrgServices: vi.fn(),
  createAuthorization: vi.fn(),
  updateAuthorization: vi.fn(),
  archiveAuthorization: vi.fn(),
  upsertAuthorizationService: vi.fn(),
  deactivateAuthorizationService: vi.fn(),
  checkAuthorizationServiceCompatibility: vi.fn(),
  listActiveAuthorizationServicesForPatient: vi.fn(),
}))

import { revalidatePath } from 'next/cache'
import {
  archiveAuthorizationAction,
  checkAuthorizationServiceCompatibilityAction,
  createAuthorizationAction,
  deactivateAuthorizationServiceAction,
  getAuthorizationAction,
  listActiveAuthorizationServicesForPatientAction,
  listAuthorizationFormOptionsAction,
  listPatientAuthorizationsAction,
  updateAuthorizationAction,
  upsertAuthorizationServiceAction,
} from '@/app/(dashboard)/patients/actions'
import { AuthError, requireAuth } from '@/lib/auth/server'
import { requireAnyPermission, requirePermission } from '@/lib/permissions'
import * as service from '@/lib/services/authorizations.service'

const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>
const mockRequireAnyPermission = requireAnyPermission as ReturnType<typeof vi.fn>
const mockRequirePermission = requirePermission as ReturnType<typeof vi.fn>
const mockRevalidatePath = revalidatePath as ReturnType<typeof vi.fn>
const mockListAuthorizations = service.listPatientAuthorizations as ReturnType<typeof vi.fn>
const mockGetAuthorizationDetail = service.getAuthorizationDetail as ReturnType<typeof vi.fn>
const mockListPayers = service.listPayers as ReturnType<typeof vi.fn>
const mockListOrgServices = service.listOrgServices as ReturnType<typeof vi.fn>
const mockCreateAuthorization = service.createAuthorization as ReturnType<typeof vi.fn>
const mockUpdateAuthorization = service.updateAuthorization as ReturnType<typeof vi.fn>
const mockArchiveAuthorization = service.archiveAuthorization as ReturnType<typeof vi.fn>
const mockUpsertAuthorizationService = service.upsertAuthorizationService as ReturnType<typeof vi.fn>
const mockDeactivateAuthorizationService = service.deactivateAuthorizationService as ReturnType<typeof vi.fn>
const mockCheckCompatibility = service.checkAuthorizationServiceCompatibility as ReturnType<typeof vi.fn>
const mockListActiveServices = service.listActiveAuthorizationServicesForPatient as ReturnType<typeof vi.fn>

const ORG_ID = '00000000-0000-0000-0000-000000000001'
const PATIENT_ID = '00000000-0000-0000-0000-000000000002'
const PAYER_ID = '00000000-0000-0000-0000-000000000003'
const AUTHORIZATION_ID = '00000000-0000-0000-0000-000000000004'
const SERVICE_ID = '00000000-0000-0000-0000-000000000005'
const AUTHORIZATION_SERVICE_ID = '00000000-0000-0000-0000-000000000006'
const USER_ID = '00000000-0000-0000-0000-000000000007'

const createInput = {
  organizationId: ORG_ID,
  patientId: PATIENT_ID,
  payer_id: PAYER_ID,
  authorization_start_date: '2026-10-01',
  authorization_end_date: '2026-12-31',
  prior_auth_number: 'SYNTHETIC-1234',
  services: [{
    organization_service_id: SERVICE_ID,
    authorized_quantity: 10,
    quantity_unit: 'Hours',
    quantity_period: 'Week',
    rate_unit: 'Hour',
  }],
}

const serviceInput = {
  organizationId: ORG_ID,
  patientId: PATIENT_ID,
  authorizationId: AUTHORIZATION_ID,
  organization_service_id: SERVICE_ID,
  authorized_quantity: 10,
  quantity_unit: 'Hours',
  quantity_period: 'Week',
  rate_unit: 'Hour',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ id: USER_ID })
  mockRequireAnyPermission.mockResolvedValue(undefined)
  mockRequirePermission.mockResolvedValue(undefined)
})

describe('authorization read actions', () => {
  it('requires authorization or shift permission before listing authorizations', async () => {
    const page = { rows: [], rowCount: 0 }
    mockListAuthorizations.mockResolvedValue(page)

    await expect(listPatientAuthorizationsAction(ORG_ID, PATIENT_ID, { page: 1 })).resolves.toEqual({
      success: true,
      data: page,
    })
    expect(mockRequireAnyPermission).toHaveBeenCalledWith(ORG_ID, ['authorizations.manage', 'shifts.manage'])
    expect(mockListAuthorizations).toHaveBeenCalledWith(ORG_ID, PATIENT_ID, { page: 1 })
  })

  it('does not call the service when a read permission is missing', async () => {
    mockRequireAnyPermission.mockRejectedValue(new AuthError())

    await expect(getAuthorizationAction(ORG_ID, PATIENT_ID, AUTHORIZATION_ID)).resolves.toEqual({
      success: false,
      error: 'Not authorized.',
    })
    expect(mockGetAuthorizationDetail).not.toHaveBeenCalled()
  })

  it('uses the same safe read permission boundary for compatibility and scheduling rows', async () => {
    mockCheckCompatibility.mockResolvedValue({
      authorization_valid: true,
      service_authorized: true,
      has_rate: true,
      reason_code: null,
      rate_source: 'authorization',
    })
    mockListActiveServices.mockResolvedValue([])

    await checkAuthorizationServiceCompatibilityAction(ORG_ID, PATIENT_ID, SERVICE_ID, '2026-10-15')
    await listActiveAuthorizationServicesForPatientAction(ORG_ID, PATIENT_ID, '2026-10-15')

    expect(mockRequireAnyPermission).toHaveBeenCalledTimes(2)
    expect(mockCheckCompatibility).toHaveBeenCalledWith(ORG_ID, PATIENT_ID, SERVICE_ID, '2026-10-15')
    expect(mockListActiveServices).toHaveBeenCalledWith(ORG_ID, PATIENT_ID, '2026-10-15', 0, 100)
  })
})

describe('authorization mutation actions', () => {
  it('validates, authorizes, creates in one service call, and revalidates the patient list', async () => {
    mockCreateAuthorization.mockResolvedValue(AUTHORIZATION_ID)

    await expect(createAuthorizationAction(createInput)).resolves.toEqual({
      success: true,
      data: AUTHORIZATION_ID,
    })
    expect(mockRequireAuth).toHaveBeenCalledOnce()
    expect(mockRequirePermission).toHaveBeenCalledWith(ORG_ID, 'authorizations.manage')
    expect(mockCreateAuthorization).toHaveBeenCalledWith(ORG_ID, {
      patientId: PATIENT_ID,
      payer_id: PAYER_ID,
      authorization_start_date: '2026-10-01',
      authorization_end_date: '2026-12-31',
      status: undefined,
      prior_auth_number: 'SYNTHETIC-1234',
      services: createInput.services,
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/patients/${PATIENT_ID}/authorization`)
  })

  it('rejects unknown mutation fields before permission or service access', async () => {
    const result = await createAuthorizationAction({ ...createInput, unexpected: true })

    expect(result.success).toBe(false)
    expect(mockRequireAuth).toHaveBeenCalledOnce()
    expect(mockRequirePermission).not.toHaveBeenCalled()
    expect(mockCreateAuthorization).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated and forbidden callers without writing', async () => {
    mockRequireAuth.mockRejectedValueOnce(new AuthError('Unauthenticated'))
    await expect(createAuthorizationAction({})).resolves.toEqual({
      success: false,
      error: 'Not authorized.',
    })
    expect(mockRequirePermission).not.toHaveBeenCalled()

    mockRequireAuth.mockResolvedValueOnce({ id: USER_ID })
    mockRequirePermission.mockRejectedValueOnce(new AuthError('Forbidden'))
    await expect(createAuthorizationAction(createInput)).resolves.toEqual({
      success: false,
      error: 'Not authorized.',
    })
    expect(mockCreateAuthorization).not.toHaveBeenCalled()
  })

  it('requires management permission for form options and returns only safe payer/service fields', async () => {
    mockListPayers.mockResolvedValue({
      rows: [{ id: PAYER_ID, payer_name: 'Synthetic payer', payer_type: 'Medicaid', status: 'Active' }],
      rowCount: 1,
    })
    mockListOrgServices.mockResolvedValue({
      rows: [{ id: SERVICE_ID, local_service_name: 'Synthetic service' }],
      rowCount: 1,
    })

    const result = await listAuthorizationFormOptionsAction(ORG_ID)

    expect(result).toEqual({
      success: true,
      data: {
        payers: [{ id: PAYER_ID, payer_name: 'Synthetic payer', payer_type: 'Medicaid', status: 'Active' }],
        organizationServices: [{ id: SERVICE_ID, local_service_name: 'Synthetic service' }],
      },
    })
    expect(mockRequirePermission).toHaveBeenCalledWith(ORG_ID, 'authorizations.manage')
    expect(mockListPayers).toHaveBeenCalledWith(ORG_ID, { page: 0, pageSize: 25, includeInactive: true })
    expect(mockListOrgServices).toHaveBeenCalledWith(ORG_ID, { page: 0, pageSize: 25, includeDisabled: true })
  })

  it('loads all authorization form options across bounded pages', async () => {
    const firstPagePayers = Array.from({ length: 25 }, (_, index) => ({
      id: `payer-${index}`,
      payer_name: `Synthetic payer ${index}`,
      payer_type: 'Medicaid',
      status: 'Active',
    }))
    const firstPageServices = Array.from({ length: 25 }, (_, index) => ({
      id: `service-${index}`,
      local_service_name: `Synthetic service ${index}`,
    }))
    mockListPayers
      .mockResolvedValueOnce({ rows: firstPagePayers, rowCount: 26 })
      .mockResolvedValueOnce({ rows: [{ id: 'payer-25', payer_name: 'Synthetic payer 25', payer_type: 'Medicaid', status: 'Active' }], rowCount: 26 })
    mockListOrgServices
      .mockResolvedValueOnce({ rows: firstPageServices, rowCount: 26 })
      .mockResolvedValueOnce({ rows: [{ id: 'service-25', local_service_name: 'Synthetic service 25' }], rowCount: 26 })

    const result = await listAuthorizationFormOptionsAction(ORG_ID)

    expect(result.success && result.data?.payers).toHaveLength(26)
    expect(result.success && result.data?.organizationServices).toHaveLength(26)
    expect(mockListPayers).toHaveBeenNthCalledWith(1, ORG_ID, { page: 0, pageSize: 25, includeInactive: true })
    expect(mockListPayers).toHaveBeenNthCalledWith(2, ORG_ID, { page: 1, pageSize: 25, includeInactive: true })
    expect(mockListOrgServices).toHaveBeenNthCalledWith(2, ORG_ID, {
      page: 1,
      pageSize: 25,
      includeDisabled: true,
    })
  })

  it('maps updates and archive operations to the management permission', async () => {
    mockUpdateAuthorization.mockResolvedValue({ id: AUTHORIZATION_ID })
    mockArchiveAuthorization.mockResolvedValue(undefined)

    await updateAuthorizationAction({
      organizationId: ORG_ID,
      patientId: PATIENT_ID,
      authorizationId: AUTHORIZATION_ID,
      status: 'Suspended',
    })
    await archiveAuthorizationAction({
      organizationId: ORG_ID,
      patientId: PATIENT_ID,
      authorizationId: AUTHORIZATION_ID,
    })

    expect(mockRequirePermission).toHaveBeenCalledTimes(2)
    expect(mockRequirePermission).toHaveBeenNthCalledWith(1, ORG_ID, 'authorizations.manage')
    expect(mockRequirePermission).toHaveBeenNthCalledWith(2, ORG_ID, 'authorizations.manage')
    expect(mockUpdateAuthorization).toHaveBeenCalledWith(ORG_ID, USER_ID, {
      authorizationId: AUTHORIZATION_ID,
      payer_id: undefined,
      authorization_start_date: undefined,
      authorization_end_date: undefined,
      status: 'Suspended',
    })
    expect(mockArchiveAuthorization).toHaveBeenCalledWith(ORG_ID, USER_ID, { authorizationId: AUTHORIZATION_ID })
  })

  it('uses management permission for service-line writes and revalidates the detail route', async () => {
    mockUpsertAuthorizationService.mockResolvedValue({ id: AUTHORIZATION_SERVICE_ID })
    mockDeactivateAuthorizationService.mockResolvedValue(undefined)

    await upsertAuthorizationServiceAction(serviceInput)
    await deactivateAuthorizationServiceAction({
      organizationId: ORG_ID,
      patientId: PATIENT_ID,
      authorizationId: AUTHORIZATION_ID,
      authorizationServiceId: AUTHORIZATION_SERVICE_ID,
    })

    expect(mockRequirePermission).toHaveBeenCalledTimes(2)
    expect(mockRequirePermission).toHaveBeenNthCalledWith(1, ORG_ID, 'authorizations.manage')
    expect(mockRequirePermission).toHaveBeenNthCalledWith(2, ORG_ID, 'authorizations.manage')
    expect(mockUpsertAuthorizationService).toHaveBeenCalledWith(ORG_ID, expect.objectContaining({
      authorizationId: AUTHORIZATION_ID,
      organization_service_id: SERVICE_ID,
      authorized_quantity: 10,
    }))
    expect(mockDeactivateAuthorizationService).toHaveBeenCalledWith(ORG_ID, {
      authorizationId: AUTHORIZATION_ID,
      authorizationServiceId: AUTHORIZATION_SERVICE_ID,
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/patients/${PATIENT_ID}/authorization/${AUTHORIZATION_ID}`)
  })
})
