import { z } from 'zod'
import {
  AUTHORIZATION_STATUSES,
  PAYER_TYPES,
  QUANTITY_PERIODS,
  QUANTITY_UNITS,
  RATE_UNITS,
} from '@/types'

const uuidShape = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Invalid UUID',
)
const dateShape = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
const moneyShape = z.number().nonnegative('Amount must not be negative').refine(
  (value) => Number.isInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
  'Amount supports at most 2 decimal places',
)

const payerTypeEnum = z.enum(PAYER_TYPES)
const authorizationStatusEnum = z.enum(AUTHORIZATION_STATUSES)
const quantityUnitEnum = z.enum(QUANTITY_UNITS)
const quantityPeriodEnum = z.enum(QUANTITY_PERIODS)
const rateUnitEnum = z.enum(RATE_UNITS)

export const UpsertPayerSchema = z.object({
  organizationId: uuidShape,
  payerId: uuidShape.optional(),
  payer_name: z.string().trim().min(1, 'Payer name is required'),
  payer_type: payerTypeEnum,
  program_name: z.string().trim().min(1).nullable().optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
}).strict()
export type UpsertPayerInput = z.infer<typeof UpsertPayerSchema>

export const ActivateOrgServiceSchema = z.object({
  organizationId: uuidShape,
  service_code_mapping_id: uuidShape,
  local_service_name: z.string().trim().min(1).nullable().optional(),
  requires_clinical_approval: z.boolean().default(false),
}).strict()
export type ActivateOrgServiceInput = z.infer<typeof ActivateOrgServiceSchema>

export const UpdateOrgServiceSchema = z.object({
  organizationId: uuidShape,
  organizationServiceId: uuidShape,
  local_service_name: z.string().trim().min(1).nullable().optional(),
  requires_clinical_approval: z.boolean().optional(),
  enabled: z.boolean().optional(),
}).strict().refine(
  (value) => Object.keys(value).length > 2,
  'At least one field must be updated',
)
export type UpdateOrgServiceInput = z.infer<typeof UpdateOrgServiceSchema>

export const SetOrganizationServiceRateSchema = z.object({
  organizationId: uuidShape,
  organizationServiceId: uuidShape,
  reimbursement_rate: moneyShape,
  rate_unit: rateUnitEnum,
  effective_start_date: dateShape,
  change_reason: z.string().trim().min(1, 'A reason is required'),
}).strict()
export type SetOrganizationServiceRateInput = z.infer<typeof SetOrganizationServiceRateSchema>

export const AuthorizationServiceInputSchema = z.object({
  organization_service_id: uuidShape,
  authorized_quantity: z.number().positive('Authorized quantity must be greater than zero'),
  quantity_unit: quantityUnitEnum,
  quantity_period: quantityPeriodEnum,
  reimbursement_rate: moneyShape.nullable().optional(),
  rate_unit: rateUnitEnum,
  service_requirement_code: z.string().trim().min(1).nullable().optional(),
  effective_start_date: dateShape.optional(),
  effective_end_date: dateShape.optional(),
}).strict().refine(
  (value) => !value.effective_end_date || !value.effective_start_date || value.effective_end_date >= value.effective_start_date,
  'Effective end date must be on or after effective start date',
)
export type AuthorizationServiceInput = z.infer<typeof AuthorizationServiceInputSchema>

export const CreateAuthorizationSchema = z.object({
  organizationId: uuidShape,
  patientId: uuidShape,
  payer_id: uuidShape,
  authorization_start_date: dateShape,
  authorization_end_date: dateShape,
  status: authorizationStatusEnum.optional(),
  prior_auth_number: z.string().trim().min(1).nullable().optional(),
  services: z.array(AuthorizationServiceInputSchema).default([]),
}).strict().refine(
  (value) => value.authorization_end_date >= value.authorization_start_date,
  'Authorization end date must be on or after start date',
)
export type CreateAuthorizationInput = z.infer<typeof CreateAuthorizationSchema>

export const UpdateAuthorizationSchema = z.object({
  organizationId: uuidShape,
  patientId: uuidShape,
  authorizationId: uuidShape,
  payer_id: uuidShape.optional(),
  authorization_start_date: dateShape.optional(),
  authorization_end_date: dateShape.optional(),
  status: authorizationStatusEnum.optional(),
}).strict().refine(
  (value) => Object.keys(value).length > 3,
  'At least one field must be updated',
).refine(
  (value) => !value.authorization_start_date || !value.authorization_end_date || value.authorization_end_date >= value.authorization_start_date,
  'Authorization end date must be on or after start date',
)
export type UpdateAuthorizationInput = z.infer<typeof UpdateAuthorizationSchema>

export const UpsertAuthorizationServiceSchema = z.object({
  organizationId: uuidShape,
  patientId: uuidShape,
  authorizationId: uuidShape,
  authorizationServiceId: uuidShape.optional(),
}).extend(AuthorizationServiceInputSchema.shape).strict()
export type UpsertAuthorizationServiceInput = z.infer<typeof UpsertAuthorizationServiceSchema>

export const DeactivateAuthorizationServiceSchema = z.object({
  organizationId: uuidShape,
  patientId: uuidShape,
  authorizationId: uuidShape,
  authorizationServiceId: uuidShape,
}).strict()
export type DeactivateAuthorizationServiceInput = z.infer<typeof DeactivateAuthorizationServiceSchema>

export const ArchiveAuthorizationSchema = z.object({
  organizationId: uuidShape,
  patientId: uuidShape,
  authorizationId: uuidShape,
}).strict()
export type ArchiveAuthorizationInput = z.infer<typeof ArchiveAuthorizationSchema>
