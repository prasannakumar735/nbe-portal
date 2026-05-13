import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import type { ClientUserRow, ClientUserStatus } from '@/lib/types/client-users.types'
import { generateClientPassword, hashPassword } from '@/lib/clients/password'

function rowFromDb(
  r: Record<string, unknown>,
  linkedName?: string | null,
  portalLocationId?: string | null,
  portalLocationName?: string | null,
): ClientUserRow {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    company_name: String(r.company_name ?? ''),
    email: String(r.email ?? ''),
    status: r.status === 'disabled' ? 'disabled' : 'active',
    created_at: String(r.created_at ?? new Date().toISOString()),
    client_id: r.client_id != null ? String(r.client_id) : null,
    linked_client_name: linkedName ?? null,
    client_portal_location_id: portalLocationId ?? null,
    client_portal_location_name: portalLocationName ?? null,
  }
}

async function resolveClientNames(
  service: ReturnType<typeof createServiceRoleClient>,
  ids: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map

  const { data, error } = await service.from('clients').select('id, name, company_name').in('id', unique)
  if (error || !data) return map

  for (const row of data as { id: string; name?: string | null; company_name?: string | null }[]) {
    const label = String(row.name ?? row.company_name ?? '').trim() || 'Client'
    map.set(String(row.id), label)
  }
  return map
}

export async function listClientUsers(): Promise<{ clients: ClientUserRow[]; error?: string }> {
  try {
    const service = createServiceRoleClient()
    const { data, error } = await service
      .from('client_users')
      .select('id, name, company_name, email, status, created_at, client_id')
      .order('created_at', { ascending: false })

    if (error) {
      return { clients: [], error: error.message }
    }

    const rows = (data ?? []) as Record<string, unknown>[]
    const userIds = rows.map((r) => String(r.id))
    const { data: profRows } = await service
      .from('profiles')
      .select('id, client_id, client_portal_location_id')
      .in('id', userIds)

    type ProfRow = { id: string; client_id: string | null; client_portal_location_id: string | null }
    const profByUser = new Map<string, ProfRow>(
      (profRows ?? []).map((p: ProfRow) => [p.id, p])
    )

    const merged = rows.map((r) => {
      const id = String(r.id)
      const prof = profByUser.get(id)
      const fromCu = r.client_id != null ? String(r.client_id) : null
      const fromProf = prof?.client_id != null ? String(prof.client_id) : null
      const effective = fromCu ?? fromProf
      const portalLocId = prof?.client_portal_location_id ?? null
      return { ...r, client_id: effective, _portal_location_id: portalLocId }
    })

    const nameMap = await resolveClientNames(
      service,
      merged.map((r) => (r.client_id != null ? String(r.client_id) : ''))
    )

    // Resolve portal location names in one query
    const portalLocIds = [...new Set(
      merged
        .map((r) => String(r._portal_location_id ?? '').trim())
        .filter(Boolean)
    )]
    const locNameMap = new Map<string, string>()
    if (portalLocIds.length > 0) {
      const { data: locRows } = await service
        .from('client_locations')
        .select('id, location_name')
        .in('id', portalLocIds)
      for (const loc of locRows ?? []) {
        const l = loc as { id: string; location_name?: string | null }
        const label = String(l.location_name ?? '').trim()
        if (l.id && label) locNameMap.set(l.id, label)
      }
    }

    return {
      clients: merged.map((r) => {
        const portalLocId = r._portal_location_id ? String(r._portal_location_id) : null
        const portalLocName = portalLocId ? locNameMap.get(portalLocId) ?? null : null
        return rowFromDb(
          r,
          r.client_id != null ? nameMap.get(String(r.client_id)) ?? null : null,
          portalLocId,
          portalLocName,
        )
      }),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load clients'
    return { clients: [], error: msg }
  }
}

async function assertClientExists(
  service: ReturnType<typeof createServiceRoleClient>,
  clientId: string
): Promise<boolean> {
  const { data, error } = await service.from('clients').select('id').eq('id', clientId).maybeSingle()
  return !error && !!data
}

export async function createClientUser(input: {
  name: string
  companyName: string
  email: string
  plainPassword: string
  status: ClientUserStatus
  /** public.clients.id — required; drives profiles.client_id for merged-report access */
  clientId: string
}): Promise<{ client: ClientUserRow; plainPassword: string } | { error: string }> {
  const email = input.email.trim().toLowerCase()
  const name = input.name.trim()
  const companyName = input.companyName.trim()
  const plainPassword = input.plainPassword
  const clientId = input.clientId.trim()

  if (!email || !name || !plainPassword) {
    return { error: 'Name, email, and password are required.' }
  }
  if (!clientId) {
    return { error: 'Organisation is required so this account can open the correct reports.' }
  }
  if (plainPassword.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const service = createServiceRoleClient()
  const okClient = await assertClientExists(service, clientId)
  if (!okClient) {
    return { error: 'Invalid or unknown organisation. Choose a client from the list.' }
  }

  const passwordHash = hashPassword(plainPassword)

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password: plainPassword,
    email_confirm: true,
    user_metadata: { full_name: name },
  })

  if (createErr || !created.user) {
    return { error: createErr?.message ?? 'Could not create login' }
  }

  const userId = created.user.id

  const { error: profileErr } = await service.from('profiles').upsert(
    {
      id: userId,
      full_name: name,
      role: 'client',
      is_active: input.status === 'active',
      phone: null,
      client_id: clientId,
    },
    { onConflict: 'id' }
  )

  if (profileErr) {
    await service.auth.admin.deleteUser(userId)
    return { error: profileErr.message }
  }

  const { data: inserted, error: cuErr } = await service
    .from('client_users')
    .insert({
      id: userId,
      name,
      company_name: companyName,
      email,
      password_hash: passwordHash,
      status: input.status,
      client_id: clientId,
    })
    .select('id, name, company_name, email, status, created_at, client_id')
    .maybeSingle()

  if (cuErr || !inserted) {
    await service.auth.admin.deleteUser(userId)
    return { error: cuErr?.message ?? 'Could not save client record' }
  }

  const linked = await resolveClientNames(service, [clientId])
  return {
    client: rowFromDb(inserted as Record<string, unknown>, linked.get(clientId) ?? null),
    plainPassword,
  }
}

export async function updateClientUser(
  id: string,
  patch: Partial<{
    name: string
    companyName: string
    email: string
    status: ClientUserStatus
    clientId: string
    /** null clears location scope (full org access); string sets single-site scope */
    portalLocationId: string | null
  }>
): Promise<{ client: ClientUserRow } | { error: string }> {
  const service = createServiceRoleClient()

  const effectiveClientId = typeof patch.clientId === 'string'
    ? patch.clientId.trim()
    : null

  if (effectiveClientId !== null) {
    if (!effectiveClientId) {
      return { error: 'Organisation cannot be empty. Select a client record.' }
    }
    const ok = await assertClientExists(service, effectiveClientId)
    if (!ok) {
      return { error: 'Invalid organisation.' }
    }
  }

  // Validate portal location if provided — must belong to the resolved client org
  const settingPortalLoc = 'portalLocationId' in patch
  if (settingPortalLoc && patch.portalLocationId) {
    const locId = patch.portalLocationId.trim()

    // Resolve the org id to validate against: use incoming clientId or look up existing
    let orgId = effectiveClientId
    if (!orgId) {
      const { data: profRow } = await service
        .from('profiles')
        .select('client_id')
        .eq('id', id)
        .maybeSingle()
      orgId = String((profRow as { client_id?: string | null } | null)?.client_id ?? '').trim() || null
    }
    if (!orgId) {
      return { error: 'Cannot set a location scope before the client has an assigned organisation.' }
    }
    const { data: locRow } = await service
      .from('client_locations')
      .select('id, client_id')
      .eq('id', locId)
      .maybeSingle()
    const loc = locRow as { id?: string; client_id?: string } | null
    if (!loc?.id || String(loc.client_id ?? '').trim() !== orgId) {
      return { error: 'Invalid location — it does not belong to this client organisation.' }
    }
  }

  const updates: Record<string, string> = {}
  if (typeof patch.name === 'string') updates.name = patch.name.trim()
  if (typeof patch.companyName === 'string') updates.company_name = patch.companyName.trim()
  if (typeof patch.email === 'string') updates.email = patch.email.trim().toLowerCase()
  if (typeof patch.status === 'string') {
    updates.status = patch.status === 'disabled' ? 'disabled' : 'active'
  }
  if (effectiveClientId !== null) {
    updates.client_id = effectiveClientId
  }

  if (Object.keys(updates).length === 0 && !settingPortalLoc) {
    return { error: 'No changes provided.' }
  }

  if (updates.email) {
    const { error: authEmailErr } = await service.auth.admin.updateUserById(id, { email: updates.email })
    if (authEmailErr) {
      return { error: authEmailErr.message }
    }
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await service
      .from('client_users')
      .update(updates)
      .eq('id', id)
    if (error) {
      return { error: error.message }
    }
  }

  // Build profile patch — includes portal location scope
  const profilePatch: Record<string, string | boolean | null> = {}
  if (typeof updates.name === 'string') profilePatch.full_name = updates.name
  if (typeof updates.status === 'string') profilePatch.is_active = updates.status === 'active'
  if (effectiveClientId !== null) profilePatch.client_id = effectiveClientId
  if (settingPortalLoc) {
    // null clears single-site scope; non-empty string sets it (already validated above)
    profilePatch.client_portal_location_id = patch.portalLocationId
      ? patch.portalLocationId.trim()
      : null
  }

  if (Object.keys(profilePatch).length > 0) {
    const { error: pErr } = await service.from('profiles').update(profilePatch).eq('id', id)
    if (pErr) {
      return { error: pErr.message }
    }
  }

  // Re-fetch the full row for response
  const { data: refreshed } = await service
    .from('client_users')
    .select('id, name, company_name, email, status, created_at, client_id')
    .eq('id', id)
    .maybeSingle()

  const { data: profRefreshed } = await service
    .from('profiles')
    .select('client_portal_location_id')
    .eq('id', id)
    .maybeSingle()

  const row = (refreshed ?? {}) as Record<string, unknown>
  const cid = String(row.client_id ?? '').trim()
  const linked = cid ? await resolveClientNames(service, [cid]) : new Map<string, string>()

  const portalLocId = String(
    (profRefreshed as { client_portal_location_id?: string | null } | null)?.client_portal_location_id ?? ''
  ).trim() || null

  let portalLocName: string | null = null
  if (portalLocId) {
    const { data: locRow } = await service
      .from('client_locations')
      .select('location_name')
      .eq('id', portalLocId)
      .maybeSingle()
    portalLocName = String(
      (locRow as { location_name?: string | null } | null)?.location_name ?? ''
    ).trim() || null
  }

  return {
    client: rowFromDb(
      row,
      cid ? linked.get(cid) ?? null : null,
      portalLocId,
      portalLocName,
    ),
  }
}

export async function resetClientPassword(
  id: string,
  plainPassword: string
): Promise<{ ok: true } | { error: string }> {
  if (plainPassword.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const service = createServiceRoleClient()
  const passwordHash = hashPassword(plainPassword)

  const { error: authErr } = await service.auth.admin.updateUserById(id, { password: plainPassword })
  if (authErr) {
    return { error: authErr.message }
  }

  const { error } = await service.from('client_users').update({ password_hash: passwordHash }).eq('id', id)
  if (error) {
    return { error: error.message }
  }

  return { ok: true }
}

export { generateClientPassword } from '@/lib/clients/password'
