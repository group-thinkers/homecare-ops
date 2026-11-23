import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthError, getOrgMembership } from '@/lib/auth/server'

// ─── AuthError ────────────────────────────────────────────────────────────────

describe('AuthError', () => {
  it('defaults to "Not authorized." message', () => {
    const err = new AuthError()
    expect(err.message).toBe('Not authorized.')
    expect(err.name).toBe('AuthError')
  })

  it('accepts a custom message', () => {
    const err = new AuthError('Custom message')
    expect(err.message).toBe('Custom message')
  })

  it('is an instance of Error', () => {
    expect(new AuthError()).toBeInstanceOf(Error)
  })
})

// ─── requirePermission behaviour (unit — Supabase mocked) ────────────────────

vi.mock('@/lib/db/client', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth/server')>()
  return { ...original, getOrgMembership: vi.fn() }
})

import { createClient } from '@/lib/db/client'
import {
  hasAnyPermission,
  hasPermission,
  isOrgAdmin,
  requireAnyPermission,
  requireOrganizationMembership,
  requirePermission,
} from '@/lib/permissions'

function mockRpc(returnValue: boolean) {
  const rpc = vi.fn().mockResolvedValue({ data: returnValue, error: null })
  ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({ rpc })
  return rpc
}

describe('hasPermission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when RPC returns true', async () => {
    mockRpc(true)
    expect(await hasPermission('org-1', 'shifts.manage')).toBe(true)
  })

  it('returns false when RPC returns false', async () => {
    mockRpc(false)
    expect(await hasPermission('org-1', 'shifts.manage')).toBe(false)
  })

  it('returns false when RPC errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('db error') })
    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({ rpc })
    expect(await hasPermission('org-1', 'shifts.manage')).toBe(false)
  })
})

describe('requirePermission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves when permission is granted', async () => {
    mockRpc(true)
    await expect(requirePermission('org-1', 'shifts.manage')).resolves.toBeUndefined()
  })

  it('throws AuthError when permission is denied', async () => {
    mockRpc(false)
    await expect(requirePermission('org-1', 'shifts.manage')).rejects.toBeInstanceOf(AuthError)
  })
})

describe('isOrgAdmin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates to has_org_permission with users.manage', async () => {
    const rpc = mockRpc(true)
    await isOrgAdmin('org-1')
    expect(rpc).toHaveBeenCalledWith('has_org_permission', {
      org_id: 'org-1',
      perm_code: 'users.manage',
    })
  })

  describe('permission boundaries', () => {
    beforeEach(() => vi.clearAllMocks())

    it('allows when any requested permission is granted', async () => {
      const rpc = vi.fn()
        .mockResolvedValueOnce({ data: false, error: null })
        .mockResolvedValue({ data: true, error: null })
      ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({ rpc })

      await expect(hasAnyPermission('org-1', ['authorizations.manage', 'shifts.manage'])).resolves.toBe(true)
      await expect(requireAnyPermission('org-1', ['authorizations.manage', 'shifts.manage'])).resolves.toBeUndefined()
    })

    it('rejects when none of the requested permissions is granted', async () => {
      mockRpc(false)
      await expect(requireAnyPermission('org-1', ['authorizations.manage', 'shifts.manage']))
        .rejects.toBeInstanceOf(AuthError)
    })

    it('requires an active membership in the requested organization', async () => {
      const membership = getOrgMembership as ReturnType<typeof vi.fn>
      membership
        .mockResolvedValueOnce({ organization_id: 'org-1' })
        .mockResolvedValueOnce(null)
      await expect(requireOrganizationMembership('org-1')).resolves.toBeUndefined()
      await expect(requireOrganizationMembership('org-2')).rejects.toBeInstanceOf(AuthError)
    })
  })

  it('returns false when user is not admin', async () => {
    mockRpc(false)
    expect(await isOrgAdmin('org-1')).toBe(false)
  })
})
