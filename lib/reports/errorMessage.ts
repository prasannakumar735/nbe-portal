/** Supabase/PostgREST errors are often plain objects, not `instanceof Error`. */
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [o.message, o.details, o.hint].filter(x => typeof x === 'string' && String(x).trim()) as string[]
    if (parts.length) return parts.join(' — ')
    if (o.code != null) return String(o.code)
  }
  if (typeof e === 'string') return e
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

export function toThrownError(e: unknown): Error {
  return new Error(getErrorMessage(e))
}
