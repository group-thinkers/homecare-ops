import { createClient } from '@/lib/db/client'
import { AuthError } from '@/lib/auth/server'
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

// Shorthand to check if the current user is an org admin (has the users.manage permission)
export async function isOrgAdmin(orgId: string): Promise<boolean> {
  return hasPermission(orgId, 'users.manage')
}
