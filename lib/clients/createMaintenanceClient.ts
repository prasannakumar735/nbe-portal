export type CreateClientWithLocationPayload = {
  clientName: string
  location?: { locationName: string; companyAddress: string; suburb?: string }
}

export type CreateClientWithLocationResult = {
  client: { id: string; name: string }
  location?: { id: string; name: string; address: string; client_id: string; suburb: string | null }
}

export async function createMaintenanceClientWithOptionalLocation(
  payload: CreateClientWithLocationPayload,
): Promise<CreateClientWithLocationResult> {
  const name = payload.clientName.trim()
  const res = await fetch('/api/maintenance/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: name }),
  })
  const j = (await res.json().catch(() => ({}))) as {
    client?: { id?: string; name?: string }
    error?: string
  }
  if (!res.ok || !j.client?.id) {
    throw new Error(j.error ?? 'Failed to create client.')
  }
  const createdClient = { id: String(j.client.id), name: String(j.client.name ?? name) }

  if (!payload.location) {
    return { client: createdClient }
  }

  const r2 = await fetch('/api/maintenance/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: createdClient.id,
      location_name: payload.location.locationName.trim(),
      Company_address: payload.location.companyAddress.trim(),
      suburb: payload.location.suburb?.trim() || null,
    }),
  })
  const j2 = (await r2.json().catch(() => ({}))) as {
    location?: {
      id?: string
      name?: string
      address?: string
      client_id?: string
      suburb?: string | null
    }
    error?: string
  }
  if (!r2.ok || !j2.location?.id) {
    throw new Error(j2.error ?? 'Client created, but failed to create location.')
  }

  return {
    client: createdClient,
    location: {
      id: String(j2.location.id),
      name: String(j2.location.name ?? payload.location.locationName),
      address: String(j2.location.address ?? payload.location.companyAddress),
      client_id: String(j2.location.client_id ?? createdClient.id),
      suburb: j2.location.suburb ?? null,
    },
  }
}
