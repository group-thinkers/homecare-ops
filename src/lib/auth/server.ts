import { createClient } from '@/lib/db/client'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { OrganizationMembership, UserProfile } from '@/types'

// Custom error class for auth failures
export class AuthError extends Error {
  constructor(message = 'Not authorized.') {
    super(message)
    this.name = 'AuthError'
  }
}

// Returns the current user from Supabase, or null if not logged in
export const getSession = cache(async () => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
})

// Like getSession(), but redirects to /login instead of returning null — use in server components that require auth
export async function requireAuth() {
  const user = await getSession()
  if (!user) redirect('/login')
  return user
}

// Returns the current user's active membership for a given org, or null if they don't belong to it
export const getOrgMembership = cache(async (orgId: string): Promise<OrganizationMembership | null> => {
  const user = await getSession()
  if (!user) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('*')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .eq('status', 'Active')
    .single()

  if (error || !data) return null
  return data as OrganizationMembership
})

// Returns the current user's first active org membership, or null if none exists
export const getActiveMembership = cache(async (): Promise<OrganizationMembership | null> => {
  const user = await getSession()
  if (!user) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organization_memberships')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'Active')
    .limit(1)
    .single()

  if (error || !data) return null
  return data as OrganizationMembership
})


export const getUserProfile = cache(async (): Promise<UserProfile | null> => {
  const user = await getSession()
  if (!user) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !data) return null
  return data as UserProfile
})
