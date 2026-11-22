import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }))
vi.mock('@/components/templates/crud-dashboard/hooks/useNotifications/useNotifications', () => ({
  default: () => ({ show: vi.fn() }),
}))

import { useRouter } from 'next/navigation'
import CompensationForm from '@/app/(dashboard)/caregivers/_components/CompensationForm'
import type { Caregiver, OrganizationServiceWithMapping } from '@/types'

const mockUseRouter = useRouter as ReturnType<typeof vi.fn>
const caregiver: Caregiver = {
  id: '00000000-0000-0000-0000-000000000001',
  organization_id: '00000000-0000-0000-0000-000000000002',
  employee_external_id: null,
  first_name: 'Synthetic',
  last_name: 'Caregiver',
  email: null,
  phone: null,
  classification: 'HHA',
  employment_status: 'Active',
  max_hours_per_week: null,
  service_area_zip: null,
  travel_radius_miles: null,
  matching_status: 'Active',
  created_at: '2026-01-01T00:00:00.000Z',
  created_by_user_id: '00000000-0000-0000-0000-000000000003',
  updated_at: null,
  updated_by_user_id: null,
  archived_at: null,
}
const organizationService: OrganizationServiceWithMapping = {
  id: '00000000-0000-0000-0000-000000000004',
  organization_id: caregiver.organization_id,
  service_code_mapping_id: '00000000-0000-0000-0000-000000000005',
  local_service_name: 'Synthetic personal care',
  requires_clinical_approval: false,
  enabled: true,
  created_at: '2026-01-01T00:00:00.000Z',
  created_by_user_id: '00000000-0000-0000-0000-000000000003',
  updated_at: null,
  updated_by_user_id: null,
  service_code_mapping: {
    id: '00000000-0000-0000-0000-000000000005',
    evv_service_id: 'synthetic-personal-care',
    evv_service_name: 'Personal care',
    payer_type: 'Medicaid',
    program_name: null,
    billing_service: {
      billing_code: 'SYNTHETIC',
      service_name: 'Personal care',
      service_category: 'Other',
    },
  },
}

describe('CompensationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseRouter.mockReturnValue({ push: vi.fn(), refresh: vi.fn() })
  })

  it('offers active organization services by name instead of accepting a raw service ID', () => {
    render(
      <CompensationForm
        caregiver={caregiver}
        orgId={caregiver.organization_id}
        organizationServices={[organizationService]}
      />,
    )

    expect(screen.queryByLabelText('Organization Service ID (optional)')).not.toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Organization Service (optional)' }))
    expect(screen.getByRole('option', { name: 'Caregiver default rate' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Synthetic personal care' })).toBeInTheDocument()
  })
})
