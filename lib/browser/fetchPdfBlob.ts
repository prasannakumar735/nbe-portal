/**
 * Fetch a PDF from an API route and validate the response is binary PDF (not HTML/JSON).
 */
export async function fetchPdfBlob(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ blob: Blob; filename?: string }> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Request failed (${res.status})`)
  }

  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/pdf')) {
    const text = await res.text()
    throw new Error(
      text.trim().slice(0, 400) || `Expected application/pdf, got: ${ct || '(no Content-Type)'}`,
    )
  }

  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') ?? ''
  const match = cd.match(/filename="([^"]+)"/i)
  return { blob, filename: match?.[1] }
}
