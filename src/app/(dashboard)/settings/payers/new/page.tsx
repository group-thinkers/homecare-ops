import { redirect } from 'next/navigation'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import PayerEditor from '../_components/PayerEditor'

export default async function NewPayerPage() {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'authorizations.manage')
  if (!allowed) return <UnauthorizedMessage />

  return <PayerEditor orgId={membership.organization_id} />
}
