'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { PAYER_TYPES, type PayerType } from '@/types'

export interface PayerFormValues {
  payer_name: string
  payer_type: PayerType
  program_name: string
  status: 'Active' | 'Inactive'
}

export interface PayerFormState {
  values: PayerFormValues
  errors: Record<string, string>
}

interface PayerFormProps {
  formState: PayerFormState
  hasChanges: boolean
  isSubmitting?: boolean
  submitLabel: string
  onPayerNameChange: (value: string) => void
  onPayerTypeChange: (value: PayerType) => void
  onProgramNameChange: (value: string) => void
  onStatusChange: (value: 'Active' | 'Inactive') => void
  onSubmit: (values: PayerFormValues) => void
  onReset: () => void
  onBackClick: () => void
}

export default function PayerForm({
  formState,
  hasChanges,
  isSubmitting = false,
  submitLabel,
  onPayerNameChange,
  onPayerTypeChange,
  onProgramNameChange,
  onStatusChange,
  onSubmit,
  onReset,
  onBackClick,
}: PayerFormProps) {
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit(formState.values)
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', mt: 2 }}
    >
      <TextField
        label="Payer name"
        value={formState.values.payer_name}
        onChange={(event) => onPayerNameChange(event.target.value)}
        error={Boolean(formState.errors.payer_name)}
        helperText={formState.errors.payer_name}
        required
        fullWidth
        disabled={isSubmitting}
      />
      <TextField
        select
        label="Payer type"
        value={formState.values.payer_type}
        onChange={(event) => onPayerTypeChange(event.target.value as PayerType)}
        error={Boolean(formState.errors.payer_type)}
        helperText={formState.errors.payer_type}
        required
        fullWidth
        disabled={isSubmitting}
      >
        {PAYER_TYPES.map((payerType) => (
          <MenuItem key={payerType} value={payerType}>{payerType}</MenuItem>
        ))}
      </TextField>
      <TextField
        label="Program name"
        value={formState.values.program_name}
        onChange={(event) => onProgramNameChange(event.target.value)}
        error={Boolean(formState.errors.program_name)}
        helperText={formState.errors.program_name}
        fullWidth
        disabled={isSubmitting}
      />
      <TextField
        select
        label="Status"
        value={formState.values.status}
        onChange={(event) => onStatusChange(event.target.value as 'Active' | 'Inactive')}
        error={Boolean(formState.errors.status)}
        helperText={formState.errors.status}
        required
        fullWidth
        disabled={isSubmitting}
      >
        <MenuItem value="Active">Active</MenuItem>
        <MenuItem value="Inactive">Inactive</MenuItem>
      </TextField>

      <Box sx={{ width: '100%', mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Chip
          label={hasChanges ? 'Unsaved Changes' : 'No Changes'}
          color={hasChanges ? 'success' : 'default'}
          variant="outlined"
        />
        <Stack direction="row" spacing={1}>
          <Button type="reset" variant="text" onClick={onReset} disabled={isSubmitting || !hasChanges}>
            Reset
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting || !hasChanges}>
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </Stack>
      </Box>

      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={onBackClick}
          disabled={isSubmitting}
        >
          Back
        </Button>
      </Stack>
    </Box>
  )
}
