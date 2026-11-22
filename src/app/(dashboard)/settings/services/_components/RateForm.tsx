'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { RATE_UNITS, type RateUnit } from '@/types'
import { setOrganizationServiceRateAction } from '../actions'

export default function RateForm({ orgId, serviceId, today, onSaved }: { orgId: string; serviceId: string; today: string; onSaved: () => void }) {
  const [date, setDate] = React.useState(today)
  const [amount, setAmount] = React.useState('')
  const [unit, setUnit] = React.useState<RateUnit>(RATE_UNITS[0])
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const current = new Date().toISOString().slice(0, 10)
    if (!date || date < current) {
      setError('Rate changes must be effective today or later.')
      return
    }
    if (!amount.trim()) {
      setError('A reimbursement rate is required.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const result = await setOrganizationServiceRateAction({
        organizationId: orgId, organizationServiceId: serviceId, reimbursement_rate: Number(amount),
        rate_unit: unit, effective_start_date: date, change_reason: reason,
      })
      if (!result.success) {
        setError(result.error ?? (Object.values(result.fieldErrors ?? {}).flat().join(' ') || 'Unable to set rate.'))
        return
      }
      setAmount('')
      setReason('')
      onSaved()
    } finally {
      setPending(false)
    }
  }

  return (
    <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField required label="Reimbursement rate" type="number" value={amount} onChange={(event) => setAmount(event.target.value)}
        slotProps={{ htmlInput: { min: 0, step: 0.01 } }} disabled={pending} />
      <TextField select required label="Rate unit" value={unit} onChange={(event) => setUnit(event.target.value as RateUnit)} disabled={pending}>
        {RATE_UNITS.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
      </TextField>
      <TextField required label="Effective date" type="date" value={date} onChange={(event) => setDate(event.target.value)}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today } }} disabled={pending} />
      <TextField required label="Change reason" value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} />
      <Button type="submit" variant="contained" disabled={pending}>{pending ? 'Saving...' : 'Set rate'}</Button>
    </Box>
  )
}
