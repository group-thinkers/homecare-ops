'use client'

import * as React from 'react'
import Box from '@mui/material/Box'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import useNotifications from '@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications'
import { PAYER_TYPES, type Payer, type PayerType } from '@/types'
import { upsertPayerAction } from '../actions'
import PayerForm, { type PayerFormState, type PayerFormValues } from './PayerForm'

interface PayerEditorProps {
  orgId: string
  payer?: Payer
}

function initialValues(payer?: Payer): PayerFormValues {
  return {
    payer_name: payer?.payer_name ?? '',
    payer_type: payer?.payer_type ?? PAYER_TYPES[0],
    program_name: payer?.program_name ?? '',
    status: payer?.status ?? 'Active',
  }
}

export default function PayerEditor({ orgId, payer }: PayerEditorProps) {
  const router = useRouter()
  const notifications = useNotifications()
  const startingValues = React.useMemo(() => initialValues(payer), [payer])
  const [formState, setFormState] = React.useState<PayerFormState>({
    values: startingValues,
    errors: {},
  })
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const hasChanges = React.useMemo(
    () => JSON.stringify(formState.values) !== JSON.stringify(startingValues),
    [formState.values, startingValues],
  )

  const setValue = React.useCallback(<K extends keyof PayerFormValues,>(field: K, value: PayerFormValues[K]) => {
    setFormState((previous) => ({
      values: { ...previous.values, [field]: value },
      errors: {},
    }))
  }, [])

  const handleSubmit = React.useCallback(
    async (values: PayerFormValues) => {
      if (!values.payer_name.trim()) {
        setFormState((previous) => ({
          ...previous,
          errors: { payer_name: 'Payer name is required.' },
        }))
        return
      }

      setIsSubmitting(true)
      try {
        const result = await upsertPayerAction({
          organizationId: orgId,
          payerId: payer?.id,
          payer_name: values.payer_name,
          payer_type: values.payer_type,
          program_name: values.program_name.trim() || null,
          status: values.status,
        })

        if (!result.success) {
          if (result.fieldErrors) {
            setFormState((previous) => ({
              ...previous,
              errors: Object.fromEntries(
                Object.entries(result.fieldErrors ?? {}).map(([field, messages]) => [field, messages[0]]),
              ),
            }))
          }
          notifications.show(result.error ?? 'Unable to save payer.', {
            severity: 'error',
            autoHideDuration: 4000,
          })
          return
        }

        notifications.show(payer ? 'Payer updated.' : 'Payer created.', {
          severity: 'success',
          autoHideDuration: 3000,
        })
        router.push('/settings/payers')
        router.refresh()
      } finally {
        setIsSubmitting(false)
      }
    },
    [notifications, orgId, payer, router],
  )

  const setPayerType = (value: PayerType) => setValue('payer_type', value)
  const setStatus = (value: 'Active' | 'Inactive') => setValue('status', value)

  return (
    <PageContainer
      title={payer ? 'Edit payer' : 'Create payer'}
      breadcrumbs={[
        { title: 'Home', path: '/dashboard' },
        { title: 'Payers', path: '/settings/payers' },
        { title: payer ? 'Edit payer' : 'Create payer' },
      ]}
    >
      <Box sx={{ display: 'flex', width: '100%', flex: 1 }}>
        <PayerForm
          formState={formState}
          hasChanges={hasChanges}
          isSubmitting={isSubmitting}
          submitLabel={payer ? 'Save changes' : 'Create payer'}
          onPayerNameChange={(value) => setValue('payer_name', value)}
          onPayerTypeChange={setPayerType}
          onProgramNameChange={(value) => setValue('program_name', value)}
          onStatusChange={setStatus}
          onSubmit={handleSubmit}
          onReset={() => setFormState({ values: startingValues, errors: {} })}
          onBackClick={() => router.push('/settings/payers')}
        />
      </Box>
    </PageContainer>
  )
}
