import { redirect } from 'next/navigation'
import Alert from '@mui/material/Alert'
import { getActiveMembership, requireAuth } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { parsePaginationSearchParams } from '@/lib/pagination'
import { listOrgServicesAction } from './actions'
import ServiceList from './_components/ServiceList'

export default async function ServicesPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[] }>
}) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')
  const orgId = membership.organization_id
  const pagination = parsePaginationSearchParams(await searchParams)
  const [canManage, result] = await Promise.all([
    hasPermission(orgId, 'authorizations.manage'),
    listOrgServicesAction(orgId, pagination),
  ])
  if (!result.success || !result.data) return <Alert severity="error">{result.error ?? 'Unable to load services.'}</Alert>
  return <ServiceList orgId={orgId} canManage={canManage} initialPage={result.data} initialPaginationModel={pagination} />
}
