import { createClient } from '@/lib/db/client'
import { AuthError, getOrgMembership } from '@/lib/auth/server'
import { cache } from 'react'
import type { PermissionCode } from '@/types'

// Checks if the current user has a specific permission in an org — returns true/false
export const hasPermission = cache(async (orgId: string, permCode: PermissionCode): Promise<boolean> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('has_org_permission', {
    org_id: orgId,
    perm_code: permCode,
  })
  if (error) return false
  return data === true
})

// Like hasPermission(), but throws an AuthError instead of returning false — use to gate server actions
export async function requirePermission(orgId: string, permCode: PermissionCode): Promise<void> {
  const allowed = await hasPermission(orgId, permCode)
  if (!allowed) throw new AuthError()
}

export async function hasAnyPermission(orgId: string, permCodes: PermissionCode[]): Promise<boolean> {
  const permissions = await Promise.all(permCodes.map((permCode) => hasPermission(orgId, permCode)))
  return permissions.some(Boolean)
}

export async function requireAnyPermission(orgId: string, permCodes: PermissionCode[]): Promise<void> {
  if (!await hasAnyPermission(orgId, permCodes)) throw new AuthError()
}

export async function requireOrganizationMembership(orgId: string): Promise<void> {
  const membership = await getOrgMembership(orgId)
  if (!membership) throw new AuthError()
}

// Shorthand to check if the current user is an org admin (has the users.manage permission)
export async function isOrgAdmin(orgId: string): Promise<boolean> {
  return hasPermission(orgId, 'users.manage')
}
