import { redirect } from 'next/navigation'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import { getPayerAction } from '../../actions'
import PayerEditor from '../../_components/PayerEditor'

interface EditPayerPageProps {
  params: Promise<{ payerId: string }>
}

export default async function EditPayerPage({ params }: EditPayerPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const allowed = await hasPermission(membership.organization_id, 'authorizations.manage')
  if (!allowed) return <UnauthorizedMessage />

  const { payerId } = await params
  const result = await getPayerAction(membership.organization_id, payerId)
  if (!result.success) {
    return <Typography sx={{ p: 3 }}>{result.error ?? 'Unable to load payer.'}</Typography>
  }
  if (!result.data) {
    return <Typography sx={{ p: 3 }}>Payer not found.</Typography>
  }

  return <PayerEditor key={result.data.id} orgId={membership.organization_id} payer={result.data} />
}
