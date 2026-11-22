import { redirect } from 'next/navigation'
import Alert from '@mui/material/Alert'
import type { GridPaginationModel } from '@mui/x-data-grid'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { parsePaginationSearchParams } from '@/lib/pagination'
import { listPayersAction } from './actions'
import PayerList from './_components/PayerList'

interface PayersPageProps {
  searchParams: Promise<{
    page?: string | string[]
    pageSize?: string | string[]
  }>
}

export default async function PayersPage({ searchParams }: PayersPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const canManage = await hasPermission(membership.organization_id, 'authorizations.manage')
  const initialPaginationModel = parsePaginationSearchParams(await searchParams) as GridPaginationModel
  const result = await listPayersAction(membership.organization_id, initialPaginationModel)
  if (!result.success || !result.data) {
    return <Alert severity="error">{result.error ?? 'Unable to load payers.'}</Alert>
  }

  return (
    <PayerList
      orgId={membership.organization_id}
      canManage={canManage}
      initialPage={result.data}
      initialPaginationModel={initialPaginationModel}
    />
  )
}
