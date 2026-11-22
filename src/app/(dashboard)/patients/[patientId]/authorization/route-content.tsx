import Typography from '@mui/material/Typography'
import { redirect } from 'next/navigation'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasAnyPermission, hasPermission } from '@/lib/permissions'
import { getAuthorizationAction, listAuthorizationFormOptionsAction, listPatientAuthorizationsAction } from '../../actions'
import AuthorizationList from '../../_components/AuthorizationList'
import AuthorizationDetail from '../../_components/AuthorizationDetail'
import AuthorizationForm from '../../_components/AuthorizationForm'

type Props = {
  patientId: string
  authorizationId?: string
  serviceId?: string
  page?: number
  mode: 'list' | 'new' | 'detail' | 'edit' | 'service-new' | 'service-edit'
}

export async function renderAuthorizationPage({ patientId, authorizationId, serviceId, page = 0, mode }: Props) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')
  const orgId = membership.organization_id
  const [canManage, canRead] = await Promise.all([
    hasPermission(orgId, 'authorizations.manage'),
    hasAnyPermission(orgId, ['authorizations.manage', 'shifts.manage']),
  ])
  const mutation = mode !== 'list' && mode !== 'detail'
  if (!canRead || (mutation && !canManage)) return <UnauthorizedMessage />

  if (mode === 'list') {
    const result = await listPatientAuthorizationsAction(orgId, patientId, { page, pageSize: 10 })
    if (!result.success || !result.data) return <Typography sx={{ p: 3 }}>{result.error || 'Unable to load authorizations.'}</Typography>
    return <AuthorizationList patientId={patientId} data={result.data} page={page} canManage={canManage} />
  }

  let authorization
  if (mode !== 'new') {
    if (!authorizationId) return <Typography sx={{ p: 3 }}>Authorization not found.</Typography>
    const result = await getAuthorizationAction(
      orgId,
      patientId,
      authorizationId,
      undefined,
      0,
      mode === 'service-edit' ? serviceId ?? null : null,
    )
    if (!result.success) return <Typography sx={{ p: 3 }}>{result.error || 'Unable to load authorization.'}</Typography>
    if (!result.data) return <Typography sx={{ p: 3 }}>Authorization not found.</Typography>
    authorization = result.data
  }
  if (mode === 'detail' && authorization) {
    return <AuthorizationDetail orgId={orgId} patientId={patientId} authorization={authorization} canManage={canManage} />
  }
  if (authorization?.archived_at) return <Typography sx={{ p: 3 }}>Archived authorizations cannot be edited.</Typography>
  let service = mode === 'service-edit' ? authorization?.services.find((item) => item.id === serviceId && item.active) : undefined
  if (mode === 'service-edit' && !service) return <Typography sx={{ p: 3 }}>Service line not found.</Typography>
  if (mode === 'service-edit' && service && authorizationId) {
    // The current-date effective rate may hide a future or past line's override.
    const dated = await getAuthorizationAction(
      orgId,
      patientId,
      authorizationId,
      service.effective_start_date,
      0,
      serviceId ?? null,
    )
    if (!dated.success || !dated.data) return <Typography sx={{ p: 3 }}>{dated.error || 'Unable to load service rate.'}</Typography>
    service = dated.data.services.find((item) => item.id === serviceId && item.active)
    if (!service) return <Typography sx={{ p: 3 }}>Service line not found.</Typography>
  }
  const options = await listAuthorizationFormOptionsAction(orgId)
  if (!options.success || !options.data) return <Typography sx={{ p: 3 }}>{options.error || 'Unable to load form options.'}</Typography>
  return <AuthorizationForm orgId={orgId} patientId={patientId} authorization={authorization} service={service}
    serviceForm={mode === 'service-new' || mode === 'service-edit'} options={options.data} />
}
