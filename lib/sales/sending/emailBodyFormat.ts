/** Shared body-format helpers for outbound sales email assembly. */

/** Generated bodies are either HTML or plain text; detect which so blocks match. */
export function looksLikeHtml(body: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(body)
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
