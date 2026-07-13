'use client'

type ApiOk<T> = { ok: true; data: T }
type ApiFail = { ok: false; error: string; issues?: unknown }

export class SalesEngineApiError extends Error {
  readonly issues?: unknown
  readonly status: number

  constructor(message: string, status: number, issues?: unknown) {
    super(message)
    this.name = 'SalesEngineApiError'
    this.status = status
    this.issues = issues
  }
}

export async function salesEngineFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const res = await fetch(url, {
    ...init,
    headers: isFormData
      ? { ...init?.headers }
      : {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
  })
  const json = (await res.json()) as ApiOk<T> | ApiFail
  if (!json.ok) {
    throw new SalesEngineApiError(json.error || 'Request failed', res.status, json.issues)
  }
  return json.data
}
