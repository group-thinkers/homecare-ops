import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrganizationServiceWithMapping } from '@/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/components/templates/crud-dashboard/components/PageContainer', () => ({
  default: ({ children, title, actions }: { children: React.ReactNode; title: string; actions?: React.ReactNode }) => <div><h1>{title}</h1>{actions}{children}</div>,
}))
vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows, columns }: { rows: unknown[]; columns: { headerName: string }[] }) => (
    <div data-testid="grid">{columns.map((column) => <span key={column.headerName}>{column.headerName}</span>)}{rows.length} rows</div>
  ),
}))
vi.mock('@/app/(dashboard)/settings/services/actions', () => ({
  activateOrgServiceAction: vi.fn(), updateOrgServiceAction: vi.fn(),
  listOrgServicesAction: vi.fn(), listOrganizationServiceRatesAction: vi.fn(),
  setOrganizationServiceRateAction: vi.fn(),
}))

import ServiceDetail from '@/app/(dashboard)/settings/services/_components/ServiceDetail'
import ServiceEditor from '@/app/(dashboard)/settings/services/_components/ServiceEditor'
import ServiceList from '@/app/(dashboard)/settings/services/_components/ServiceList'
import { activateOrgServiceAction, listOrgServicesAction, setOrganizationServiceRateAction, updateOrgServiceAction } from '@/app/(dashboard)/settings/services/actions'

const service: OrganizationServiceWithMapping = {
  id: '00000000-0000-0000-0000-000000000002',
  organization_id: '00000000-0000-0000-0000-000000000001',
  service_code_mapping_id: '00000000-0000-0000-0000-000000000003',
  local_service_name: 'Synthetic service',
  requires_clinical_approval: false,
  enabled: true,
  created_at: '2026-01-01T00:00:00Z',
  created_by_user_id: '00000000-0000-0000-0000-000000000004',
  updated_at: null,
  updated_by_user_id: null,
  service_code_mapping: {
    id: '00000000-0000-0000-0000-000000000003',
    evv_service_id: 'SYN',
    evv_service_name: 'Synthetic mapping',
    payer_type: 'Medicaid',
    program_name: null,
    billing_service: { billing_code: 'SYN', service_name: 'Synthetic billing', service_category: 'Personal Care' as OrganizationServiceWithMapping['service_code_mapping']['billing_service']['service_category'] },
  },
}
const pagination = { page: 0, pageSize: 10 }
const today = new Date().toISOString().slice(0, 10)

beforeEach(() => vi.clearAllMocks())

describe('service settings', () => {
  it('keeps money out of the general service list and hides activation from readers', () => {
    render(<ServiceList orgId={service.organization_id} canManage={false} initialPage={{ rows: [service], rowCount: 1 }} initialPaginationModel={pagination} />)
    expect(screen.getByTestId('grid')).not.toHaveTextContent(/rate|reimbursement/i)
    expect(screen.queryByRole('button', { name: /activate service/i })).not.toBeInTheDocument()
  })

  it('does not render financial content for ordinary readers', () => {
    render(<ServiceDetail orgId={service.organization_id} service={service} canManage={false} canReadRates={false}
      initialRates={null} initialPaginationModel={pagination} today={today} />)
    expect(screen.getByText('Billing code: SYN')).toBeInTheDocument()
    expect(screen.queryByText('Rate history')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /set rate/i })).not.toBeInTheDocument()
  })

  it('lets financial readers see history without a write form', () => {
    render(<ServiceDetail orgId={service.organization_id} service={service} canManage={false} canReadRates
      initialRates={{ rows: [], rowCount: 0 }} initialPaginationModel={pagination} today={today} />)
    expect(screen.getByText('Rate history')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /set rate/i })).not.toBeInTheDocument()
  })

  it('defaults the date to today, prevents past dates, and submits rate changes', async () => {
    vi.mocked(setOrganizationServiceRateAction).mockResolvedValue({ success: true })
    render(<ServiceDetail orgId={service.organization_id} service={service} canManage canReadRates
      initialRates={{ rows: [], rowCount: 0 }} initialPaginationModel={pagination} today={today} />)
    const date = screen.getByLabelText(/Effective date/) as HTMLInputElement
    expect(date.value).toBe(today)
    expect(date.min).toBe(today)
    fireEvent.change(screen.getByLabelText(/Reimbursement rate/), { target: { value: '12.50' } })
    fireEvent.change(screen.getByLabelText(/Change reason/), { target: { value: 'Annual update' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set rate' }))
    await waitFor(() => expect(setOrganizationServiceRateAction).toHaveBeenCalledWith({
      organizationId: service.organization_id, organizationServiceId: service.id, reimbursement_rate: 12.5,
      rate_unit: 'Hour', effective_start_date: today, change_reason: 'Annual update',
    }))
  })

  it('rejects a past date even if browser validation is bypassed', () => {
    render(<ServiceDetail orgId={service.organization_id} service={service} canManage canReadRates
      initialRates={{ rows: [], rowCount: 0 }} initialPaginationModel={pagination} today={today} />)
    fireEvent.change(screen.getByLabelText(/Effective date/), { target: { value: '2000-01-01' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Set rate' }).closest('form')!)
    expect(screen.getByText('Rate changes must be effective today or later.')).toBeInTheDocument()
    expect(setOrganizationServiceRateAction).not.toHaveBeenCalled()
  })

  it('activates a mapping with selected clinical approval', async () => {
    vi.mocked(activateOrgServiceAction).mockResolvedValue({ success: false, error: 'Service already activated' })
    render(<ServiceEditor orgId={service.organization_id} mappings={[service.service_code_mapping]} />)
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Service mapping/ }))
    fireEvent.click(screen.getByRole('option', { name: /Synthetic mapping/ }))
    fireEvent.click(screen.getByLabelText('Requires clinical approval'))
    fireEvent.click(screen.getByRole('button', { name: 'Activate service' }))
    await waitFor(() => expect(activateOrgServiceAction).toHaveBeenCalledWith({
      organizationId: service.organization_id, service_code_mapping_id: service.service_code_mapping_id,
      local_service_name: null, requires_clinical_approval: true,
    }))
    expect(await screen.findByText('Service already activated')).toBeInTheDocument()
  })

  it('reloads a service page using the active organization', async () => {
    vi.mocked(listOrgServicesAction).mockResolvedValue({ success: true, data: { rows: [], rowCount: 0 } })
    render(<ServiceList orgId={service.organization_id} canManage initialPage={{ rows: [service], rowCount: 1 }} initialPaginationModel={pagination} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(listOrgServicesAction).toHaveBeenCalledWith(service.organization_id, pagination))
  })

  it('sends service edits without financial fields', async () => {
    vi.mocked(updateOrgServiceAction).mockResolvedValue({ success: false, error: 'Unable to save.' })
    render(<ServiceEditor orgId={service.organization_id} service={service} mappings={[]} />)
    fireEvent.change(screen.getByLabelText('Local service name'), { target: { value: 'Updated service' } })
    fireEvent.click(screen.getByLabelText('Enabled'))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(updateOrgServiceAction).toHaveBeenCalledWith({
      organizationId: service.organization_id, organizationServiceId: service.id,
      local_service_name: 'Updated service', requires_clinical_approval: false, enabled: false,
    }))
    expect(await screen.findByText('Unable to save.')).toBeInTheDocument()
  })
})
