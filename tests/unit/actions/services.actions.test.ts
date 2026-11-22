import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/server', () => ({
  AuthError: class AuthError extends Error {},
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/permissions', () => ({
  requireOrganizationMembership: vi.fn(),
  requirePermission: vi.fn(),
  requireAnyPermission: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/services/authorizations.service', () => ({
  listOrgServices: vi.fn(), getOrgService: vi.fn(), listAvailableServiceCodeMappings: vi.fn(),
  activateOrgService: vi.fn(), updateOrgService: vi.fn(),
  listOrganizationServiceRates: vi.fn(), setOrganizationServiceRate: vi.fn(),
}))

import { revalidatePath } from 'next/cache'
import { AuthError, requireAuth } from '@/lib/auth/server'
import { requireAnyPermission, requireOrganizationMembership, requirePermission } from '@/lib/permissions'
import * as service from '@/lib/services/authorizations.service'
import {
  activateOrgServiceAction, getOrgServiceAction, listAvailableServiceCodeMappingsAction,
  listOrganizationServiceRatesAction, listOrgServicesAction, setOrganizationServiceRateAction,
  updateOrgServiceAction,
} from '@/app/(dashboard)/settings/services/actions'

const orgId = '00000000-0000-0000-0000-000000000001'
const serviceId = '00000000-0000-0000-0000-000000000002'
const mappingId = '00000000-0000-0000-0000-000000000003'
const userId = '00000000-0000-0000-0000-000000000004'
const activate = { organizationId: orgId, service_code_mapping_id: mappingId, local_service_name: null, requires_clinical_approval: false }
const update = { organizationId: orgId, organizationServiceId: serviceId, enabled: false }
const rate = { organizationId: orgId, organizationServiceId: serviceId, reimbursement_rate: 12.5, rate_unit: 'Hour', effective_start_date: '2099-01-01', change_reason: 'Annual update' }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({ id: userId } as Awaited<ReturnType<typeof requireAuth>>)
  vi.mocked(requireOrganizationMembership).mockResolvedValue(undefined)
  vi.mocked(requirePermission).mockResolvedValue(undefined)
  vi.mocked(requireAnyPermission).mockResolvedValue(undefined)
})

describe.each([
  { name: 'list', run: () => listOrgServicesAction(orgId, { page: 1, pageSize: 10 }), fn: service.listOrgServices },
  { name: 'detail', run: () => getOrgServiceAction(orgId, serviceId), fn: service.getOrgService },
  { name: 'mappings', run: () => listAvailableServiceCodeMappingsAction(orgId), fn: service.listAvailableServiceCodeMappings },
])('$name reads', ({ run, fn }) => {
  it('authenticates and requires tenant membership before reading', async () => {
    vi.mocked(fn).mockResolvedValueOnce(null as never)
    expect(await run()).toEqual({ success: true, data: null })
    expect(requireOrganizationMembership).toHaveBeenCalledWith(orgId)
    expect(vi.mocked(requireAuth).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(requireOrganizationMembership).mock.invocationCallOrder[0])
    expect(vi.mocked(requireOrganizationMembership).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(fn).mock.invocationCallOrder[0])
  })
  it('denies non-members and unauthenticated callers', async () => {
    vi.mocked(requireOrganizationMembership).mockRejectedValueOnce(new AuthError('forbidden'))
    expect(await run()).toEqual({ success: false, error: 'Not authorized.' })
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError('unauthenticated'))
    expect(await run()).toEqual({ success: false, error: 'Not authorized.' })
    expect(fn).not.toHaveBeenCalled()
  })
})

it('passes pagination and includes disabled services', async () => {
  await listOrgServicesAction(orgId, { page: 1, pageSize: 10 })
  expect(service.listOrgServices).toHaveBeenCalledWith(orgId, { page: 1, pageSize: 10, includeDisabled: true })
})

describe('rate history', () => {
  it('requires either rate-read or manage permission and passes pagination', async () => {
    await listOrganizationServiceRatesAction(orgId, serviceId, { page: 2, pageSize: 5 })
    expect(requireAnyPermission).toHaveBeenCalledWith(orgId, ['authorizations.manage', 'authorizations.read_rates'])
    expect(service.listOrganizationServiceRates).toHaveBeenCalledWith(orgId, serviceId, { page: 2, pageSize: 5 })
  })
  it('does not read for unauthorized users', async () => {
    vi.mocked(requireAnyPermission).mockRejectedValue(new AuthError('forbidden'))
    expect(await listOrganizationServiceRatesAction(orgId, serviceId)).toEqual({ success: false, error: 'Not authorized.' })
    expect(service.listOrganizationServiceRates).not.toHaveBeenCalled()
  })
})

describe.each([
  { name: 'activate', run: activateOrgServiceAction, input: activate, fn: service.activateOrgService },
  { name: 'update', run: updateOrgServiceAction, input: update, fn: service.updateOrgService },
  { name: 'set rate', run: setOrganizationServiceRateAction, input: rate, fn: service.setOrganizationServiceRate },
])('$name mutation', ({ run, input, fn }) => {
  it('rejects unknown fields before permission or service calls', async () => {
    const result = await run({ ...input, unexpected: true })
    expect(result.success).toBe(false)
    expect(result.fieldErrors?._form).toBeDefined()
    expect(requirePermission).not.toHaveBeenCalled()
    expect(fn).not.toHaveBeenCalled()
  })
  it('rejects unauthorized and unauthenticated callers', async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new Error('forbidden'))
    expect(await run(input)).toEqual({ success: false, error: 'Not authorized.' })
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('unauthenticated'))
    expect(await run(input)).toEqual({ success: false, error: 'Not authorized.' })
    expect(fn).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it('checks manage permission before writing and revalidates on success', async () => {
    vi.mocked(fn).mockResolvedValueOnce({ id: serviceId } as never)
    expect((await run(input)).success).toBe(true)
    expect(requirePermission).toHaveBeenCalledWith(orgId, 'authorizations.manage')
    expect(vi.mocked(requireAuth).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(requirePermission).mock.invocationCallOrder[0])
    expect(vi.mocked(requirePermission).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(fn).mock.invocationCallOrder[0])
    expect(revalidatePath).toHaveBeenCalled()
  })
  it('does not revalidate on a failed write', async () => {
    vi.mocked(fn).mockRejectedValueOnce(new Error('failure'))
    expect((await run(input)).success).toBe(false)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

it('forwards scoped inputs and the authenticated actor', async () => {
  await activateOrgServiceAction(activate)
  expect(service.activateOrgService).toHaveBeenCalledWith(orgId, userId, {
    service_code_mapping_id: mappingId, local_service_name: null, requires_clinical_approval: false,
  })
  await updateOrgServiceAction(update)
  expect(service.updateOrgService).toHaveBeenCalledWith(orgId, userId, { organizationServiceId: serviceId, enabled: false })
  await setOrganizationServiceRateAction(rate)
  expect(service.setOrganizationServiceRate).toHaveBeenCalledWith(orgId, serviceId, {
    reimbursement_rate: 12.5, rate_unit: 'Hour', effective_start_date: '2099-01-01', change_reason: 'Annual update',
  })
  expect(revalidatePath).toHaveBeenCalledWith(`/settings/services/${serviceId}`)
})

it('preserves the duplicate-activation error without exposing other service errors', async () => {
  vi.mocked(service.activateOrgService).mockRejectedValueOnce(new Error('Service already activated'))
  expect(await activateOrgServiceAction(activate)).toEqual({ success: false, error: 'Service already activated' })
  vi.mocked(service.setOrganizationServiceRate).mockRejectedValueOnce(new Error('sensitive database detail'))
  expect((await setOrganizationServiceRateAction(rate)).error).not.toContain('sensitive')
})
