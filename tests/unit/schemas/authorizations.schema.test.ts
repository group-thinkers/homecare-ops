import { describe, expect, it } from 'vitest'
import {
  ActivateOrgServiceSchema,
  AuthorizationServiceInputSchema,
  CreateAuthorizationSchema,
  SetOrganizationServiceRateSchema,
  UpdateAuthorizationSchema,
  UpsertPayerSchema,
} from '@/lib/schemas/authorizations.schema'

const ORG_ID = '00000000-0000-0000-0000-000000000001'
const PATIENT_ID = '00000000-0000-0000-0000-000000000002'
const PAYER_ID = '00000000-0000-0000-0000-000000000003'
const SERVICE_ID = '00000000-0000-0000-0000-000000000004'
const AUTHORIZATION_ID = '00000000-0000-0000-0000-000000000005'

describe('authorization schemas', () => {
  it('validates payer and organization service inputs', () => {
    expect(UpsertPayerSchema.safeParse({
      organizationId: ORG_ID,
      payer_name: 'Example Medicaid',
      payer_type: 'Medicaid',
    }).success).toBe(true)
    expect(UpsertPayerSchema.safeParse({
      organizationId: ORG_ID,
      payer_name: 'Example Medicaid',
      payer_type: 'Not a payer',
    }).success).toBe(false)
    expect(ActivateOrgServiceSchema.safeParse({
      organizationId: ORG_ID,
      service_code_mapping_id: SERVICE_ID,
    }).success).toBe(true)
  })

  it('enforces authorization dates and service quantity', () => {
    const service = {
      organization_service_id: SERVICE_ID,
      authorized_quantity: 10,
      quantity_unit: 'Hours' as const,
      quantity_period: 'Week' as const,
      rate_unit: 'Hour' as const,
    }
    expect(AuthorizationServiceInputSchema.safeParse(service).success).toBe(true)
    expect(AuthorizationServiceInputSchema.safeParse({ ...service, authorized_quantity: 0 }).success).toBe(false)
    expect(CreateAuthorizationSchema.safeParse({
      organizationId: ORG_ID,
      patientId: PATIENT_ID,
      payer_id: PAYER_ID,
      authorization_start_date: '2026-10-01',
      authorization_end_date: '2026-10-31',
      services: [service],
    }).success).toBe(true)
    expect(CreateAuthorizationSchema.safeParse({
      organizationId: ORG_ID,
      patientId: PATIENT_ID,
      payer_id: PAYER_ID,
      authorization_start_date: '2026-10-31',
      authorization_end_date: '2026-10-01',
    }).success).toBe(false)
  })

  it('requires an authorization update field and rejects unknown fields', () => {
    expect(UpdateAuthorizationSchema.safeParse({
      organizationId: ORG_ID,
      patientId: PATIENT_ID,
      authorizationId: AUTHORIZATION_ID,
    }).success).toBe(false)
    expect(UpdateAuthorizationSchema.safeParse({
      organizationId: ORG_ID,
      patientId: PATIENT_ID,
      authorizationId: AUTHORIZATION_ID,
      status: 'Suspended',
      unexpected: true,
    }).success).toBe(false)
  })

  it('validates a prospective organization-service rate change', () => {
    expect(SetOrganizationServiceRateSchema.safeParse({
      organizationId: ORG_ID,
      organizationServiceId: SERVICE_ID,
      reimbursement_rate: 24.5,
      rate_unit: 'Hour',
      effective_start_date: '2026-10-01',
      change_reason: 'Annual payer update',
    }).success).toBe(true)
    expect(SetOrganizationServiceRateSchema.safeParse({
      organizationId: ORG_ID,
      organizationServiceId: SERVICE_ID,
      reimbursement_rate: 24.5,
      rate_unit: 'Hour',
      effective_start_date: '2026-10-01',
      change_reason: ' ',
    }).success).toBe(false)
  })
})
