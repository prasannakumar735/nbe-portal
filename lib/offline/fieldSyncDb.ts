import { openDB } from 'idb'

const DB_NAME = 'nbe-field-sync'
const DB_VERSION = 1

type PatchQueueItem = {
  id: string
  jobId: string
  body: Record<string, unknown>
  createdAt: number
}

type ImageQueueItem = {
  id: string
  jobId: string
  blob: ArrayBuffer
  contentType: string
  filename: string
  asSignature: boolean
  createdAt: number
}

let dbPromise: ReturnType<typeof openDB> | null = null

export function getFieldSyncDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('patch_queue')) {
          db.createObjectStore('patch_queue', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('image_queue')) {
          db.createObjectStore('image_queue', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

function randomId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function enqueueJobPatch(jobId: string, body: Record<string, unknown>) {
  const db = await getFieldSyncDb()
  const item: PatchQueueItem = {
    id: randomId(),
    jobId,
    body,
    createdAt: Date.now(),
  }
  await db.put('patch_queue', item)
  return item.id
}

export async function enqueueJobImage(
  jobId: string,
  blob: Blob,
  options?: { asSignature?: boolean; filename?: string },
) {
  const buf = await blob.arrayBuffer()
  const db = await getFieldSyncDb()
  const item: ImageQueueItem = {
    id: randomId(),
    jobId,
    blob: buf,
    contentType: blob.type || 'image/jpeg',
    filename: options?.filename ?? 'photo.jpg',
    asSignature: Boolean(options?.asSignature),
    createdAt: Date.now(),
  }
  await db.put('image_queue', item)
  return item.id
}

export async function processFieldSyncQueue(): Promise<{ patches: number; images: number; errors: string[] }> {
  const db = await getFieldSyncDb()
  const errors: string[] = []
  let patches = 0
  let images = 0

  const patchItems = await db.getAll('patch_queue')
  for (const item of patchItems) {
    try {
      const res = await fetch(`/api/job-cards/${item.jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(item.body),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || res.statusText)
      }
      await db.delete('patch_queue', item.id)
      patches += 1
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'patch failed')
    }
  }

  const imageItems = await db.getAll('image_queue')
  for (const item of imageItems) {
    try {
      const file = new File([item.blob], item.filename, { type: item.contentType })
      const fd = new FormData()
      fd.set('job_card_id', item.jobId)
      fd.set('file', file)
      if (item.asSignature) fd.set('as_signature', '1')

      const res = await fetch('/api/job-cards/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd,
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || res.statusText)
      }
      await db.delete('image_queue', item.id)
      images += 1
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'upload failed')
    }
  }

  return { patches, images, errors }
}

export async function getPendingQueueCounts() {
  const db = await getFieldSyncDb()
  const [p, i] = await Promise.all([db.count('patch_queue'), db.count('image_queue')])
  return { patches: p, images: i, total: p + i }
}
