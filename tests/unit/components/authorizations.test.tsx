import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PatientAuthorizationDetail } from '@/types'

const mocks = vi.hoisted(() => ({
  push: vi.fn(), refresh: vi.fn(), show: vi.fn(), confirm: vi.fn(),
  create: vi.fn(), update: vi.fn(), upsert: vi.fn(), archive: vi.fn(), deactivate: vi.fn(),
  auth: vi.fn(), membership: vi.fn(), permission: vi.fn(), anyPermission: vi.fn(), list: vi.fn(), detail: vi.fn(), options: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }), redirect: vi.fn() }))
vi.mock('@/components/templates/crud-dashboard/components/PageContainer', () => ({
  default: ({ children, title, actions }: { children: React.ReactNode; title: string; actions?: React.ReactNode }) =>
    <div><h1>{title}</h1>{actions}{children}</div>,
}))
vi.mock('@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications', () => ({ default: () => ({ show: mocks.show }) }))
vi.mock('@/components/templates/crud-dashboard/hooks/useDialogs/useDialogs', () => ({ useDialogs: () => ({ confirm: mocks.confirm }) }))
vi.mock('@/app/(dashboard)/patients/actions', () => ({
  createAuthorizationAction: mocks.create, updateAuthorizationAction: mocks.update,
  upsertAuthorizationServiceAction: mocks.upsert, archiveAuthorizationAction: mocks.archive,
  deactivateAuthorizationServiceAction: mocks.deactivate, listPatientAuthorizationsAction: mocks.list,
  getAuthorizationAction: mocks.detail, listAuthorizationFormOptionsAction: mocks.options,
}))
vi.mock('@/lib/auth/server', () => ({ requireAuth: mocks.auth, getActiveMembership: mocks.membership }))
vi.mock('@/lib/permissions', () => ({
  hasPermission: mocks.permission,
  hasAnyPermission: mocks.anyPermission,
}))

import AuthorizationDetail from '@/app/(dashboard)/patients/_components/AuthorizationDetail'
import AuthorizationForm from '@/app/(dashboard)/patients/_components/AuthorizationForm'
import { renderAuthorizationPage } from '@/app/(dashboard)/patients/[patientId]/authorization/route-content'

const authorization = {
  id: 'auth', organization_id: 'org', patient_id: 'patient', payer_id: 'payer',
  masked_prior_auth_number: '***1234', authorization_start_date: '2026-01-01',
  authorization_end_date: '2026-12-31', status: 'Active', effective_status: 'Active',
  archived_at: null, payer: { payer_name: 'Synthetic payer', payer_type: 'Medicaid' },
  service_count: 1,
  services: [{
    id: 'line', organization_service_id: 'service', authorized_quantity: 5, quantity_unit: 'Hours',
    quantity_period: 'Week', effective_start_date: '2026-01-01', effective_end_date: '2026-12-31',
    active: true, service_requirement_code: null, organization_service: { local_service_name: 'Synthetic service' },
    effective_rate: null,
  }],
} as PatientAuthorizationDetail

const options = {
  payers: [{ id: 'payer', payer_name: 'Synthetic payer', payer_type: 'Medicaid' as const, status: 'Active' as const }],
  organizationServices: [{
    id: 'service', enabled: true, local_service_name: 'Synthetic service',
    service_code_mapping: { billing_service: { service_name: 'Synthetic service', billing_code: 'CODE' } },
  }] as Parameters<typeof AuthorizationForm>[0]['options']['organizationServices'],
}

describe('authorization UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.confirm.mockResolvedValue(true)
    mocks.auth.mockResolvedValue({ id: 'user' })
    mocks.membership.mockResolvedValue({ organization_id: 'org' })
    mocks.permission.mockResolvedValue(false)
    mocks.anyPermission.mockImplementation(async (orgId: string, permissions: string[]) => {
      const results = await Promise.all(permissions.map((permission) => mocks.permission(orgId, permission)))
      return results.some(Boolean)
    })
  })

  it('renders masked numbers and hides financial values and mutations from read-only users', () => {
    render(<AuthorizationDetail orgId="org" patientId="patient" authorization={authorization} canManage={false} />)
    expect(screen.getByText('Authorization number: ***1234')).toBeInTheDocument()
    expect(screen.queryByText(/Effective rate:/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /archive|edit|deactivate|add service/i })).not.toBeInTheDocument()
  })

  it('shows only a supplied effective rate and deactivates with membership organization', async () => {
    const withRate = { ...authorization, services: [{ ...authorization.services[0], effective_rate: { rate: 12, rate_unit: 'Hour' as const, source: 'authorization' as const } }] }
    mocks.deactivate.mockResolvedValue({ success: true })
    render(<AuthorizationDetail orgId="org" patientId="patient" authorization={withRate} canManage />)
    expect(screen.getByText('Effective rate: 12 / Hour')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(mocks.deactivate).toHaveBeenCalledWith({
      organizationId: 'org', patientId: 'patient', authorizationId: 'auth', authorizationServiceId: 'line',
    }))
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it('loads additional service lines in bounded pages', async () => {
    const firstPage = Array.from({ length: 25 }, (_, index) => ({
      ...authorization.services[0],
      id: `line-${index}`,
      organization_service: { local_service_name: `Service ${index}` },
    }))
    const lastLine = {
      ...authorization.services[0],
      id: 'line-25',
      organization_service: { local_service_name: 'Service 25' },
    }
    mocks.detail.mockResolvedValue({
      success: true,
      data: { ...authorization, services: [lastLine], service_count: 26 },
    })
    render(<AuthorizationDetail
      orgId="org"
      patientId="patient"
      authorization={{ ...authorization, services: firstPage, service_count: 26 }}
      canManage={false}
    />)
    fireEvent.click(screen.getByRole('button', { name: 'Load more service lines (25/26)' }))
    await waitFor(() => expect(screen.getByText('Service 25')).toBeInTheDocument())
    expect(mocks.detail).toHaveBeenCalledWith('org', 'patient', 'auth', undefined, 25)
  })

  it('preserves a returned authorization override when editing a service line', async () => {
    const line = { ...authorization.services[0], effective_rate: { rate: 12, rate_unit: 'Hour' as const, source: 'authorization' as const } }
    mocks.upsert.mockResolvedValue({ success: true })
    render(<AuthorizationForm orgId="org" patientId="patient" options={options} authorization={authorization} service={line} serviceForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org', patientId: 'patient', authorizationId: 'auth', authorizationServiceId: 'line',
      reimbursement_rate: 12, rate_unit: 'Hour',
    })))
  })

  it('blocks editing if the rate is hidden to avoid erasing it', () => {
    render(<AuthorizationForm orgId="org" patientId="patient" options={options} authorization={authorization} service={authorization.services[0]} serviceForm />)
    expect(screen.getByText(/could overwrite an existing rate/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('keeps the selected inactive payer available when editing an authorization', () => {
    const inactiveOptions = {
      ...options,
      payers: [{ id: 'payer', payer_name: 'Synthetic payer', payer_type: 'Medicaid' as const, status: 'Inactive' as const }],
    }
    render(<AuthorizationForm orgId="org" patientId="patient" options={inactiveOptions} authorization={authorization} />)

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Payer/ }))
    expect(screen.getByRole('option', { name: 'Synthetic payer (Inactive)' })).toBeInTheDocument()
  })

  it('keeps an existing disabled organization service available when editing a service line', () => {
    const disabledOptions = {
      ...options,
      organizationServices: options.organizationServices.map((item) => ({ ...item, enabled: false })),
    }
    render(
      <AuthorizationForm
        orgId="org"
        patientId="patient"
        options={disabledOptions}
        authorization={authorization}
        service={authorization.services[0]}
        serviceForm
      />,
    )

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Service' }))
    expect(screen.getByRole('option', { name: 'Synthetic service (CODE)' })).toBeInTheDocument()
  })

  it('creates an authorization and nested service line in one submission', async () => {
    mocks.create.mockResolvedValue({ success: true, data: 'created' })
    render(<AuthorizationForm orgId="org" patientId="patient" options={options} />)
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Payer/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Synthetic payer' }))
    fireEvent.change(screen.getByLabelText(/Start date/), { target: { value: '2026-01-01' } })
    fireEvent.change(screen.getByLabelText(/End date/), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add service line' }))
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Service 1/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Synthetic service (CODE)' }))
    fireEvent.change(screen.getByLabelText(/Authorized quantity 1/), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org', patientId: 'patient', payer_id: 'payer',
      services: [expect.objectContaining({ organization_service_id: 'service', authorized_quantity: 5 })],
    })))
    expect(mocks.push).toHaveBeenCalledWith('/patients/patient/authorization/created')
  })

  it('permits scheduler reads but denies scheduler mutation routes', async () => {
    mocks.permission.mockImplementation(async (_org, permission) => permission === 'shifts.manage')
    mocks.detail.mockResolvedValue({ success: true, data: authorization })
    const read = await renderAuthorizationPage({ patientId: 'patient', authorizationId: 'auth', mode: 'detail' })
    expect(read.type).toBe(AuthorizationDetail)
    expect(read.props.canManage).toBe(false)
    expect(mocks.detail).toHaveBeenCalledWith('org', 'patient', 'auth', undefined, 0, null)
    const edit = await renderAuthorizationPage({ patientId: 'patient', authorizationId: 'auth', mode: 'edit' })
    expect(edit.type).not.toBe(AuthorizationForm)
    expect(mocks.options).not.toHaveBeenCalled()
  })

  it('resolves service overrides on the line start date when editing', async () => {
    mocks.permission.mockResolvedValue(true)
    mocks.detail.mockResolvedValue({ success: true, data: authorization })
    mocks.options.mockResolvedValue({ success: true, data: options })
    await renderAuthorizationPage({ patientId: 'patient', authorizationId: 'auth', serviceId: 'line', mode: 'service-edit' })
    expect(mocks.detail).toHaveBeenNthCalledWith(1, 'org', 'patient', 'auth', undefined, 0, 'line')
    expect(mocks.detail).toHaveBeenLastCalledWith('org', 'patient', 'auth', '2026-01-01', 0, 'line')
  })
})
