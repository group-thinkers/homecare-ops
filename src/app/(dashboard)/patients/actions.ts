'use server'

import { revalidatePath } from 'next/cache'
import { AuthError, requireAuth } from '@/lib/auth/server'
import { requireAnyPermission, requirePermission } from '@/lib/permissions'
import { fetchAllPages } from '@/lib/pagination'
import {
  CreatePatientSchema,
  UpdatePatientSchema,
  PatientRequirementSchema,
  DeactivatePatientRequirementSchema,
  ArchivePatientSchema,
  UpsertPatientAddressSchema,
  DeactivatePatientAddressSchema,
  UpsertPatientContactSchema,
  DeactivatePatientContactSchema,
} from '@/lib/schemas/patients.schema'
import {
  ArchiveAuthorizationSchema,
  CreateAuthorizationSchema,
  DeactivateAuthorizationServiceSchema,
  UpdateAuthorizationSchema,
  UpsertAuthorizationServiceSchema,
} from '@/lib/schemas/authorizations.schema'
import * as patientsService from '@/lib/services/patients.service'
import * as authorizationsService from '@/lib/services/authorizations.service'
import type {
  ActionResponse,
  AuthorizationServiceManagementRecord,
  AuthorizationServiceCompatibility,
  AuthorizationServiceForScheduling,
  Patient,
  PatientAuthorizationDetail,
  PatientAuthorizationListPage,
  PatientAuthorizationPublic,
  OrganizationServiceWithMapping,
  Payer,
  PatientRequirement,
  PatientAddress,
  PatientContact,
  PatientListPage,
  PatientStatus,
} from '@/types'

// ─── List Patients ────────────────────────────────────────────────────────────

export async function listPatientsAction(
  orgId: string,
  filters?: { status?: PatientStatus; page?: number; pageSize?: number },
): Promise<ActionResponse<PatientListPage>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'patients.read_basic')
    const data = await patientsService.listPatients(orgId, filters)
    return { success: true, data }
  } catch (err) {
    console.error('[listPatientsAction] failed:', { orgId, filters, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

// ─── Get Patient ──────────────────────────────────────────────────────────────

export async function getPatientAction(
  orgId: string,
  patientId: string,
): Promise<ActionResponse<Patient | null>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'patients.read_basic')
    const data = await patientsService.getPatient(orgId, patientId)
    return { success: true, data }
  } catch (err) {
    console.error('[getPatientAction] failed:', { orgId, patientId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

// ─── Create Patient ───────────────────────────────────────────────────────────

export async function createPatientAction(input: unknown): Promise<ActionResponse<Patient>> {
  try {
    const user = await requireAuth()
    const parsed = CreatePatientSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[createPatientAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    const data = await patientsService.createPatient(
      parsed.data.organizationId,
      user.id,
      {
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        middle_name: parsed.data.middle_name,
        date_of_birth: parsed.data.date_of_birth,
        patient_external_id: parsed.data.patient_external_id,
        status: parsed.data.status,
        address: parsed.data.address,
      },
    )
    revalidatePath('/patients')
    return { success: true, data }
  } catch (err) {
    console.error('[createPatientAction] failed:', { error: err })
    const message = err instanceof Error ? err.message : undefined
    return { success: false, error: message ?? 'Unable to complete this action.' }
  }
}

// ─── Update Patient ───────────────────────────────────────────────────────────

export async function updatePatientAction(input: unknown): Promise<ActionResponse<Patient>> {
  try {
    const user = await requireAuth()
    const parsed = UpdatePatientSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[updatePatientAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    const data = await patientsService.updatePatient(
      parsed.data.organizationId,
      parsed.data.patientId,
      user.id,
      {
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        middle_name: parsed.data.middle_name,
        date_of_birth: parsed.data.date_of_birth,
        patient_external_id: parsed.data.patient_external_id,
        status: parsed.data.status,
      },
    )
    revalidatePath(`/patients/${parsed.data.patientId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[updatePatientAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

// ─── Archive Patient ──────────────────────────────────────────────────────────

export async function archivePatientAction(input: unknown): Promise<ActionResponse> {
  try {
    const user = await requireAuth()
    const parsed = ArchivePatientSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[archivePatientAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    await patientsService.archivePatient(
      parsed.data.organizationId,
      parsed.data.patientId,
      user.id,
    )
    revalidatePath('/patients')
    return { success: true }
  } catch (err) {
    console.error('[archivePatientAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

// ─── List Patient Addresses ───────────────────────────────────────────────────

export async function listPatientAddressesAction(
  orgId: string,
  patientId: string,
): Promise<ActionResponse<PatientAddress[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'patients.read_basic')
    const data = await patientsService.listPatientAddresses(orgId, patientId)
    return { success: true, data }
  } catch (err) {
    console.error('[listPatientAddressesAction] failed:', { orgId, patientId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

// ─── Upsert Patient Address ───────────────────────────────────────────────────

export async function upsertPatientAddressAction(input: unknown): Promise<ActionResponse<PatientAddress>> {
  try {
    await requireAuth()
    const parsed = UpsertPatientAddressSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[upsertPatientAddressAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    const data = await patientsService.upsertPatientAddress(
      parsed.data.organizationId,
      parsed.data.patientId,
      parsed.data.address_type,
      {
        address_type: parsed.data.address_type,
        address_line_1: parsed.data.address_line_1,
        address_line_2: parsed.data.address_line_2,
        city: parsed.data.city,
        state: parsed.data.state,
        zip_code: parsed.data.zip_code,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        location_hash: parsed.data.location_hash,
        geocoding_provider: parsed.data.geocoding_provider,
        geocoded_at: parsed.data.geocoded_at,
      },
    )
    revalidatePath(`/patients/${parsed.data.patientId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[upsertPatientAddressAction] failed:', { error: err })
    const message = err instanceof Error ? err.message : undefined
    return { success: false, error: message ?? 'Unable to complete this action.' }
  }
}

// ─── Deactivate Patient Address ───────────────────────────────────────────────

export async function deactivatePatientAddressAction(input: unknown): Promise<ActionResponse> {
  try {
    await requireAuth()
    const parsed = DeactivatePatientAddressSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[deactivatePatientAddressAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    await patientsService.deactivatePatientAddress(
      parsed.data.organizationId,
      parsed.data.patientId,
      parsed.data.addressId,
    )
    revalidatePath(`/patients/${parsed.data.patientId}`)
    return { success: true }
  } catch (err) {
    console.error('[deactivatePatientAddressAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

// ─── List Patient Requirements ────────────────────────────────────────────────

export async function listPatientRequirementsAction(
  orgId: string,
  patientId: string,
  visibilityLevel?: 'Operational' | 'Clinical' | 'Restricted',
): Promise<ActionResponse<PatientRequirement[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'patients.read_basic')
    const data = await patientsService.listPatientRequirements(orgId, patientId, visibilityLevel)
    return { success: true, data }
  } catch (err) {
    console.error('[listPatientRequirementsAction] failed:', { orgId, patientId, visibilityLevel, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

// ─── Upsert Patient Requirement ───────────────────────────────────────────────

export async function upsertPatientRequirementAction(input: unknown): Promise<ActionResponse<PatientRequirement>> {
  try {
    const user = await requireAuth()
    const parsed = PatientRequirementSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[upsertPatientRequirementAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    const data = await patientsService.upsertPatientRequirement(
      parsed.data.organizationId,
      parsed.data.patientId,
      user.id,
      {
        requirement_type: parsed.data.requirement_type,
        requirement_code: parsed.data.requirement_code,
        matching_effect: parsed.data.matching_effect,
        required_skill_code: parsed.data.required_skill_code,
        structured_value: parsed.data.structured_value,
        restricted_note_id: parsed.data.restricted_note_id,
        visibility_level: parsed.data.visibility_level,
        effective_start_date: parsed.data.effective_start_date,
        effective_end_date: parsed.data.effective_end_date,
      },
    )
    revalidatePath(`/patients/${parsed.data.patientId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[upsertPatientRequirementAction] failed:', { error: err })
    const message = err instanceof Error ? err.message : undefined
    return { success: false, error: message ?? 'Unable to complete this action.' }
  }
}

// ─── Deactivate Patient Requirement ────────────────────────────────────────────

export async function deactivatePatientRequirementAction(input: unknown): Promise<ActionResponse> {
  try {
    await requireAuth()
    const parsed = DeactivatePatientRequirementSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[deactivatePatientRequirementAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    await patientsService.deactivatePatientRequirement(
      parsed.data.organizationId,
      parsed.data.patientId,
      parsed.data.requirementId,
    )
    revalidatePath(`/patients/${parsed.data.patientId}`)
    return { success: true }
  } catch (err) {
    console.error('[deactivatePatientRequirementAction] failed:', { input, error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

// ─── List Patient Contacts ────────────────────────────────────────────────────

export async function listPatientContactsAction(
  orgId: string,
  patientId: string,
): Promise<ActionResponse<PatientContact[]>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'patients.read_basic')
    const data = await patientsService.listPatientContacts(orgId, patientId)
    return { success: true, data }
  } catch (err) {
    console.error('[listPatientContactsAction] failed:', { orgId, patientId, error: err })
    return { success: false, error: 'Not authorized.' }
  }
}

// ─── Upsert Patient Contact ───────────────────────────────────────────────────

export async function upsertPatientContactAction(input: unknown): Promise<ActionResponse<PatientContact>> {
  try {
    await requireAuth()
    const parsed = UpsertPatientContactSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[upsertPatientContactAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    const data = await patientsService.upsertPatientContact(
      parsed.data.organizationId,
      parsed.data.patientId,
      parsed.data.contactId,
      {
        contact_type: parsed.data.contact_type,
        contact_name: parsed.data.contact_name,
        relationship: parsed.data.relationship,
        phone: parsed.data.phone,
        email: parsed.data.email,
        authorized_contact: parsed.data.authorized_contact,
      },
    )
    revalidatePath(`/patients/${parsed.data.patientId}`)
    return { success: true, data }
  } catch (err) {
    console.error('[upsertPatientContactAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

// ─── Deactivate Patient Contact ───────────────────────────────────────────────

export async function deactivatePatientContactAction(input: unknown): Promise<ActionResponse> {
  try {
    await requireAuth()
    const parsed = DeactivatePatientContactSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[deactivatePatientContactAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'patients.manage')
    await patientsService.deactivatePatientContact(
      parsed.data.organizationId,
      parsed.data.patientId,
      parsed.data.contactId,
    )
    revalidatePath(`/patients/${parsed.data.patientId}`)
    return { success: true }
  } catch (err) {
    console.error('[deactivatePatientContactAction] failed:', { error: err })
    return { success: false, error: err instanceof Error ? err.message : 'Unable to complete this action.' }
  }
}

type AuthorizationFormOptions = {
  payers: Pick<Payer, 'id' | 'payer_name' | 'payer_type' | 'status'>[]
  organizationServices: OrganizationServiceWithMapping[]
}

function authorizationActionError(error: unknown): string {
  if (error instanceof AuthError) return 'Not authorized.'
  const safeMessages = new Set([
    'Authorization not found',
    'Authorization could not be created',
    'Invalid authorization status transition',
    'Authorization service not found',
  ])
  if (error instanceof Error && safeMessages.has(error.message)) return error.message
  return 'Unable to complete this action.'
}

export async function listPatientAuthorizationsAction(
  orgId: string,
  patientId: string,
  filters?: { page?: number; pageSize?: number },
): Promise<ActionResponse<PatientAuthorizationListPage>> {
  try {
    await requireAuth()
    await requireAnyPermission(orgId, ['authorizations.manage', 'shifts.manage'])
    const data = await authorizationsService.listPatientAuthorizations(orgId, patientId, filters)
    return { success: true, data }
  } catch (error) {
    console.error('[listPatientAuthorizationsAction] failed:', { orgId, patientId, filters, error })
    return {
      success: false,
      error: error instanceof AuthError ? 'Not authorized.' : 'Unable to load authorizations.',
    }
  }
}

export async function getAuthorizationAction(
  orgId: string,
  patientId: string,
  authorizationId: string,
  serviceDate?: string,
  serviceOffset = 0,
  targetServiceId: string | null = null,
): Promise<ActionResponse<PatientAuthorizationDetail | null>> {
  try {
    await requireAuth()
    await requireAnyPermission(orgId, ['authorizations.manage', 'shifts.manage'])
    const data = await authorizationsService.getAuthorizationDetail(
      orgId,
      patientId,
      authorizationId,
      serviceDate,
      serviceOffset,
      targetServiceId,
    )
    return { success: true, data }
  } catch (error) {
    console.error('[getAuthorizationDetailAction] failed:', { orgId, patientId, authorizationId, error })
    return {
      success: false,
      error: error instanceof AuthError ? 'Not authorized.' : 'Unable to load authorization detail.',
    }
  }
}

export async function listAuthorizationFormOptionsAction(
  orgId: string,
): Promise<ActionResponse<AuthorizationFormOptions>> {
  try {
    await requireAuth()
    await requirePermission(orgId, 'authorizations.manage')
    const [payers, services] = await Promise.all([
      fetchAllPages((page, pageSize) => authorizationsService.listPayers(orgId, {
        page,
        pageSize,
        includeInactive: true,
      })),
      fetchAllPages((page, pageSize) => authorizationsService.listOrgServices(orgId, {
        page,
        pageSize,
        includeDisabled: true,
      })),
    ])
    return {
      success: true,
      data: {
        payers: payers.map(({ id, payer_name, payer_type, status }) => ({ id, payer_name, payer_type, status })),
        organizationServices: services,
      },
    }
  } catch (error) {
    console.error('[listAuthorizationFormOptionsAction] failed:', { orgId, error })
    return {
      success: false,
      error: error instanceof AuthError ? 'Not authorized.' : 'Unable to load authorization form options.',
    }
  }
}

export async function createAuthorizationAction(input: unknown): Promise<ActionResponse<string>> {
  try {
    await requireAuth()
    const parsed = CreateAuthorizationSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[createAuthorizationAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'authorizations.manage')
    const data = await authorizationsService.createAuthorization(parsed.data.organizationId, {
      patientId: parsed.data.patientId,
      payer_id: parsed.data.payer_id,
      authorization_start_date: parsed.data.authorization_start_date,
      authorization_end_date: parsed.data.authorization_end_date,
      status: parsed.data.status,
      prior_auth_number: parsed.data.prior_auth_number,
      services: parsed.data.services,
    })
    revalidatePath(`/patients/${parsed.data.patientId}/authorization`)
    return { success: true, data }
  } catch (error) {
    console.error('[createAuthorizationAction] failed:', { error })
    return { success: false, error: authorizationActionError(error) }
  }
}

export async function updateAuthorizationAction(input: unknown): Promise<ActionResponse<PatientAuthorizationPublic>> {
  try {
    const user = await requireAuth()
    const parsed = UpdateAuthorizationSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[updateAuthorizationAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'authorizations.manage')
    const data = await authorizationsService.updateAuthorization(
      parsed.data.organizationId,
      user.id,
      {
        authorizationId: parsed.data.authorizationId,
        payer_id: parsed.data.payer_id,
        authorization_start_date: parsed.data.authorization_start_date,
        authorization_end_date: parsed.data.authorization_end_date,
        status: parsed.data.status,
      },
    )
    revalidatePath(`/patients/${parsed.data.patientId}/authorization/${parsed.data.authorizationId}`)
    return { success: true, data }
  } catch (error) {
    console.error('[updateAuthorizationAction] failed:', { error })
    return { success: false, error: authorizationActionError(error) }
  }
}

export async function archiveAuthorizationAction(input: unknown): Promise<ActionResponse> {
  try {
    const user = await requireAuth()
    const parsed = ArchiveAuthorizationSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[archiveAuthorizationAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'authorizations.manage')
    await authorizationsService.archiveAuthorization(parsed.data.organizationId, user.id, {
      authorizationId: parsed.data.authorizationId,
    })
    revalidatePath(`/patients/${parsed.data.patientId}/authorization`)
    return { success: true }
  } catch (error) {
    console.error('[archiveAuthorizationAction] failed:', { error })
    return { success: false, error: authorizationActionError(error) }
  }
}

export async function upsertAuthorizationServiceAction(
  input: unknown,
): Promise<ActionResponse<AuthorizationServiceManagementRecord>> {
  try {
    await requireAuth()
    const parsed = UpsertAuthorizationServiceSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[upsertAuthorizationServiceAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'authorizations.manage')
    const data = await authorizationsService.upsertAuthorizationService(parsed.data.organizationId, {
      authorizationId: parsed.data.authorizationId,
      authorizationServiceId: parsed.data.authorizationServiceId,
      organization_service_id: parsed.data.organization_service_id,
      authorized_quantity: parsed.data.authorized_quantity,
      quantity_unit: parsed.data.quantity_unit,
      quantity_period: parsed.data.quantity_period,
      reimbursement_rate: parsed.data.reimbursement_rate,
      rate_unit: parsed.data.rate_unit,
      service_requirement_code: parsed.data.service_requirement_code,
      effective_start_date: parsed.data.effective_start_date,
      effective_end_date: parsed.data.effective_end_date,
    })
    revalidatePath(`/patients/${parsed.data.patientId}/authorization/${parsed.data.authorizationId}`)
    return { success: true, data }
  } catch (error) {
    console.error('[upsertAuthorizationServiceAction] failed:', { error })
    return { success: false, error: authorizationActionError(error) }
  }
}

export async function deactivateAuthorizationServiceAction(input: unknown): Promise<ActionResponse> {
  try {
    await requireAuth()
    const parsed = DeactivateAuthorizationServiceSchema.safeParse(input)
    if (!parsed.success) {
      console.error('[deactivateAuthorizationServiceAction] validation failed:', parsed.error.flatten())
      return { success: false, fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    await requirePermission(parsed.data.organizationId, 'authorizations.manage')
    await authorizationsService.deactivateAuthorizationService(parsed.data.organizationId, {
      authorizationId: parsed.data.authorizationId,
      authorizationServiceId: parsed.data.authorizationServiceId,
    })
    revalidatePath(`/patients/${parsed.data.patientId}/authorization/${parsed.data.authorizationId}`)
    return { success: true }
  } catch (error) {
    console.error('[deactivateAuthorizationServiceAction] failed:', { error })
    return { success: false, error: authorizationActionError(error) }
  }
}

export async function checkAuthorizationServiceCompatibilityAction(
  orgId: string,
  patientId: string,
  organizationServiceId: string,
  serviceDate: string,
): Promise<ActionResponse<AuthorizationServiceCompatibility>> {
  try {
    await requireAuth()
    await requireAnyPermission(orgId, ['authorizations.manage', 'shifts.manage'])
    const data = await authorizationsService.checkAuthorizationServiceCompatibility(
      orgId,
      patientId,
      organizationServiceId,
      serviceDate,
    )
    return { success: true, data }
  } catch (error) {
    console.error('[checkAuthorizationServiceCompatibilityAction] failed:', {
      orgId,
      patientId,
      organizationServiceId,
      error,
    })
    return {
      success: false,
      error: error instanceof AuthError ? 'Not authorized.' : 'Unable to check service compatibility.',
    }
  }
}

export async function listActiveAuthorizationServicesForPatientAction(
  orgId: string,
  patientId: string,
  onDate: string,
  page = 0,
  pageSize = 100,
): Promise<ActionResponse<AuthorizationServiceForScheduling[]>> {
  try {
    await requireAuth()
    await requireAnyPermission(orgId, ['authorizations.manage', 'shifts.manage'])
    const data = await authorizationsService.listActiveAuthorizationServicesForPatient(
      orgId,
      patientId,
      onDate,
      page,
      pageSize,
    )
    return { success: true, data }
  } catch (error) {
    console.error('[listActiveAuthorizationServicesForPatientAction] failed:', {
      orgId,
      patientId,
      onDate,
      page,
      pageSize,
      error,
    })
    return {
      success: false,
      error: error instanceof AuthError ? 'Not authorized.' : 'Unable to load active authorization services.',
    }
  }
}
