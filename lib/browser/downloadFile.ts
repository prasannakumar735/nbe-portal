export type DownloadProgress = {
  loaded: number
  total?: number
  percent?: number
}

export async function downloadFile(
  input: RequestInfo | URL,
  {
    init,
    filenameFallback,
    onProgress,
  }: {
    init?: RequestInit
    filenameFallback: string
    onProgress?: (progress: DownloadProgress) => void
  },
): Promise<void> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Request failed (${res.status})`)
  }

  const cd = res.headers.get('Content-Disposition') ?? ''
  const match = cd.match(/filename="([^"]+)"/i)
  const filename = match?.[1] || filenameFallback

  const totalHeader = res.headers.get('content-length')
  const total = totalHeader ? Number(totalHeader) : undefined

  if (!res.body) {
    const blob = await res.blob()
    triggerBlobDownload(blob, filename)
    return
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      loaded += value.byteLength
      const percent = total && total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : undefined
      onProgress?.({ loaded, total, percent })
    }
  }

  onProgress?.({ loaded, total, percent: 100 })

  const ct = res.headers.get('content-type') ?? 'application/octet-stream'
  const blob = new Blob(chunks.map(c => new Uint8Array(c)) as unknown as BlobPart[], { type: ct })
  triggerBlobDownload(blob, filename)
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

