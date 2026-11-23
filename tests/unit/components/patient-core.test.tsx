import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

import { useRouter } from 'next/navigation'
import PatientCore from '@/app/(dashboard)/patients/_components/PatientCore'
import type { Patient, PatientAddress, PatientContact, PatientRequirement } from '@/types'

const mockUseRouter = useRouter as ReturnType<typeof vi.fn>
const push = vi.fn()

const ORG_ID = '00000000-0000-0000-0000-000000000001'
const PATIENT_ID = '00000000-0000-0000-0000-000000000002'

const patient: Patient = {
  id: PATIENT_ID,
  organization_id: ORG_ID,
  patient_external_id: null,
  first_name: 'Test',
  middle_name: null,
  last_name: 'Patient',
  date_of_birth: '1990-01-15',
  status: 'Active',
  created_at: '2026-01-01T00:00:00.000Z',
  created_by_user_id: '00000000-0000-0000-0000-000000000003',
  updated_at: null,
  updated_by_user_id: null,
  archived_at: null,
  created_by: {
    id: '00000000-0000-0000-0000-000000000003',
    first_name: 'Test',
    last_name: 'Creator',
  },
}

function makeContact(index: number): PatientContact {
  return {
    id: `00000000-0000-0000-0001-${String(index).padStart(12, '0')}`,
    organization_id: ORG_ID,
    patient_id: PATIENT_ID,
    contact_type: `Contact ${index}`,
    contact_name: `Contact Name ${index}`,
    relationship: null,
    phone: null,
    email: null,
    authorized_contact: false,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    archived_at: null,
  }
}

function makeRequirement(index: number): PatientRequirement {
  return {
    id: `00000000-0000-0000-0002-${String(index).padStart(12, '0')}`,
    organization_id: ORG_ID,
    patient_id: PATIENT_ID,
    requirement_type: 'Language',
    requirement_code: `LANGUAGE:Test ${index}`,
    matching_effect: 'Preferred',
    required_skill_code: null,
    structured_value: { language: `Test Language ${index}` },
    restricted_note_id: null,
    visibility_level: 'Operational',
    effective_start_date: null,
    effective_end_date: null,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: null,
  }
}

describe('PatientCore previews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseRouter.mockReturnValue({ push, refresh: vi.fn() })
  })

  it('renders at most three child rows and links to full tables when a fourth row exists', async () => {
    const contacts = [1, 2, 3, 4].map(makeContact)
    const requirements = [1, 2, 3, 4].map(makeRequirement)

    render(
      <PatientCore
        patient={patient}
        addressesPromise={Promise.resolve([] as PatientAddress[])}
        contactsPromise={Promise.resolve(contacts)}
        requirementsPromise={Promise.resolve(requirements)}
      />,
    )

    expect(await screen.findByText('Contact Name 1')).toBeInTheDocument()
    expect(screen.getByText('Contact Name 3')).toBeInTheDocument()
    expect(screen.queryByText('Contact Name 4')).not.toBeInTheDocument()
    expect(screen.getByText('Test Language 3')).toBeInTheDocument()
    expect(screen.queryByText('Test Language 4')).not.toBeInTheDocument()

    const viewMoreButtons = screen.getAllByRole('button', { name: 'View more' })
    expect(viewMoreButtons).toHaveLength(2)

    fireEvent.click(viewMoreButtons[0])
    expect(push).toHaveBeenCalledWith(`/patients/${PATIENT_ID}/contact`)
  })

  it('hides the authorization section if the read is denied', async () => {
    render(
      <PatientCore patient={patient} addressesPromise={Promise.resolve([])}
        contactsPromise={Promise.resolve([])} requirementsPromise={Promise.resolve([])}
        authorizationsPromise={Promise.resolve({ success: false, error: 'Not authorized.' })} />,
    )
    await waitFor(() => expect(screen.getByText('No contact information on file.')).toBeInTheDocument())
    expect(screen.queryByText('Patient Authorization')).not.toBeInTheDocument()
    expect(screen.queryByText('No authorization information on file.')).not.toBeInTheDocument()
  })
})
