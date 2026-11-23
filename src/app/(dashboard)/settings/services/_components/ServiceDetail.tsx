'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import useServerPagination from '@/components/shared/useServerPagination'
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination'
import type { OrganizationServiceRate, OrganizationServiceRateListPage, OrganizationServiceWithMapping } from '@/types'
import { listOrganizationServiceRatesAction } from '../actions'
import RateForm from './RateForm'

function RateHistory({ orgId, serviceId, initialRates, initialPaginationModel, canManage, today }: {
  orgId: string
  serviceId: string
  initialRates: OrganizationServiceRateListPage
  initialPaginationModel: GridPaginationModel
  canManage: boolean
  today: string
}) {
  const { rows, rowCount, paginationModel, isLoading, error, onPaginationModelChange, reload } = useServerPagination({
    initialPage: initialRates,
    initialPaginationModel,
    initialFilters: {},
    errorMessage: 'Failed to load rate history.',
    fetchPage: (model) => listOrganizationServiceRatesAction(orgId, serviceId, model),
  })
  const columns = React.useMemo<GridColDef<OrganizationServiceRate>[]>(() => [
    { field: 'reimbursement_rate', headerName: 'Reimbursement rate', minWidth: 170 },
    { field: 'rate_unit', headerName: 'Unit', minWidth: 100 },
    { field: 'effective_start_date', headerName: 'Effective from', minWidth: 140 },
    { field: 'effective_end_date', headerName: 'Effective through', minWidth: 150, valueGetter: (value) => value ?? 'Ongoing' },
    { field: 'change_reason', headerName: 'Reason', flex: 1, minWidth: 180 },
  ], [])
  return (
    <Stack spacing={2} sx={{ mt: 3 }}>
      <Typography variant="h6">Rate history</Typography>
      {error ? <Alert severity="error">{error.message}</Alert> : (
        <DataGrid rows={rows} columns={columns} disableRowSelectionOnClick paginationMode="server" rowCount={rowCount}
          paginationModel={paginationModel} onPaginationModelChange={onPaginationModelChange}
          pageSizeOptions={[...PAGE_SIZE_OPTIONS]} loading={isLoading} />
      )}
      <Button onClick={reload} disabled={isLoading}>Reload rate history</Button>
      {canManage && <><Typography variant="h6">Set a prospective rate</Typography><RateForm orgId={orgId} serviceId={serviceId} today={today} onSaved={reload} /></>}
    </Stack>
  )
}

export default function ServiceDetail({ orgId, service, canManage, canReadRates, initialRates, rateError, initialPaginationModel, today }: {
  orgId: string
  service: OrganizationServiceWithMapping
  canManage: boolean
  canReadRates: boolean
  initialRates: OrganizationServiceRateListPage | null
  rateError?: string
  initialPaginationModel: GridPaginationModel
  today: string
}) {
  const router = useRouter()
  const mapping = service.service_code_mapping
  return (
    <PageContainer title={service.local_service_name || mapping.evv_service_name}
      breadcrumbs={[{ title: 'Home', path: '/dashboard' }, { title: 'Services', path: '/settings/services' }, { title: 'Service details' }]}
      actions={canManage ? <Button variant="contained" onClick={() => router.push(`/settings/services/${service.id}/edit`)}>Edit service</Button> : undefined}>
      <Stack spacing={1}>
        <Typography>Service mapping: {mapping.evv_service_name}</Typography>
        <Typography>Billing code: {mapping.billing_service.billing_code}</Typography>
        <Typography>Payer type: {mapping.payer_type}</Typography>
        <Typography>Program: {mapping.program_name || '—'}</Typography>
        <Typography>Status: {service.enabled ? 'Enabled' : 'Disabled'}</Typography>
        <Typography>Clinical approval: {service.requires_clinical_approval ? 'Required' : 'Not required'}</Typography>
      </Stack>
      {rateError && <Alert severity="error" sx={{ mt: 2 }}>{rateError}</Alert>}
      {canReadRates && initialRates && <RateHistory orgId={orgId} serviceId={service.id} initialRates={initialRates} initialPaginationModel={initialPaginationModel} canManage={canManage} today={today} />}
    </PageContainer>
  )
}
