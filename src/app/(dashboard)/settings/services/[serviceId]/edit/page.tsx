import { redirect } from 'next/navigation'
import Alert from '@mui/material/Alert'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import { getActiveMembership, requireAuth } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getOrgServiceAction } from '../../actions'
import ServiceEditor from '../../_components/ServiceEditor'

export default async function EditServicePage({ params }: { params: Promise<{ serviceId: string }> }) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')
  const orgId = membership.organization_id
  if (!await hasPermission(orgId, 'authorizations.manage')) return <UnauthorizedMessage />
  const { serviceId } = await params
  const result = await getOrgServiceAction(orgId, serviceId)
  if (!result.success) return <Alert severity="error">{result.error ?? 'Unable to load service.'}</Alert>
  if (!result.data) return <Alert severity="info">Service not found.</Alert>
  return <ServiceEditor orgId={orgId} service={result.data} mappings={[]} />
}
