'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import useServerPagination from '@/components/shared/useServerPagination'
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination'
import type { OrganizationServiceListPage } from '@/types'
import { listOrgServicesAction } from '../actions'

export default function ServiceList({ orgId, canManage, initialPage, initialPaginationModel }: {
  orgId: string
  canManage: boolean
  initialPage: OrganizationServiceListPage
  initialPaginationModel: GridPaginationModel
}) {
  const router = useRouter()
  const { rows, rowCount, paginationModel, isLoading, error, onPaginationModelChange, reload } = useServerPagination({
    initialPage,
    initialPaginationModel,
    initialFilters: {},
    errorMessage: 'Failed to load services.',
    fetchPage: (model) => listOrgServicesAction(orgId, model),
  })
  const columns = React.useMemo<GridColDef<OrganizationServiceListPage['rows'][number]>[]>(() => [
    { field: 'local_service_name', headerName: 'Service', flex: 1, minWidth: 180, valueGetter: (_value, row) => row.local_service_name || row.service_code_mapping.evv_service_name },
    { field: 'billing_code', headerName: 'Billing code', minWidth: 120, valueGetter: (_value, row) => row.service_code_mapping.billing_service.billing_code },
    { field: 'payer_type', headerName: 'Payer type', minWidth: 130, valueGetter: (_value, row) => row.service_code_mapping.payer_type },
    { field: 'enabled', headerName: 'Status', minWidth: 110, valueGetter: (_value, row) => row.enabled ? 'Enabled' : 'Disabled' },
    { field: 'detail', headerName: '', sortable: false, filterable: false, minWidth: 100, renderCell: ({ row }) => <Button onClick={() => router.push(`/settings/services/${row.id}`)}>View</Button> },
  ], [router])
  return (
    <PageContainer title="Services" breadcrumbs={[{ title: 'Home', path: '/dashboard' }, { title: 'Services' }]}
      actions={<Stack direction="row" spacing={1}><Button onClick={reload} disabled={isLoading}>Reload</Button>{canManage && <Button variant="contained" onClick={() => router.push('/settings/services/new')}>Activate service</Button>}</Stack>}>
      {error ? <Alert severity="error">{error.message}</Alert> : (
        <DataGrid rows={rows} columns={columns} disableRowSelectionOnClick paginationMode="server"
          rowCount={rowCount} paginationModel={paginationModel} onPaginationModelChange={onPaginationModelChange}
          pageSizeOptions={[...PAGE_SIZE_OPTIONS]} loading={isLoading} />
      )}
    </PageContainer>
  )
}
