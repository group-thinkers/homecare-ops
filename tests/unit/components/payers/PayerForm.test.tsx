import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PayerForm, { type PayerFormState } from '@/app/(dashboard)/settings/payers/_components/PayerForm'

const formState: PayerFormState = {
  values: {
    payer_name: 'Synthetic Plan',
    payer_type: 'Medicaid',
    program_name: 'Test Program',
    status: 'Active',
  },
  errors: {},
}

describe('PayerForm', () => {
  it('renders controlled payer fields and forwards field changes', () => {
    const onProgramNameChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <PayerForm
        formState={formState}
        hasChanges
        submitLabel="Save payer"
        onPayerNameChange={vi.fn()}
        onPayerTypeChange={vi.fn()}
        onProgramNameChange={onProgramNameChange}
        onStatusChange={vi.fn()}
        onSubmit={onSubmit}
        onReset={vi.fn()}
        onBackClick={vi.fn()}
      />,
    )

    expect(screen.getByRole('textbox', { name: /Payer name/ })).toHaveValue('Synthetic Plan')
    fireEvent.change(screen.getByRole('textbox', { name: 'Program name' }), {
      target: { value: 'Updated Program' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save payer' }))

    expect(onProgramNameChange).toHaveBeenCalledWith('Updated Program')
    expect(onSubmit).toHaveBeenCalledWith(formState.values)
  })
})
