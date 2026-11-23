import { redirect } from 'next/navigation'
import Alert from '@mui/material/Alert'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import { getActiveMembership, requireAuth } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { listAvailableServiceCodeMappingsAction } from '../actions'
import ServiceEditor from '../_components/ServiceEditor'

export default async function NewServicePage() {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')
  const orgId = membership.organization_id
  if (!await hasPermission(orgId, 'authorizations.manage')) return <UnauthorizedMessage />
  const result = await listAvailableServiceCodeMappingsAction(orgId)
  if (!result.success || !result.data) return <Alert severity="error">{result.error ?? 'Unable to load service mappings.'}</Alert>
  return <ServiceEditor orgId={orgId} mappings={result.data} />
}
