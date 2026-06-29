'use client'

type ApiOk<T> = { ok: true; data: T }
type ApiFail = { ok: false; error: string; issues?: unknown }

export async function salesEngineFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const json = (await res.json()) as ApiOk<T> | ApiFail
  if (!json.ok) {
    throw new Error(json.error || 'Request failed')
  }
  return json.data
}
