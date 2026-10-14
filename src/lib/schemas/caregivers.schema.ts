import { z } from 'zod'
import { COMMON_LANGUAGES } from '@/lib/schemas/patients.schema'
import { CAREGIVER_CLASSIFICATIONS, CREDENTIAL_TYPES } from '@/types'
import type { CaregiverCredentialSummary, CaregiverSkill, CredentialHealth } from '@/types'

const classificationEnum = z.enum(CAREGIVER_CLASSIFICATIONS)
const employmentStatusEnum = z.enum(['Active', 'Inactive', 'Suspended', 'Terminated'] as const)
const matchingStatusEnum = z.enum(['Active', 'Inactive', 'Suspended'] as const)
const credentialTypeEnum = z.enum(CREDENTIAL_TYPES)
const credentialStatusEnum = z.enum(['Active', 'Expired', 'Pending', 'Revoked'] as const)
const availabilityStatusEnum = z.enum(['Available', 'Unavailable', 'Preferred'] as const)
const rateUnitEnum = z.enum(['Hour', 'Visit', 'Unit'] as const)

export const CAREGIVER_EMPLOYMENT_STATUSES = employmentStatusEnum.options
export const CAREGIVER_MATCHING_STATUSES = matchingStatusEnum.options
export const CAREGIVER_CREDENTIAL_STATUSES = credentialStatusEnum.options
export const CAREGIVER_AVAILABILITY_STATUSES = availabilityStatusEnum.options
export const CAREGIVER_RATE_UNITS = rateUnitEnum.options

// Caregiver list status filter: the matching statuses plus the archived state,
// which is stored as `archived_at` rather than a status value.
export const CAREGIVER_STATUS_FILTERS = [...CAREGIVER_MATCHING_STATUSES, 'Archived'] as const

export type CaregiverStatusFilter = (typeof CAREGIVER_STATUS_FILTERS)[number]

export const CREDENTIAL_EXPIRY_WINDOW_DAYS = 30

const uuidShape = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Invalid UUID',
)

const dateShape = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
const timeShape = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Invalid time format (HH:MM)')
const zipShape = z.string().regex(/^\d{5}$/, 'ZIP code must be 5 digits')

// ─── Create Caregiver ─────────────────────────────────────────────────────────

export const CreateCaregiverSchema = z.object({
  organizationId: uuidShape,
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  classification: classificationEnum,
  email: z.string().email('Invalid email address').nullable().optional(),
  phone: z.string().nullable().optional(),
  employee_external_id: z.string().nullable().optional(),
  max_hours_per_week: z.number().min(0).max(168).nullable().optional(),
  service_area_zip: zipShape.nullable().optional(),
  travel_radius_miles: z.number().min(0).max(200).nullable().optional(),
}).strict()

export type CreateCaregiverInput = z.infer<typeof CreateCaregiverSchema>

// ─── Update Caregiver ─────────────────────────────────────────────────────────

export const UpdateCaregiverSchema = z.object({
  organizationId: uuidShape,
  caregiverId: uuidShape,
  first_name: z.string().min(1, 'First name is required').optional(),
  last_name: z.string().min(1, 'Last name is required').optional(),
  classification: classificationEnum.optional(),
  email: z.string().email('Invalid email address').nullable().optional(),
  phone: z.string().nullable().optional(),
  employee_external_id: z.string().nullable().optional(),
  max_hours_per_week: z.number().min(0).max(168).nullable().optional(),
  service_area_zip: zipShape.nullable().optional(),
  travel_radius_miles: z.number().min(0).max(200).nullable().optional(),
  employment_status: employmentStatusEnum.optional(),
  matching_status: matchingStatusEnum.optional(),
}).strict().refine(
  (obj) => Object.keys(obj).length > 2, // control fields + at least one data field
  'At least one field must be updated',
)

export type UpdateCaregiverInput = z.infer<typeof UpdateCaregiverSchema>

// ─── Archive Caregiver ────────────────────────────────────────────────────────

export const ArchiveCaregiverSchema = z.object({
  organizationId: uuidShape,
  caregiverId: uuidShape,
}).strict()

export type ArchiveCaregiverInput = z.infer<typeof ArchiveCaregiverSchema>

// ─── Credential ───────────────────────────────────────────────────────────────

export const UpsertCredentialSchema = z.object({
  organizationId: uuidShape,
  caregiverId: uuidShape,
  credentialId: uuidShape.optional(),
  credential_type: credentialTypeEnum,
  credential_name: z.string().min(1, 'Credential name is required'),
  // TODO(encrypt-credential-number): stored as-is for MVP; encrypt before production PHI use.
  credential_number: z.string().nullable().optional(),
  issued_date: dateShape.nullable().optional(),
  expiration_date: dateShape.nullable().optional(),
  status: credentialStatusEnum,
}).strict().refine(
  (obj) => !obj.issued_date || !obj.expiration_date || obj.expiration_date >= obj.issued_date,
  'Expiration date must be on or after the issued date',
)

export type UpsertCredentialInput = z.infer<typeof UpsertCredentialSchema>

export const VerifyCredentialSchema = z.object({
  organizationId: uuidShape,
  caregiverId: uuidShape,
  credentialId: uuidShape,
}).strict()

export type VerifyCredentialInput = z.infer<typeof VerifyCredentialSchema>

export const RevokeCredentialSchema = VerifyCredentialSchema

export type RevokeCredentialInput = z.infer<typeof RevokeCredentialSchema>

// ─── Skill ────────────────────────────────────────────────────────────────────
// Caregiver skills mirror the patient requirement reform: the UI only offers the
// operational choices that matching uses (Language, Gender, Lifting). Internal
// skill codes are derived here, never typed by the user.

const caregiverSkillTypeEnum = z.enum(['Language', 'Gender', 'Lifting'] as const)

export const CAREGIVER_SKILL_TYPES = caregiverSkillTypeEnum.options
export const CAREGIVER_LANGUAGES = COMMON_LANGUAGES
export const CAREGIVER_LIFTING_CAPACITIES = [150, 200, 250] as const

export type CaregiverSkillType = (typeof CAREGIVER_SKILL_TYPES)[number]

const SKILL_CODE_PREFIX: Record<CaregiverSkillType, string> = {
  Language: 'LANGUAGE',
  Gender: 'GENDER',
  Lifting: 'CAREGIVER_LIFTING_MAX_LB',
}

export function buildCaregiverSkill(
  skillType: CaregiverSkillType,
  selection: string,
  otherLanguage: string,
  otherWeight: string,
): { skill_code: string; skill_name: string } {
  if (skillType === 'Language') {
    const language = selection === 'Other' ? otherLanguage.trim() : selection
    return { skill_code: `${SKILL_CODE_PREFIX.Language}:${language}`, skill_name: language }
  }

  if (skillType === 'Gender') {
    return { skill_code: `${SKILL_CODE_PREFIX.Gender}:${selection.toUpperCase()}`, skill_name: selection }
  }

  const maximumLiftingLbs = Number(selection === 'Other' ? otherWeight : selection)
  return {
    skill_code: `${SKILL_CODE_PREFIX.Lifting}:${maximumLiftingLbs}`,
    skill_name: `Lift a patient weighing at least ${maximumLiftingLbs} lb`,
  }
}

export function getCaregiverSkillType(skillCode: string): CaregiverSkillType | null {
  const entry = (Object.entries(SKILL_CODE_PREFIX) as [CaregiverSkillType, string][]).find(
    ([, prefix]) => skillCode.startsWith(`${prefix}:`),
  )
  return entry ? entry[0] : null
}

export function getCaregiverSkillValue(skillCode: string): string {
  const separatorIndex = skillCode.indexOf(':')
  return separatorIndex === -1 ? '' : skillCode.slice(separatorIndex + 1)
}

export function getCaregiverSkillDisplayValue(
  skill: Pick<CaregiverSkill, 'skill_code' | 'skill_name'>,
): string {
  const skillType = getCaregiverSkillType(skill.skill_code)
  const value = getCaregiverSkillValue(skill.skill_code)

  if (skillType === 'Language') return value || skill.skill_name
  if (skillType === 'Gender') {
    if (!value) return skill.skill_name
    return value.charAt(0) + value.slice(1).toLowerCase()
  }
  if (skillType === 'Lifting' && value) {
    return `Lift a patient weighing at least ${value} lb`
  }

  return skill.skill_name || 'Details not available'
}

const skillCodeShape = z.string().regex(
  /^(LANGUAGE|GENDER|CAREGIVER_LIFTING_MAX_LB):.+$/,
  'Unsupported skill code',
)

export const UpsertSkillSchema = z.object({
  organizationId: uuidShape,
  caregiverId: uuidShape,
  skillId: uuidShape.optional(),
  skill_code: skillCodeShape,
  skill_name: z.string().min(1, 'Skill name is required'),
  verified_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
}).strict()

export type UpsertSkillInput = z.infer<typeof UpsertSkillSchema>

export const DeactivateSkillSchema = z.object({
  organizationId: uuidShape,
  caregiverId: uuidShape,
  skillId: uuidShape,
}).strict()

export type DeactivateSkillInput = z.infer<typeof DeactivateSkillSchema>

// ─── Service Eligibility ──────────────────────────────────────────────────────

export const UpsertServiceEligibilitySchema = z.object({
  organizationId: uuidShape,
  caregiverId: uuidShape,
  organization_service_id: uuidShape,
  supervision_required: z.boolean().optional(),
}).strict()

export type UpsertServiceEligibilityInput = z.infer<typeof UpsertServiceEligibilitySchema>

export const DeactivateServiceEligibilitySchema = z.object({
  organizationId: uuidShape,
  caregiverId: uuidShape,
  eligibilityId: uuidShape,
}).strict()

export type DeactivateServiceEligibilityInput = z.infer<typeof DeactivateServiceEligibilitySchema>

// ─── Availability ─────────────────────────────────────────────────────────────

export const UpsertAvailabilitySchema = z.object({
  organizationId: uuidShape,
  caregiverId: uuidShape,
  day_of_week: z.number().int().min(0, 'Invalid day of week').max(6, 'Invalid day of week'),
  start_time: timeShape,
  end_time: timeShape,
  availability_status: availabilityStatusEnum,
  effective_start_date: dateShape,
  effective_end_date: dateShape.nullable().optional(),
}).strict().refine(
  (obj) => obj.end_time > obj.start_time,
  'End time must be after start time',
).refine(
  (obj) => !obj.effective_end_date || obj.effective_end_date >= obj.effective_start_date,
  'Effective end date must be on or after the effective start date',
)

export type UpsertAvailabilityInput = z.infer<typeof UpsertAvailabilitySchema>

export const DeactivateAvailabilitySchema = z.object({
  organizationId: uuidShape,
  caregiverId: uuidShape,
  availabilityId: uuidShape,
}).strict()

export type DeactivateAvailabilityInput = z.infer<typeof DeactivateAvailabilitySchema>

// ─── Compensation ─────────────────────────────────────────────────────────────

export const SetCompensationRateSchema = z.object({
  organizationId: uuidShape,
  caregiverId: uuidShape,
  pay_rate: z.number().positive('Pay rate must be greater than zero').refine(
    (value) => Number.isInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    'Pay rate supports at most 2 decimal places',
  ),
  rate_unit: rateUnitEnum,
  effective_start_date: dateShape,
  organization_service_id: uuidShape.nullable().optional(),
}).strict()

export type SetCompensationRateInput = z.infer<typeof SetCompensationRateSchema>

// ─── Credential health (pure — shared by service, pages, and components) ──────

function toUtcDays(value: string): number {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return Math.floor(Date.UTC(year, (month ?? 1) - 1, day ?? 1) / 86_400_000)
}

export function getCredentialHealth(
  credentials: readonly Pick<CaregiverCredentialSummary, 'status' | 'expiration_date'>[],
  todayDate: string = new Date().toISOString().slice(0, 10),
  windowDays: number = CREDENTIAL_EXPIRY_WINDOW_DAYS,
): CredentialHealth {
  const relevant = credentials.filter((credential) => credential.status !== 'Revoked')

  if (relevant.length === 0) return 'Missing'

  const todayDays = toUtcDays(todayDate)

  const isExpired = relevant.some((credential) => {
    if (credential.status === 'Expired') return true
    return credential.expiration_date !== null && toUtcDays(credential.expiration_date) < todayDays
  })

  if (isExpired) return 'Expired'

  const isExpiringSoon = relevant.some((credential) => {
    if (credential.expiration_date === null) return false
    const daysRemaining = toUtcDays(credential.expiration_date) - todayDays
    return daysRemaining >= 0 && daysRemaining <= windowDays
  })

  return isExpiringSoon ? 'Expiring Soon' : 'OK'
}
