'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { OrganizationServiceWithMapping } from '@/types'
import { activateOrgServiceAction, updateOrgServiceAction } from '../actions'

export default function ServiceEditor({ orgId, service, mappings }: {
  orgId: string
  service?: OrganizationServiceWithMapping
  mappings: OrganizationServiceWithMapping['service_code_mapping'][]
}) {
  const router = useRouter()
  const [mappingId, setMappingId] = React.useState('')
  const [name, setName] = React.useState(service?.local_service_name ?? '')
  const [clinical, setClinical] = React.useState(service?.requires_clinical_approval ?? false)
  const [enabled, setEnabled] = React.useState(service?.enabled ?? true)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const common = { organizationId: orgId, local_service_name: name.trim() || null, requires_clinical_approval: clinical }
      const result = service
        ? await updateOrgServiceAction({ ...common, organizationServiceId: service.id, enabled })
        : await activateOrgServiceAction({ ...common, service_code_mapping_id: mappingId })
      if (!result.success || !result.data) {
        setError(result.error ?? (Object.values(result.fieldErrors ?? {}).flat().join(' ') || 'Unable to save service.'))
        return
      }
      router.push(`/settings/services/${result.data.id}`)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <PageContainer title={service ? 'Edit service' : 'Activate service'}
      breadcrumbs={[{ title: 'Home', path: '/dashboard' }, { title: 'Services', path: '/settings/services' }, { title: service ? 'Edit service' : 'Activate service' }]}>
      <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', mt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {!service && (
          <TextField select required label="Service mapping" value={mappingId} onChange={(event) => setMappingId(event.target.value)} disabled={pending || !mappings.length}
            helperText={!mappings.length ? 'No active service mappings are available.' : undefined}>
            {mappings.map((mapping) => <MenuItem key={mapping.id} value={mapping.id}>
              {mapping.evv_service_name} — {mapping.billing_service.billing_code} — {mapping.payer_type}{mapping.program_name ? ` / ${mapping.program_name}` : ''}
            </MenuItem>)}
          </TextField>
        )}
        {service && <TextField label="Service mapping" value={`${service.service_code_mapping.evv_service_name} — ${service.service_code_mapping.billing_service.billing_code}`} disabled />}
        <TextField label="Local service name" value={name} onChange={(event) => setName(event.target.value)} disabled={pending} />
        <FormControlLabel control={<Checkbox checked={clinical} onChange={(event) => setClinical(event.target.checked)} disabled={pending} />} label="Requires clinical approval" />
        {service && <FormControlLabel control={<Checkbox checked={enabled} onChange={(event) => setEnabled(event.target.checked)} disabled={pending} />} label="Enabled" />}
        <Stack direction="row" spacing={1}>
          <Button type="button" onClick={() => router.push(service ? `/settings/services/${service.id}` : '/settings/services')} disabled={pending}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={pending || (!service && !mappingId)}>{pending ? 'Saving...' : service ? 'Save changes' : 'Activate service'}</Button>
        </Stack>
      </Box>
    </PageContainer>
  )
}
