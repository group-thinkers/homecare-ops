import { redirect } from 'next/navigation'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { requireAuth, getActiveMembership } from '@/lib/auth/server'
import { hasPermission } from '@/lib/permissions'
import { getCaregiver } from '@/lib/services/caregivers.service'
import { listOrgServices } from '@/lib/services/authorizations.service'
import { fetchAllPages } from '@/lib/pagination'
import UnauthorizedMessage from '@/components/UnauthorizedMessage'
import CompensationForm from '../../../_components/CompensationForm'

interface CompensationNewPageProps {
  params: Promise<{
    caregiverId: string
  }>
}

export default async function CompensationNewPage({ params }: CompensationNewPageProps) {
  await requireAuth()
  const membership = await getActiveMembership()
  if (!membership) redirect('/login')

  const orgId = membership.organization_id
  const [canManage, canReadCompensation] = await Promise.all([
    hasPermission(orgId, 'caregivers.manage'),
    hasPermission(orgId, 'caregivers.read_compensation'),
  ])

  if (!canManage || !canReadCompensation) {
    return <UnauthorizedMessage />
  }

  const resolvedParams = await params
  const formData = await Promise.all([
    getCaregiver(orgId, resolvedParams.caregiverId),
    fetchAllPages((page, pageSize) => listOrgServices(orgId, { page, pageSize })),
  ]).catch((error: unknown) => {
    console.error('[CompensationNewPage] failed to load form data:', {
      orgId,
      caregiverId: resolvedParams.caregiverId,
      error,
    })
    return null
  })
  if (!formData) return <Alert severity="error">Unable to load compensation form.</Alert>
  const [caregiver, organizationServices] = formData

  if (!caregiver) {
    return <Typography sx={{ p: 3 }}>Caregiver not found.</Typography>
  }

  return <CompensationForm caregiver={caregiver} orgId={orgId} organizationServices={organizationServices} />
}
