'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import { AUTHORIZATION_STATUSES, QUANTITY_PERIODS, QUANTITY_UNITS, RATE_UNITS } from '@/types'
import type { AuthorizationServiceWithEffectiveRate, OrganizationServiceWithMapping, PatientAuthorizationDetail, Payer } from '@/types'
import { createAuthorizationAction, updateAuthorizationAction, upsertAuthorizationServiceAction } from '../actions'

type Options = {
  payers: Pick<Payer, 'id' | 'payer_name' | 'payer_type' | 'status'>[]
  organizationServices: OrganizationServiceWithMapping[]
}

type Line = {
  organization_service_id: string
  authorized_quantity: string
  quantity_unit: string
  quantity_period: string
  reimbursement_rate: string
  rate_unit: string
  service_requirement_code: string
  effective_start_date: string
  effective_end_date: string
}

const emptyLine = (): Line => ({
  organization_service_id: '', authorized_quantity: '', quantity_unit: 'Hours', quantity_period: 'Week',
  reimbursement_rate: '', rate_unit: 'Hour', service_requirement_code: '', effective_start_date: '', effective_end_date: '',
})

function linePayload(line: Line) {
  return {
    organization_service_id: line.organization_service_id,
    authorized_quantity: Number(line.authorized_quantity),
    quantity_unit: line.quantity_unit,
    quantity_period: line.quantity_period,
    reimbursement_rate: line.reimbursement_rate === '' ? null : Number(line.reimbursement_rate),
    rate_unit: line.rate_unit,
    service_requirement_code: line.service_requirement_code || null,
    ...(line.effective_start_date ? { effective_start_date: line.effective_start_date } : {}),
    ...(line.effective_end_date ? { effective_end_date: line.effective_end_date } : {}),
  }
}

function LineFields({ line, onChange, options, index }: {
  line: Line; onChange: (line: Line) => void; options: Options; index?: number
}) {
  const suffix = index === undefined ? '' : ` ${index + 1}`
  function field(key: keyof Line, value: string) { onChange({ ...line, [key]: value }) }
  return <Stack spacing={2} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
    <TextField select required label={`Service${suffix}`} value={line.organization_service_id} onChange={(e) => field('organization_service_id', e.target.value)}>
      {options.organizationServices.filter((service) => service.enabled || service.id === line.organization_service_id).map((service) =>
        <MenuItem key={service.id} value={service.id}>{service.local_service_name || service.service_code_mapping.billing_service.service_name} ({service.service_code_mapping.billing_service.billing_code})</MenuItem>)}
    </TextField>
    <TextField required type="number" label={`Authorized quantity${suffix}`} value={line.authorized_quantity} onChange={(e) => field('authorized_quantity', e.target.value)} slotProps={{ htmlInput: { min: '0.01', step: 'any' } }} />
    <TextField select label={`Quantity unit${suffix}`} value={line.quantity_unit} onChange={(e) => field('quantity_unit', e.target.value)}>
      {QUANTITY_UNITS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
    </TextField>
    <TextField select label={`Quantity period${suffix}`} value={line.quantity_period} onChange={(e) => field('quantity_period', e.target.value)}>
      {QUANTITY_PERIODS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
    </TextField>
    <TextField type="number" label={`Reimbursement override${suffix}`} value={line.reimbursement_rate} onChange={(e) => field('reimbursement_rate', e.target.value)} helperText="Leave blank to use the organization rate." slotProps={{ htmlInput: { min: 0, step: '0.01' } }} />
    <TextField select label={`Rate unit${suffix}`} value={line.rate_unit} onChange={(e) => field('rate_unit', e.target.value)}>
      {RATE_UNITS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
    </TextField>
    <TextField label={`Service requirement code${suffix}`} value={line.service_requirement_code} onChange={(e) => field('service_requirement_code', e.target.value)} />
    <TextField type="date" label={`Service start${suffix}`} value={line.effective_start_date} onChange={(e) => field('effective_start_date', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    <TextField type="date" label={`Service end${suffix}`} value={line.effective_end_date} onChange={(e) => field('effective_end_date', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
  </Stack>
}

export default function AuthorizationForm({ orgId, patientId, options, authorization, service, serviceForm = false }: {
  orgId: string; patientId: string; options: Options; authorization?: PatientAuthorizationDetail
  service?: AuthorizationServiceWithEffectiveRate; serviceForm?: boolean
}) {
  const router = useRouter()
  const notifications = useNotifications()
  const base = `/patients/${patientId}/authorization`
  const detail = authorization ? `${base}/${authorization.id}` : base
  const [payer, setPayer] = React.useState(authorization?.payer_id ?? '')
  const [start, setStart] = React.useState(authorization?.authorization_start_date ?? '')
  const [end, setEnd] = React.useState(authorization?.authorization_end_date ?? '')
  const [status, setStatus] = React.useState<string>(authorization?.status ?? 'Active')
  const [number, setNumber] = React.useState('')
  const [lines, setLines] = React.useState<Line[]>(() => service ? [{
    organization_service_id: service.organization_service_id,
    authorized_quantity: String(service.authorized_quantity), quantity_unit: service.quantity_unit,
    quantity_period: service.quantity_period,
    reimbursement_rate: service.effective_rate?.source === 'authorization' && service.effective_rate.rate != null ? String(service.effective_rate.rate) : '',
    rate_unit: service.effective_rate?.source === 'authorization' && service.effective_rate.rate_unit
      ? service.effective_rate.rate_unit : ({ Hours: 'Hour', Visits: 'Visit', Units: 'Unit' }[service.quantity_unit]),
    service_requirement_code: service.service_requirement_code ?? '',
    effective_start_date: service.effective_start_date, effective_end_date: service.effective_end_date,
  }] : serviceForm ? [emptyLine()] : [])
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const rateUnavailable = !!service && service.effective_rate === null

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const common = { organizationId: orgId, patientId }
      const result = serviceForm && authorization
        ? await upsertAuthorizationServiceAction({ ...common, authorizationId: authorization.id, ...(service ? { authorizationServiceId: service.id } : {}), ...linePayload(lines[0]) })
        : authorization
          ? await updateAuthorizationAction({ ...common, authorizationId: authorization.id, payer_id: payer, authorization_start_date: start, authorization_end_date: end, ...(status !== authorization.status ? { status } : {}) })
          : await createAuthorizationAction({ ...common, payer_id: payer, authorization_start_date: start, authorization_end_date: end, status, prior_auth_number: number || null, services: lines.map(linePayload) })
      if (!result.success) {
        const fields = result.fieldErrors ? Object.values(result.fieldErrors).flat().join(' ') : ''
        setError(result.error || fields || 'Unable to save. Check the form and try again.')
        notifications.show('Unable to save.', { severity: 'error' })
        return
      }
      notifications.show('Saved successfully.', { severity: 'success' })
      router.push(!authorization && result.data ? `${base}/${result.data}` : detail)
      router.refresh()
    } finally { setBusy(false) }
  }

  const title = serviceForm ? (service ? 'Edit service line' : 'Add service line') : (authorization ? 'Edit authorization' : 'Add authorization')
  return <PageContainer title={title} breadcrumbs={[
    { title: 'Patients', path: '/patients' }, { title: 'Patient', path: `/patients/${patientId}` },
    { title: 'Authorizations', path: base }, ...(authorization ? [{ title: 'Detail', path: detail }] : []), { title },
  ]}>
    <Box component="form" onSubmit={submit}>
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {rateUnavailable && <Alert severity="warning">This service cannot be edited because its rate information is unavailable. Editing could overwrite an existing rate.</Alert>}
        {!serviceForm && <>
          <TextField select required label="Payer" value={payer} onChange={(e) => setPayer(e.target.value)}>
            {options.payers.filter((p) => p.status === 'Active' || p.id === payer).map((p) => (
              <MenuItem key={p.id} value={p.id}>{p.payer_name}{p.status === 'Inactive' ? ' (Inactive)' : ''}</MenuItem>
            ))}
          </TextField>
          <TextField required type="date" label="Start date" value={start} onChange={(e) => setStart(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField required type="date" label="End date" value={end} onChange={(e) => setEnd(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {AUTHORIZATION_STATUSES.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
          </TextField>
          {!authorization && <TextField label="Prior authorization number" value={number} onChange={(e) => setNumber(e.target.value)} autoComplete="off" />}
          {!authorization && <Typography variant="h6">Service lines</Typography>}
        </>}
        {lines.map((line, index) => <React.Fragment key={index}>
          <LineFields line={line} options={options} index={serviceForm ? undefined : index}
            onChange={(updated) => setLines((previous) => previous.map((item, i) => i === index ? updated : item))} />
          {!serviceForm && <Button onClick={() => setLines((previous) => previous.filter((_, i) => i !== index))}>Remove service line {index + 1}</Button>}
        </React.Fragment>)}
        {!serviceForm && !authorization && <Button onClick={() => setLines((previous) => [...previous, emptyLine()])}>Add service line</Button>}
        <Stack direction="row" spacing={2}>
          <Button onClick={() => router.push(detail)} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy || rateUnavailable}>Save</Button>
        </Stack>
      </Stack>
    </Box>
  </PageContainer>
}
