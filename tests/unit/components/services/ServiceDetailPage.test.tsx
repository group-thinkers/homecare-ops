import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/server', () => ({ requireAuth: vi.fn(), getActiveMembership: vi.fn() }))
vi.mock('@/lib/permissions', () => ({ hasPermission: vi.fn(), hasAnyPermission: vi.fn() }))
vi.mock('@/app/(dashboard)/settings/services/actions', () => ({
  getOrgServiceAction: vi.fn(),
  listOrganizationServiceRatesAction: vi.fn(),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import ServiceDetailPage from '@/app/(dashboard)/settings/services/[serviceId]/page'
import { getActiveMembership, requireAuth } from '@/lib/auth/server'
import { hasAnyPermission, hasPermission } from '@/lib/permissions'
import { getOrgServiceAction, listOrganizationServiceRatesAction } from '@/app/(dashboard)/settings/services/actions'

const orgId = '00000000-0000-0000-0000-000000000001'
const serviceId = '00000000-0000-0000-0000-000000000002'
const props = { params: Promise.resolve({ serviceId }), searchParams: Promise.resolve({ page: '1', pageSize: '10' }) }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getActiveMembership).mockResolvedValue({ organization_id: orgId } as Awaited<ReturnType<typeof getActiveMembership>>)
  vi.mocked(getOrgServiceAction).mockResolvedValue({ success: true, data: { id: serviceId } as never })
  vi.mocked(hasPermission).mockResolvedValue(false)
  vi.mocked(hasAnyPermission).mockResolvedValue(false)
})

it('derives tenant from membership and never requests rates for ordinary readers', async () => {
  const result = await ServiceDetailPage(props)
  expect(requireAuth).toHaveBeenCalledOnce()
  expect(getOrgServiceAction).toHaveBeenCalledWith(orgId, serviceId)
  expect(hasAnyPermission).toHaveBeenCalledWith(orgId, ['authorizations.manage', 'authorizations.read_rates'])
  expect(listOrganizationServiceRatesAction).not.toHaveBeenCalled()
  expect(result.props.canReadRates).toBe(false)
  expect(result.props.initialRates).toBeNull()
})

it('loads rate history only for an authorized reader using the active organization', async () => {
  vi.mocked(hasAnyPermission).mockResolvedValue(true)
  vi.mocked(listOrganizationServiceRatesAction).mockResolvedValue({ success: true, data: { rows: [], rowCount: 0 } })
  const result = await ServiceDetailPage(props)
  expect(listOrganizationServiceRatesAction).toHaveBeenCalledWith(orgId, serviceId, { page: 0, pageSize: 10 })
  expect(result.props.canReadRates).toBe(true)
  expect(result.props.canManage).toBe(false)
})

it('does not request financial data for a missing service', async () => {
  vi.mocked(hasAnyPermission).mockResolvedValue(true)
  vi.mocked(getOrgServiceAction).mockResolvedValue({ success: true, data: null })
  await ServiceDetailPage(props)
  expect(listOrganizationServiceRatesAction).not.toHaveBeenCalled()
})
