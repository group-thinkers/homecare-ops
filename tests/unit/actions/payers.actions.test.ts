import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/server', () => ({
  AuthError: class AuthError extends Error {},
  requireAuth: vi.fn(),
}))
vi.mock('@/lib/permissions', () => ({
  requireOrganizationMembership: vi.fn(),
  requirePermission: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/services/authorizations.service', () => ({
  listPayers: vi.fn(),
  getPayer: vi.fn(),
  upsertPayer: vi.fn(),
}))

import { revalidatePath } from 'next/cache'
import {
  getPayerAction,
  listPayersAction,
  upsertPayerAction,
} from '@/app/(dashboard)/settings/payers/actions'
import { AuthError, requireAuth } from '@/lib/auth/server'
import { requireOrganizationMembership, requirePermission } from '@/lib/permissions'
import * as service from '@/lib/services/authorizations.service'
import type { ActionResponse, Payer } from '@/types'

const mockRequireAuth = requireAuth as ReturnType<typeof vi.fn>
const mockRequireMembership = requireOrganizationMembership as ReturnType<typeof vi.fn>
const mockRequirePermission = requirePermission as ReturnType<typeof vi.fn>
const mockRevalidatePath = revalidatePath as ReturnType<typeof vi.fn>
const mockListPayers = service.listPayers as ReturnType<typeof vi.fn>
const mockGetPayer = service.getPayer as ReturnType<typeof vi.fn>
const mockUpsertPayer = service.upsertPayer as ReturnType<typeof vi.fn>

const ORG_ID = '00000000-0000-0000-0000-000000000001'
const PAYER_ID = '00000000-0000-0000-0000-000000000002'

const payer: Payer = {
  id: PAYER_ID,
  organization_id: ORG_ID,
  payer_name: 'Synthetic Plan',
  payer_type: 'Medicaid',
  program_name: 'Test Program',
  status: 'Active',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: null,
}

const validInput = {
  organizationId: ORG_ID,
  payerId: PAYER_ID,
  payer_name: 'Synthetic Plan',
  payer_type: 'Medicaid',
  program_name: 'Test Program',
  status: 'Active',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000003' })
  mockRequireMembership.mockResolvedValue(undefined)
  mockRequirePermission.mockResolvedValue(undefined)
})

const readCases: Array<{
  name: string
  run: () => Promise<ActionResponse<unknown>>
  serviceMock: ReturnType<typeof vi.fn>
}> = [
  {
    name: 'listPayersAction',
    run: () => listPayersAction(ORG_ID, { page: 1, pageSize: 5 }),
    serviceMock: mockListPayers,
  },
  {
    name: 'getPayerAction',
    run: () => getPayerAction(ORG_ID, PAYER_ID),
    serviceMock: mockGetPayer,
  },
]

describe.each(readCases)('$name', ({ run, serviceMock }) => {
  it('allows an active organization member to read payer data', async () => {
    const data = { rows: [payer], rowCount: 1 }
    serviceMock.mockResolvedValue(data)

    await expect(run()).resolves.toEqual({ success: true, data })
    expect(mockRequireAuth).toHaveBeenCalledOnce()
    expect(mockRequireMembership).toHaveBeenCalledWith(ORG_ID)
    expect(mockRequirePermission).not.toHaveBeenCalled()
    expect(serviceMock).toHaveBeenCalledOnce()
  })

  it('rejects unauthenticated callers', async () => {
    mockRequireAuth.mockRejectedValue(new AuthError('Unauthenticated'))
    await expect(run()).resolves.toEqual({ success: false, error: 'Not authorized.' })
    expect(mockRequireMembership).not.toHaveBeenCalled()
    expect(serviceMock).not.toHaveBeenCalled()
  })

  it('rejects callers without active organization membership', async () => {
    mockRequireMembership.mockRejectedValue(new AuthError('Forbidden'))
    await expect(run()).resolves.toEqual({ success: false, error: 'Not authorized.' })
    expect(serviceMock).not.toHaveBeenCalled()
  })

  it('does not expose service failures', async () => {
    serviceMock.mockRejectedValue(new Error('service failed'))
    const expectedError = serviceMock === mockListPayers ? 'Unable to load payers.' : 'Unable to load payer.'
    await expect(run()).resolves.toEqual({ success: false, error: expectedError })
  })
})

describe('upsertPayerAction', () => {
  it('validates, requires manage permission, writes, and revalidates the payer routes', async () => {
    mockUpsertPayer.mockResolvedValue(payer)

    await expect(upsertPayerAction(validInput)).resolves.toEqual({ success: true, data: payer })
    expect(mockRequireAuth).toHaveBeenCalledOnce()
    expect(mockRequirePermission).toHaveBeenCalledWith(ORG_ID, 'authorizations.manage')
    expect(mockUpsertPayer).toHaveBeenCalledWith(ORG_ID, {
      payerId: PAYER_ID,
      payer_name: 'Synthetic Plan',
      payer_type: 'Medicaid',
      program_name: 'Test Program',
      status: 'Active',
    })
    expect(mockRevalidatePath).toHaveBeenNthCalledWith(1, '/settings/payers')
    expect(mockRevalidatePath).toHaveBeenNthCalledWith(2, `/settings/payers/${PAYER_ID}/edit`)
  })

  it('returns strict schema field errors and does not check permission or write', async () => {
    const result = await upsertPayerAction({
      ...validInput,
      payer_name: '',
      unexpected: 'not accepted',
    })

    expect(result.success).toBe(false)
    expect(result.fieldErrors?.payer_name).toBeDefined()
    expect(result.fieldErrors?._form).toBeDefined()
    expect(mockRequireAuth).toHaveBeenCalledOnce()
    expect(mockRequirePermission).not.toHaveBeenCalled()
    expect(mockUpsertPayer).not.toHaveBeenCalled()
  })

  it('returns unauthenticated errors before validating the payload', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthenticated'))
    await expect(upsertPayerAction(validInput)).resolves.toEqual({
      success: false,
      error: 'Unauthenticated',
    })
    expect(mockRequirePermission).not.toHaveBeenCalled()
    expect(mockUpsertPayer).not.toHaveBeenCalled()
  })

  it('returns forbidden errors without calling the service', async () => {
    mockRequirePermission.mockRejectedValue(new AuthError('Forbidden'))
    await expect(upsertPayerAction(validInput)).resolves.toEqual({
      success: false,
      error: 'Not authorized.',
    })
    expect(mockUpsertPayer).not.toHaveBeenCalled()
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('returns service errors and does not revalidate', async () => {
    mockUpsertPayer.mockRejectedValue(new Error('service failed'))
    await expect(upsertPayerAction(validInput)).resolves.toEqual({
      success: false,
      error: 'service failed',
    })
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})
