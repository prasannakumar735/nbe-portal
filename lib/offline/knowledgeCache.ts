const KEY = 'nbe:knowledge:articles:v1'

export function cacheKnowledgeArticles(articles: unknown[]) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ cachedAt: Date.now(), articles }),
    )
  } catch {
    /* ignore quota */
  }
}

export function readCachedKnowledgeArticles(): unknown[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { articles?: unknown[] }
    return parsed.articles ?? null
  } catch {
    return null
  }
}
