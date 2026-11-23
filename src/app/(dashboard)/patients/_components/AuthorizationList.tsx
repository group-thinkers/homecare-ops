'use client'

import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import type { PatientAuthorizationListPage, PatientAuthorizationListItem } from '@/types'

export default function AuthorizationList({ patientId, data, page, canManage }: {
  patientId: string; data: PatientAuthorizationListPage; page: number; canManage: boolean
}) {
  const router = useRouter()
  const base = `/patients/${patientId}/authorization`
  const columns: GridColDef<PatientAuthorizationListItem>[] = [
    { field: 'payer', headerName: 'Payer', flex: 1, minWidth: 150, valueGetter: (_, row) => row.payer.payer_name },
    { field: 'masked_prior_auth_number', headerName: 'Authorization number', flex: 1, minWidth: 170, valueGetter: (value) => value ?? '—' },
    { field: 'authorization_start_date', headerName: 'Start', width: 120 },
    { field: 'authorization_end_date', headerName: 'End', width: 120 },
    { field: 'effective_status', headerName: 'Status', width: 170 },
    { field: 'service_count', headerName: 'Services', width: 100 },
    { field: 'view', headerName: '', width: 90, sortable: false, renderCell: ({ row }) => <Button onClick={() => router.push(`${base}/${row.id}`)}>View</Button> },
  ]
  return (
    <PageContainer title="Authorizations" breadcrumbs={[
      { title: 'Patients', path: '/patients' },
      { title: 'Patient', path: `/patients/${patientId}` },
      { title: 'Authorizations' },
    ]} actions={canManage ? <Button variant="contained" onClick={() => router.push(`${base}/new`)}>Add authorization</Button> : undefined}>
      <Box sx={{ width: '100%', height: 480 }}>
        <DataGrid rows={data.rows} columns={columns} rowCount={data.rowCount}
          paginationMode="server" paginationModel={{ page, pageSize: 10 }} pageSizeOptions={[10]}
          onPaginationModelChange={(model) => router.push(`${base}?page=${model.page}`)}
          disableRowSelectionOnClick />
      </Box>
      <Button onClick={() => router.push(`/patients/${patientId}`)}>Back to patient</Button>
    </PageContainer>
  )
}
