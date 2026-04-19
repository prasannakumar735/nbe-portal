/**
 * Public marketing/contact routes use the service role because `contacts` is not exposed to `anon`.
 * Authorization is **not** JWT-based: only validate slug shape + row `status` in code.
 */
const SLUG_MAX = 160

export function normalizePublicContactSlug(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .slice(0, SLUG_MAX)
}

/** Returns null if the slug is not a safe public lookup key (reject path injection / oversize). */
export function parsePublicContactSlug(raw: string): string | null {
  const slug = normalizePublicContactSlug(raw)
  if (!slug) return null
  if (slug.length > SLUG_MAX) return null
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null
  return slug
}
