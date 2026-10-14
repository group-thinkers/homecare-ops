import { describe, expect, it } from 'vitest'
import { ALLOWED_AUTH_TRANSITIONS, pickEffectiveRate } from '@/lib/services/authorizations.service'

describe('authorization service pure logic', () => {
  it('uses the authorization rate only inside its effective range', () => {
    const authorizationService = {
      reimbursement_rate: 25,
      rate_unit: 'Hour' as const,
      effective_start_date: '2026-10-01',
      effective_end_date: '2026-10-31',
    }
    const organizationRate = { reimbursement_rate: 20, rate_unit: 'Hour' as const }
    expect(pickEffectiveRate(authorizationService, organizationRate, '2026-10-15')).toEqual({
      rate: 25,
      rate_unit: 'Hour',
      source: 'authorization',
    })
    expect(pickEffectiveRate(authorizationService, organizationRate, '2026-11-01')).toEqual({
      rate: 20,
      rate_unit: 'Hour',
      source: 'organization_default',
    })
  })

  it('returns missing when neither authorization nor organization has a rate', () => {
    expect(pickEffectiveRate(
      { reimbursement_rate: null, rate_unit: 'Visit', effective_start_date: '2026-10-01', effective_end_date: '2026-10-31' },
      null,
      '2026-10-15',
    )).toEqual({ rate: null, rate_unit: null, source: 'missing' })
  })

  it('defines only permitted status transitions', () => {
    expect(ALLOWED_AUTH_TRANSITIONS.Active).toContain('Suspended')
    expect(ALLOWED_AUTH_TRANSITIONS.Expired).toEqual([])
    expect(ALLOWED_AUTH_TRANSITIONS['Under Review']).not.toContain('Suspended')
  })
})
