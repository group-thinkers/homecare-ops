'use server'

import { revalidatePath } from 'next/cache'
import { AuthError, requireAuth } from '@/lib/auth/server'
import { requireAnyPermission, requireOrganizationMembership, requirePermission } from '@/lib/permissions'
import {
  ActivateOrgServiceSchema,
  SetOrganizationServiceRateSchema,
  UpdateOrgServiceSchema,
} from '@/lib/schemas/authorizations.schema'
import * as service from '@/lib/services/authorizations.service'
import type {
  ActionResponse,
  OrganizationServiceListPage,
  OrganizationServicePublic,
  OrganizationServiceRate,
  OrganizationServiceRateListPage,
  OrganizationServiceWithMapping,
} from '@/types'

const PATH = '/settings/services'
const RATE_PERMISSIONS = ['authorizations.manage', 'authorizations.read_rates'] as const

function fieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] }
}): Record<string, string[]> {
  const { fieldErrors: fields, formErrors } = error.flatten()
  return {
    ...Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string[]] => Boolean(entry[1]))),
    ...(formErrors.length ? { _form: formErrors } : {}),
  }
}

export async function listOrgServicesAction(
  orgId: string,
  pagination?: { page?: number; pageSize?: number },
): Promise<ActionResponse<OrganizationServiceListPage>> {
  try {
    await requireAuth()
    await requireOrganizationMembership(orgId)
    return { success: true, data: await service.listOrgServices(orgId, { ...pagination, includeDisabled: true }) }
  } catch (error) {
    console.error('[listOrgServicesAction] failed:', { orgId, pagination, error })
    return {
      success: false,
      error: error instanceof AuthError ? 'Not authorized.' : 'Unable to load services.',
    }
  }
}

export async function getOrgServiceAction(orgId: string, id: string): Promise<ActionResponse<OrganizationServiceWithMapping | null>> {
  try {
    await requireAuth()
    await requireOrganizationMembership(orgId)
    return { success: true, data: await service.getOrgService(orgId, id) }
  } catch (error) {
    console.error('[getOrgServiceAction] failed:', { orgId, id, error })
    return {
      success: false,
      error: error instanceof AuthError ? 'Not authorized.' : 'Unable to load service.',
    }
  }
}

export async function listAvailableServiceCodeMappingsAction(
  orgId: string,
): Promise<ActionResponse<OrganizationServiceWithMapping['service_code_mapping'][]>> {
  try {
    await requireAuth()
    await requireOrganizationMembership(orgId)
    return { success: true, data: await service.listAvailableServiceCodeMappings() }
  } catch (error) {
    console.error('[listAvailableServiceCodeMappingsAction] failed:', { orgId, error })
    return {
      success: false,
      error: error instanceof AuthError ? 'Not authorized.' : 'Unable to load service mappings.',
    }
  }
}

export async function listOrganizationServiceRatesAction(
  orgId: string,
  id: string,
  pagination?: { page?: number; pageSize?: number },
): Promise<ActionResponse<OrganizationServiceRateListPage>> {
  try {
    await requireAuth()
    await requireAnyPermission(orgId, [...RATE_PERMISSIONS])
    return { success: true, data: await service.listOrganizationServiceRates(orgId, id, pagination) }
  } catch (error) {
    console.error('[listOrganizationServiceRatesAction] failed:', { orgId, id, pagination, error })
    return {
      success: false,
      error: error instanceof AuthError ? 'Not authorized.' : 'Unable to load rate history.',
    }
  }
}

export async function activateOrgServiceAction(input: unknown): Promise<ActionResponse<OrganizationServicePublic>> {
  let user
  try {
    user = await requireAuth()
  } catch {
    return { success: false, error: 'Not authorized.' }
  }
  const parsed = ActivateOrgServiceSchema.safeParse(input)
  if (!parsed.success) return { success: false, fieldErrors: fieldErrors(parsed.error) }
  const { organizationId, ...data } = parsed.data
  try {
    await requirePermission(organizationId, 'authorizations.manage')
  } catch {
    return { success: false, error: 'Not authorized.' }
  }
  try {
    const result = await service.activateOrgService(organizationId, user.id, data)
    revalidatePath(PATH)
    return { success: true, data: result }
  } catch (error) {
    console.error('[activateOrgServiceAction] failed:', { organizationId, mappingId: data.service_code_mapping_id, error })
    return { success: false, error: error instanceof Error && error.message === 'Service already activated' ? error.message : 'Unable to activate service.' }
  }
}

export async function updateOrgServiceAction(input: unknown): Promise<ActionResponse<OrganizationServicePublic>> {
  let user
  try {
    user = await requireAuth()
  } catch {
    return { success: false, error: 'Not authorized.' }
  }
  const parsed = UpdateOrgServiceSchema.safeParse(input)
  if (!parsed.success) return { success: false, fieldErrors: fieldErrors(parsed.error) }
  const { organizationId, ...data } = parsed.data
  try {
    await requirePermission(organizationId, 'authorizations.manage')
  } catch {
    return { success: false, error: 'Not authorized.' }
  }
  try {
    const result = await service.updateOrgService(organizationId, user.id, data)
    revalidatePath(PATH)
    revalidatePath(`${PATH}/${data.organizationServiceId}`)
    revalidatePath(`${PATH}/${data.organizationServiceId}/edit`)
    return { success: true, data: result }
  } catch (error) {
    console.error('[updateOrgServiceAction] failed:', { organizationId, organizationServiceId: data.organizationServiceId, error })
    return { success: false, error: 'Unable to update service.' }
  }
}

export async function setOrganizationServiceRateAction(input: unknown): Promise<ActionResponse<OrganizationServiceRate>> {
  try {
    await requireAuth()
  } catch {
    return { success: false, error: 'Not authorized.' }
  }
  const parsed = SetOrganizationServiceRateSchema.safeParse(input)
  if (!parsed.success) return { success: false, fieldErrors: fieldErrors(parsed.error) }
  const { organizationId, organizationServiceId, ...data } = parsed.data
  try {
    await requirePermission(organizationId, 'authorizations.manage')
  } catch {
    return { success: false, error: 'Not authorized.' }
  }
  try {
    const result = await service.setOrganizationServiceRate(organizationId, organizationServiceId, data)
    revalidatePath(`${PATH}/${organizationServiceId}`)
    return { success: true, data: result }
  } catch (error) {
    console.error('[setOrganizationServiceRateAction] failed:', { organizationId, organizationServiceId, error })
    return { success: false, error: 'Unable to set rate. Check the effective date and existing rates.' }
  }
}
