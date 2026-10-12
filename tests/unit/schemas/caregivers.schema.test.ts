import { describe, expect, it } from 'vitest'

// TODO: defer service eligibility test until I figure out what to do with it
import {
  ArchiveCaregiverSchema,
  buildCaregiverSkill,
  CreateCaregiverSchema,
  DeactivateAvailabilitySchema,
  DeactivateSkillSchema,
  getCaregiverSkillDisplayValue,
  getCaregiverSkillType,
  getCaregiverSkillValue,
  getCredentialHealth,
  SetCompensationRateSchema,
  UpdateCaregiverSchema,
  UpsertAvailabilitySchema,
  UpsertCredentialSchema,
  UpsertSkillSchema,
  VerifyCredentialSchema,
} from '@/lib/schemas/caregivers.schema'

const ORG_ID = '00000000-0000-0000-0000-000000000001'
const CAREGIVER_ID = '00000000-0000-0000-0000-000000000002'
const CHILD_ID = '00000000-0000-0000-0000-000000000003'

describe('caregiver profile schemas', () => {
  const createInput = {
    organizationId: ORG_ID,
    first_name: 'Ada',
    last_name: 'Caregiver',
    classification: 'HHA' as const,
  }

  it('parses valid create, update, and archive inputs', () => {
    expect(CreateCaregiverSchema.parse(createInput)).toEqual(createInput)
    expect(UpdateCaregiverSchema.parse({
      organizationId: ORG_ID,
      caregiverId: CAREGIVER_ID,
      employment_status: 'Inactive',
    }).employment_status).toBe('Inactive')
    expect(ArchiveCaregiverSchema.parse({
      organizationId: ORG_ID,
      caregiverId: CAREGIVER_ID,
    }).caregiverId).toBe(CAREGIVER_ID)
  })

  it('rejects missing, invalid, or unknown profile data', () => {
    expect(CreateCaregiverSchema.safeParse({ ...createInput, first_name: '' }).success).toBe(false)
    expect(CreateCaregiverSchema.safeParse({ ...createInput, classification: 'CNA' }).success).toBe(false)
    expect(CreateCaregiverSchema.safeParse({ ...createInput, service_area_zip: '1234' }).success).toBe(false)
    expect(CreateCaregiverSchema.safeParse({ ...createInput, extra: true }).success).toBe(false)
    expect(UpdateCaregiverSchema.safeParse({ organizationId: ORG_ID, caregiverId: CAREGIVER_ID }).success).toBe(false)
  })
})

describe('credential schemas', () => {
  const input = {
    organizationId: ORG_ID,
    caregiverId: CAREGIVER_ID,
    credential_type: 'CPR' as const,
    credential_name: 'CPR Certification',
    issued_date: '2026-01-01',
    expiration_date: '2027-01-01',
    status: 'Active' as const,
  }

  it('parses valid credential and verification inputs', () => {
    expect(UpsertCredentialSchema.parse(input)).toEqual(input)
    expect(VerifyCredentialSchema.parse({
      organizationId: ORG_ID,
      caregiverId: CAREGIVER_ID,
      credentialId: CHILD_ID,
    }).credentialId).toBe(CHILD_ID)
  })

  it('rejects invalid status, reversed dates, and unknown fields', () => {
    expect(UpsertCredentialSchema.safeParse({ ...input, status: 'Verified' }).success).toBe(false)
    expect(UpsertCredentialSchema.safeParse({
      ...input,
      expiration_date: '2025-12-31',
    }).success).toBe(false)
    expect(UpsertCredentialSchema.safeParse({ ...input, extra: true }).success).toBe(false)
  })
})

describe('skill schemas and helpers', () => {
  const input = {
    organizationId: ORG_ID,
    caregiverId: CAREGIVER_ID,
    skill_code: 'LANGUAGE:Spanish',
    skill_name: 'Spanish',
  }

  it('builds canonical language, gender, and lifting skills', () => {
    expect(buildCaregiverSkill('Language', 'Other', 'Arabic', '')).toEqual({
      skill_code: 'LANGUAGE:Arabic',
      skill_name: 'Arabic',
    })
    expect(buildCaregiverSkill('Gender', 'Female', '', '')).toEqual({
      skill_code: 'GENDER:FEMALE',
      skill_name: 'Female',
    })
    expect(buildCaregiverSkill('Lifting', 'Other', '', '175')).toEqual({
      skill_code: 'CAREGIVER_LIFTING_MAX_LB:175',
      skill_name: 'Lift a patient weighing at least 175 lb',
    })
  })

  it('parses supported codes and rejects unsupported code prefixes', () => {
    expect(UpsertSkillSchema.parse(input)).toEqual(input)
    expect(UpsertSkillSchema.safeParse({ ...input, skill_code: 'CERTIFICATION:CPR' }).success).toBe(false)
    expect(DeactivateSkillSchema.safeParse({
      organizationId: ORG_ID,
      caregiverId: CAREGIVER_ID,
      skillId: CHILD_ID,
      extra: true,
    }).success).toBe(false)
  })

  it('derives skill display values without exposing code syntax', () => {
    expect(getCaregiverSkillType('GENDER:FEMALE')).toBe('Gender')
    expect(getCaregiverSkillType('UNKNOWN:value')).toBeNull()
    expect(getCaregiverSkillValue('LANGUAGE:Spanish')).toBe('Spanish')
    expect(getCaregiverSkillValue('LANGUAGE')).toBe('')
    expect(getCaregiverSkillDisplayValue({
      skill_code: 'CAREGIVER_LIFTING_MAX_LB:200',
      skill_name: 'ignored',
    })).toBe('Lift a patient weighing at least 200 lb')
  })
})

describe('availability and compensation schemas', () => {
  const availability = {
    organizationId: ORG_ID,
    caregiverId: CAREGIVER_ID,
    day_of_week: 0,
    start_time: '08:00',
    end_time: '16:00',
    availability_status: 'Available' as const,
    effective_start_date: '2026-01-01',
  }

  it('accepts weekday boundaries and rejects invalid availability ranges', () => {
    expect(UpsertAvailabilitySchema.safeParse(availability).success).toBe(true)
    expect(UpsertAvailabilitySchema.safeParse({ ...availability, day_of_week: 6 }).success).toBe(true)
    expect(UpsertAvailabilitySchema.safeParse({ ...availability, day_of_week: 7 }).success).toBe(false)
    expect(UpsertAvailabilitySchema.safeParse({ ...availability, end_time: '08:00' }).success).toBe(false)
    expect(UpsertAvailabilitySchema.safeParse({
      ...availability,
      effective_end_date: '2025-12-31',
    }).success).toBe(false)
  })

  it('validates availability identifiers and compensation amounts', () => {
    expect(DeactivateAvailabilitySchema.safeParse({
      organizationId: ORG_ID,
      caregiverId: CAREGIVER_ID,
      availabilityId: CHILD_ID,
    }).success).toBe(true)
    const compensation = {
      organizationId: ORG_ID,
      caregiverId: CAREGIVER_ID,
      pay_rate: 24.75,
      rate_unit: 'Hour' as const,
      effective_start_date: '2026-01-01',
    }
    expect(SetCompensationRateSchema.safeParse(compensation).success).toBe(true)
    expect(SetCompensationRateSchema.safeParse({ ...compensation, pay_rate: 0 }).success).toBe(false)
    expect(SetCompensationRateSchema.safeParse({ ...compensation, pay_rate: 24.755 }).success).toBe(false)
    expect(SetCompensationRateSchema.safeParse({ ...compensation, rate_unit: 'Shift' }).success).toBe(false)
  })
})

describe('getCredentialHealth', () => {
  const today = '2026-09-28'

  it.each([
    ['Missing', [], 'Missing'],
    ['Expired status', [{ status: 'Expired', expiration_date: null }], 'Expired'],
    ['past expiration', [{ status: 'Active', expiration_date: '2026-09-27' }], 'Expired'],
    ['within window', [{ status: 'Active', expiration_date: '2026-10-08' }], 'Expiring Soon'],
    ['at window boundary', [{ status: 'Active', expiration_date: '2026-10-28' }], 'Expiring Soon'],
    ['outside window', [{ status: 'Active', expiration_date: '2026-11-27' }], 'OK'],
    ['revoked only', [{ status: 'Revoked', expiration_date: '2026-01-01' }], 'Missing'],
  ] as const)('returns %s for the matching credential state', (_case, credentials, expected) => {
    expect(getCredentialHealth(
        [...credentials] as unknown as Parameters<typeof getCredentialHealth>[0],
        today,
      )).toBe(expected)
  })
})
