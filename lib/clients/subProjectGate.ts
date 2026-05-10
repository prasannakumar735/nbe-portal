import type { SupabaseClient } from '@supabase/supabase-js'

export class SubProjectValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SubProjectValidationError'
  }
}

function normalizeUuid(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  return s || null
}

/**
 * Ensures sub-project rules for a client line:
 * - Sub-project is optional even when the client has sub-projects configured.
 * - If a sub-project id is provided, it must belong to the client.
 */
export async function assertSubProjectSelection(
  supabase: SupabaseClient,
  params: { clientId: string | null | undefined; subProjectId: string | null | undefined },
): Promise<void> {
  const clientId = normalizeUuid(params.clientId ?? null)
  const subProjectId = normalizeUuid(params.subProjectId ?? null)

  if (!clientId) {
    if (subProjectId) {
      throw new SubProjectValidationError('Sub-project cannot be set without a client.')
    }
    return
  }

  if (!subProjectId) {
    return
  }

  const { data, error } = await supabase
    .from('client_sub_projects')
    .select('id')
    .eq('id', subProjectId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (error) {
    throw new SubProjectValidationError(`Invalid sub-project: ${error.message}`)
  }
  if (!data) {
    throw new SubProjectValidationError('Sub-project does not match the selected client.')
  }
}
