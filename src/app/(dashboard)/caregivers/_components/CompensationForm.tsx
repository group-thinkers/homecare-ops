'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useRouter } from 'next/navigation'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import { CAREGIVER_RATE_UNITS } from '@/lib/schemas/caregivers.schema'
import type { Caregiver, OrganizationServiceWithMapping } from '@/types'
import { setCompensationRateAction } from '../actions'

interface CompensationFormValues {
  pay_rate: string
  rate_unit: string
  effective_start_date: string
  organization_service_id: string
}

const EMPTY_VALUES: CompensationFormValues = {
  pay_rate: '',
  rate_unit: 'Hour',
  effective_start_date: '',
  organization_service_id: '',
}

export interface CompensationFormProps {
  caregiver: Caregiver
  orgId: string
  organizationServices: OrganizationServiceWithMapping[]
}

export default function CompensationForm({ caregiver, orgId, organizationServices }: CompensationFormProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const fullName = `${caregiver.first_name} ${caregiver.last_name}`.trim()

  const [values, setValues] = React.useState<CompensationFormValues>(EMPTY_VALUES)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const hasChanges = React.useMemo(
    () => JSON.stringify(values) !== JSON.stringify(EMPTY_VALUES),
    [values],
  )

  const handleChange = React.useCallback((field: keyof CompensationFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors({})
  }, [])

  const handleReset = React.useCallback(() => {
    setValues(EMPTY_VALUES)
    setErrors({})
  }, [])

  const handleBackClick = React.useCallback(() => {
    router.push(`/caregivers/${caregiver.id}/compensation`)
  }, [router, caregiver.id])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      const payRate = Number(values.pay_rate)

      if (!values.pay_rate.trim() || Number.isNaN(payRate) || payRate <= 0) {
        setErrors({ pay_rate: 'Pay rate must be greater than zero.' })
        return
      }

      if (!values.effective_start_date) {
        setErrors({ effective_start_date: 'Effective start date is required.' })
        return
      }

      setIsSubmitting(true)

      try {
        const result = await setCompensationRateAction({
          organizationId: orgId,
          caregiverId: caregiver.id,
          pay_rate: payRate,
          rate_unit: values.rate_unit,
          effective_start_date: values.effective_start_date,
          organization_service_id: values.organization_service_id.trim()
            ? values.organization_service_id.trim()
            : null,
        })

        if (!result.success) {
          if (result.fieldErrors) {
            setErrors(
              Object.fromEntries(
                Object.entries(result.fieldErrors).map(([key, messages]) => [key, messages[0]]),
              ),
            )
          }
          notifications.show(result.error ?? 'Failed to save compensation rate.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show('Compensation rate saved.', { severity: 'success', autoHideDuration: 3000 })
        router.push(`/caregivers/${caregiver.id}/compensation`)
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, orgId, caregiver.id, notifications, router],
  )

  return (
    <PageContainer
      title="Add Compensation Rate"
       breadcrumbs={[
        { title: 'Home', path: '/dashboard'},
        { title: 'Caregivers', path: '/caregivers' },
        { title: fullName || 'Caregiver', path: `/caregivers/${caregiver.id}` },
        { title: 'Compensation', path: `/caregivers/${caregiver.id}/compensation` },
        { title: 'Add Rate' },
      ]}
    >
      <Typography component="p" variant="body2" color="text.secondary" sx={{ mt: -1, mb: 4 }}>
        Saving a new rate closes the current active rate for the same service on the day before the new
        effective date.
      </Typography>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}
      >
        <Stack direction="row" spacing={2}>
          <TextField
            label="Pay Rate"
            type="number"
            value={values.pay_rate}
            onChange={(e) => handleChange('pay_rate', e.target.value)}
            error={!!errors.pay_rate}
            helperText={errors.pay_rate}
            required
            fullWidth
            disabled={isSubmitting}
          />
          <FormControl fullWidth disabled={isSubmitting}>
            <InputLabel id="rate-unit-label">Rate Unit</InputLabel>
            <Select
              labelId="rate-unit-label"
              label="Rate Unit"
              value={values.rate_unit}
              onChange={(e) => handleChange('rate_unit', e.target.value)}
            >
              {CAREGIVER_RATE_UNITS.map((unit) => (
                <MenuItem key={unit} value={unit}>
                  {unit}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <TextField
          label="Effective From"
          type="date"
          value={values.effective_start_date}
          onChange={(e) => handleChange('effective_start_date', e.target.value)}
          error={!!errors.effective_start_date}
          helperText={errors.effective_start_date}
          required
          fullWidth
          disabled={isSubmitting}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <FormControl fullWidth disabled={isSubmitting}>
          <InputLabel id="organization-service-label">Organization Service (optional)</InputLabel>
          <Select
            labelId="organization-service-label"
            label="Organization Service (optional)"
            value={values.organization_service_id}
            onChange={(e) => handleChange('organization_service_id', e.target.value)}
          >
            <MenuItem value="">Caregiver default rate</MenuItem>
            {organizationServices.map((service) => (
              <MenuItem value={service.id} key={service.id}>
                {service.local_service_name ?? service.service_code_mapping.evv_service_name}
              </MenuItem>
            ))}
          </Select>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, ml: 1.75 }}>
            Leave empty to set a caregiver default rate.
          </Typography>
        </FormControl>

        <Box sx={{ width: '100%', mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Chip
            label={hasChanges ? 'Unsaved Changes' : 'No Changes'}
            color={hasChanges ? 'success' : 'default'}
            variant="outlined"
          />
          <Stack direction="row" spacing={1}>
            <Button type="reset" variant="text" onClick={handleReset} disabled={isSubmitting || !hasChanges}>
              Reset
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting || !hasChanges}>
              {isSubmitting ? 'Saving...' : 'Save Rate'}
            </Button>
          </Stack>
        </Box>

        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBackClick} disabled={isSubmitting}>
            Back
          </Button>
        </Stack>
      </Box>
    </PageContainer>
  )
}
