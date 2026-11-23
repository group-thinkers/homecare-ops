'use server'

import { revalidatePath } from 'next/cache'
import { AuthError, requireAuth } from '@/lib/auth/server'
import { requireOrganizationMembership, requirePermission } from '@/lib/permissions'
import { UpsertPayerSchema } from '@/lib/schemas/authorizations.schema'
import * as authorizationsService from '@/lib/services/authorizations.service'
import type { ActionResponse, Payer, PayerListPage } from '@/types'

const PAYERS_PATH = '/settings/payers'

function validationFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] }
}): Record<string, string[]> {
  const flattened = error.flatten()
  return {
    ...Object.fromEntries(
      Object.entries(flattened.fieldErrors).filter((entry): entry is [string, string[]] => Boolean(entry[1])),
    ),
    ...(flattened.formErrors.length > 0 ? { _form: flattened.formErrors } : {}),
  }
}

export async function listPayersAction(
  orgId: string,
  pagination?: { page?: number; pageSize?: number },
): Promise<ActionResponse<PayerListPage>> {
  try {
    await requireAuth()
    await requireOrganizationMembership(orgId)
    const data = await authorizationsService.listPayers(orgId, {
      ...pagination,
      includeInactive: true,
    })
    return { success: true, data }
  } catch (error) {
    console.error('[listPayersAction] failed:', { orgId, error })
    return {
      success: false,
      error: error instanceof AuthError ? 'Not authorized.' : 'Unable to load payers.',
    }
  }
}

export async function getPayerAction(
  orgId: string,
  payerId: string,
): Promise<ActionResponse<Payer | null>> {
  try {
    await requireAuth()
    await requireOrganizationMembership(orgId)
    const data = await authorizationsService.getPayer(orgId, payerId)
    return { success: true, data }
  } catch (error) {
    console.error('[getPayerAction] failed:', { orgId, payerId, error })
    return {
      success: false,
      error: error instanceof AuthError ? 'Not authorized.' : 'Unable to load payer.',
    }
  }
}

export async function upsertPayerAction(input: unknown): Promise<ActionResponse<Payer>> {
  try {
    await requireAuth()
    const parsed = UpsertPayerSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, fieldErrors: validationFieldErrors(parsed.error) }
    }

    await requirePermission(parsed.data.organizationId, 'authorizations.manage')
    const data = await authorizationsService.upsertPayer(parsed.data.organizationId, {
      payerId: parsed.data.payerId,
      payer_name: parsed.data.payer_name,
      payer_type: parsed.data.payer_type,
      program_name: parsed.data.program_name,
      status: parsed.data.status,
    })

    revalidatePath(PAYERS_PATH)
    if (parsed.data.payerId) revalidatePath(`${PAYERS_PATH}/${parsed.data.payerId}/edit`)
    return { success: true, data }
  } catch (error) {
    console.error('[upsertPayerAction] failed:', { error })
    if (error instanceof AuthError) {
      return { success: false, error: 'Not authorized.' }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unable to complete this action.',
    }
  }
}
