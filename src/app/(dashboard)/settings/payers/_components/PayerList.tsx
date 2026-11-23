'use client'

import * as React from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import {
  DataGrid,
  GridActionsCellItem,
  type GridColDef,
  type GridPaginationModel,
  gridClasses,
} from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useRouter } from 'next/navigation'
import PageContainer from '@/components/templates/crud-dashboard/components/PageContainer'
import useServerPagination from '@/components/shared/useServerPagination'
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination'
import type { PayerListPage } from '@/types'
import { listPayersAction } from '../actions'

const STATUS_COLOR: Record<string, 'success' | 'default'> = {
  Active: 'success',
  Inactive: 'default',
}

interface PayerListProps {
  orgId: string
  canManage: boolean
  initialPage: PayerListPage
  initialPaginationModel: GridPaginationModel
}

export default function PayerList({
  orgId,
  canManage,
  initialPage,
  initialPaginationModel,
}: PayerListProps) {
  const router = useRouter()
  const {
    rows,
    rowCount,
    paginationModel,
    isLoading,
    error,
    onPaginationModelChange,
    reload,
  } = useServerPagination({
    initialPage,
    initialPaginationModel,
    initialFilters: {},
    errorMessage: 'Failed to load payers.',
    fetchPage: (model) =>
      listPayersAction(orgId, { page: model.page, pageSize: model.pageSize }),
  })

  const columns = React.useMemo<GridColDef<PayerListPage['rows'][number]>[]>(() => {
    const payerColumns: GridColDef<PayerListPage['rows'][number]>[] = [
      { field: 'payer_name', headerName: 'Payer', flex: 1, minWidth: 180 },
      { field: 'payer_type', headerName: 'Type', width: 150 },
      { field: 'program_name', headerName: 'Program', flex: 1, minWidth: 150, valueGetter: (_value, row) => row.program_name || '—' },
      {
        field: 'status',
        headerName: 'Status',
        width: 120,
        renderCell: ({ value }) => (
          <Chip
            label={value}
            color={STATUS_COLOR[value as string] ?? 'default'}
            size="small"
            variant="outlined"
          />
        ),
      },
      {
        field: 'created_at',
        headerName: 'Added',
        width: 130,
        type: 'date',
        valueGetter: (_value, row) => (row.created_at ? new Date(row.created_at) : null),
      },
    ]

    if (canManage) {
      payerColumns.push({
        field: 'actions',
        type: 'actions',
        width: 72,
        getActions: ({ row }) => [
          <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label="Edit"
            onClick={() => router.push(`/settings/payers/${row.id}/edit`)}
          />,
        ],
      })
    }

    return payerColumns
  }, [canManage, router])

  return (
    <PageContainer
      title="Payers"
      breadcrumbs={[{ title: 'Home', path: '/dashboard' }, { title: 'Payers' }]}
      actions={
        <Stack direction="row" spacing={1}>
          <Tooltip title="Reload payers">
            <span>
              <Button
                variant="outlined"
                aria-label="Reload payers"
                onClick={reload}
                disabled={isLoading}
                startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
              >
                Reload
              </Button>
            </span>
          </Tooltip>
          {canManage ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/settings/payers/new')}
            >
              Create payer
            </Button>
          ) : null}
        </Stack>
      }
    >
      <Box sx={{ flex: 1, width: '100%' }}>
        {error ? (
          <Alert severity="error">{error.message}</Alert>
        ) : (
          <DataGrid
            rows={rows}
            getRowId={(row) => row.id}
            columns={columns}
            disableRowSelectionOnClick
            showToolbar
            paginationMode="server"
            rowCount={rowCount}
            paginationModel={paginationModel}
            onPaginationModelChange={onPaginationModelChange}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
            sx={{
              opacity: isLoading ? 0.5 : 1,
              transition: 'opacity 0.2s',
              [`& .${gridClasses.columnHeader}, & .${gridClasses.cell}`]: { outline: 'transparent' },
              [`& .${gridClasses.columnHeader}:focus-within, & .${gridClasses.cell}:focus-within`]: {
                outline: 'none',
              },
            }}
          />
        )}
      </Box>
    </PageContainer>
  )
}
