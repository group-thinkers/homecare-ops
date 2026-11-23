import { redirect } from 'next/navigation'
import Alert from '@mui/material/Alert'
import { getActiveMembership, requireAuth } from '@/lib/auth/server'
import { hasAnyPermission, hasPermission } from '@/lib/permissions'
import { parsePaginationSearchParams } from '@/lib/pagination'
import { getOrgServiceAction, listOrganizationServiceRatesAction } from '../actions'
import ServiceDetail from '../_components/ServiceDetail'

export default async function ServiceDetailPage({ params, searchParams }: {
  params: Promise<{ serviceId: string }>
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[] }>
}) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')
  const orgId = membership.organization_id
  const { serviceId } = await params
  const pagination = parsePaginationSearchParams(await searchParams)
  const [result, canManage, canReadRates] = await Promise.all([
    getOrgServiceAction(orgId, serviceId),
    hasPermission(orgId, 'authorizations.manage'),
    hasAnyPermission(orgId, ['authorizations.manage', 'authorizations.read_rates']),
  ])
  if (!result.success) return <Alert severity="error">{result.error ?? 'Unable to load service.'}</Alert>
  if (!result.data) return <Alert severity="info">Service not found.</Alert>
  const rates = canReadRates ? await listOrganizationServiceRatesAction(orgId, serviceId, pagination) : null
  return (
    <ServiceDetail
      orgId={orgId}
      service={result.data}
      canManage={canManage}
      canReadRates={canReadRates}
      initialRates={rates?.data ?? null}
      rateError={rates && !rates.success ? rates.error ?? 'Unable to load rates.' : undefined}
      initialPaginationModel={pagination}
      today={new Date().toISOString().slice(0, 10)}
    />
  )
}
