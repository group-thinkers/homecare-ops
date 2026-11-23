'use client'

import * as React from 'react'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import { useDialogs } from '@/components/templates/crud-dashboard/hooks/useDialogs/useDialogs'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import type { PatientAuthorizationDetail } from '@/types'
import {
  archiveAuthorizationAction,
  deactivateAuthorizationServiceAction,
  getAuthorizationAction,
} from '../actions'

export default function AuthorizationDetail({ orgId, patientId, authorization, canManage }: {
  orgId: string; patientId: string; authorization: PatientAuthorizationDetail; canManage: boolean
}) {
  const router = useRouter()
  const dialogs = useDialogs()
  const notifications = useNotifications()
  const [busy, setBusy] = React.useState(false)
  const [services, setServices] = React.useState(authorization.services)
  const [serviceCount, setServiceCount] = React.useState(authorization.service_count)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [serviceError, setServiceError] = React.useState<string | null>(null)
  const base = `/patients/${patientId}/authorization`
  const detail = `${base}/${authorization.id}`

  async function loadMoreServices() {
    setLoadingMore(true)
    setServiceError(null)
    try {
      const result = await getAuthorizationAction(
        orgId,
        patientId,
        authorization.id,
        undefined,
        services.length,
      )
      if (!result.success || !result.data) {
        setServiceError(result.error ?? 'Unable to load more service lines.')
        return
      }
      const nextServices = result.data.services
      setServices((previous) => [...previous, ...nextServices])
    } catch {
      setServiceError('Unable to load more service lines.')
    } finally {
      setLoadingMore(false)
    }
  }

  async function mutate(serviceId?: string) {
    const confirmed = await dialogs.confirm(
      serviceId ? 'Deactivate this service line?' : 'Archive this authorization?',
      { title: serviceId ? 'Deactivate service?' : 'Archive authorization?', severity: 'warning', okText: serviceId ? 'Deactivate' : 'Archive' },
    )
    if (!confirmed) return
    setBusy(true)
    try {
      const input = { organizationId: orgId, patientId, authorizationId: authorization.id }
      const result = serviceId
        ? await deactivateAuthorizationServiceAction({ ...input, authorizationServiceId: serviceId })
        : await archiveAuthorizationAction(input)
      if (!result.success) {
        notifications.show(result.error ?? 'Unable to complete the action.', { severity: 'error' })
        return
      }
      notifications.show(serviceId ? 'Service deactivated.' : 'Authorization archived.', { severity: 'success' })
      if (serviceId) {
        setServices((previous) => previous.filter((service) => service.id !== serviceId))
        setServiceCount((previous) => Math.max(0, previous - 1))
      } else {
        router.push(base)
      }
      router.refresh()
    } finally { setBusy(false) }
  }

  return (
    <PageContainer title="Authorization" breadcrumbs={[
      { title: 'Patients', path: '/patients' }, { title: 'Patient', path: `/patients/${patientId}` },
      { title: 'Authorizations', path: base }, { title: 'Detail' },
    ]} actions={canManage && !authorization.archived_at ? <Stack direction="row" spacing={1}>
      <Button onClick={() => router.push(`${detail}/edit`)} disabled={busy}>Edit</Button>
      <Button color="error" onClick={() => mutate()} disabled={busy}>Archive</Button>
    </Stack> : undefined}>
      <Stack spacing={2}>
        <Typography>Payer: {authorization.payer.payer_name}</Typography>
        <Typography>Authorization number: {authorization.masked_prior_auth_number ?? '—'}</Typography>
        <Typography>Status: {authorization.effective_status}</Typography>
        <Typography>Dates: {authorization.authorization_start_date} – {authorization.authorization_end_date}</Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography variant="h6">Service lines</Typography>
          {canManage && !authorization.archived_at && <Button onClick={() => router.push(`${detail}/service/new`)}>Add service</Button>}
        </Stack>
        {serviceCount === 0 && <Typography>No service lines.</Typography>}
        {serviceError && <Typography color="error">{serviceError}</Typography>}
        {services.map((service) => (
          <Stack key={service.id} spacing={0.5} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
            <Typography>{service.organization_service?.local_service_name || 'Service'}</Typography>
            <Typography>{service.authorized_quantity} {service.quantity_unit} / {service.quantity_period}</Typography>
            <Typography>{service.effective_start_date} – {service.effective_end_date} · {service.active ? 'Active' : 'Inactive'}</Typography>
            {service.service_requirement_code && <Typography>Requirement: {service.service_requirement_code}</Typography>}
            {service.effective_rate?.rate != null && <Typography>Effective rate: {service.effective_rate.rate} / {service.effective_rate.rate_unit}</Typography>}
            {canManage && service.active && !authorization.archived_at && <Stack direction="row">
              <Button onClick={() => router.push(`${detail}/service/${service.id}/edit`)} disabled={busy}>Edit service</Button>
              <Button color="error" onClick={() => mutate(service.id)} disabled={busy}>Deactivate</Button>
            </Stack>}
          </Stack>
        ))}
        {services.length < serviceCount && (
          <Button onClick={loadMoreServices} disabled={busy || loadingMore}>
            {loadingMore ? 'Loading service lines...' : `Load more service lines (${services.length}/${serviceCount})`}
          </Button>
        )}
        <Button sx={{ alignSelf: 'start' }} onClick={() => router.push(base)}>Back</Button>
      </Stack>
    </PageContainer>
  )
}
