'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  Loader2,
  Trash2,
  X,
} from 'lucide-react'
import { createSupabaseClient } from '@/lib/supabase/client'
import { compressInspectionImage, validateImageFile } from '@/lib/services/imageCompression'
import { uploadInspectionImage } from '@/lib/services/maintenancePhotoUploadHelper'
import type { MaintenanceDoorPhoto } from '@/lib/types/maintenance.types'

type PhotoUploaderProps = {
  reportId?: string
  doorId: string
  photos: MaintenanceDoorPhoto[]
  disabled?: boolean
  isOffline?: boolean
  onChange: (photos: MaintenanceDoorPhoto[]) => void
}

type UploadStatus = 'compressing' | 'uploading' | 'done' | 'error'

type UploadItem = {
  id: string
  name: string
  previewUrl: string
  progress: number
  status: UploadStatus
  error?: string
}

type ToastItem = {
  id: string
  type: 'error' | 'success' | 'info'
  message: string
}

/** Full-screen preview: saved photos or in-progress upload thumbnails */
type PhotoPreviewState =
  | null
  | { kind: 'saved'; index: number }
  | { kind: 'upload'; id: string }

const MAX_FILE_SIZE_MB = 10

export function PhotoUploader({ reportId, doorId, photos, disabled = false, isOffline = false, onChange }: PhotoUploaderProps) {
  const supabase = useMemo(() => createSupabaseClient(), [])
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const photosRef = useRef<MaintenanceDoorPhoto[]>(photos)
  const [isDragging, setIsDragging] = useState(false)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [photoPreview, setPhotoPreview] = useState<PhotoPreviewState>(null)

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  const isUploading = uploads.some(item => item.status === 'compressing' || item.status === 'uploading')

  const showToast = (type: ToastItem['type'], message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev, { id, type, message }])

    window.setTimeout(() => {
      setToasts(prev => prev.filter(item => item.id !== id))
    }, 4500)
  }

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(item => item.id !== id))
  }

  const updateUpload = (id: string, patch: Partial<UploadItem>) => {
    setUploads(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(item => item.id !== id))
  }

  useEffect(() => {
    return () => {
      uploads.forEach(item => {
        URL.revokeObjectURL(item.previewUrl)
      })
    }
  }, [uploads])

  const handleCameraClick = () => {
    if (disabled || isUploading) return
    cameraInputRef.current?.click()
  }

  const handleUploadClick = () => {
    if (disabled || isUploading) return
    fileInputRef.current?.click()
  }

  const appendPhoto = (photo: MaintenanceDoorPhoto) => {
    const next = [...photosRef.current, photo]
    photosRef.current = next
    onChange(next)
  }

  const uploadOneFile = async (file: File) => {
    const validationError = validateImageFile(file, MAX_FILE_SIZE_MB)
    if (validationError) {
      showToast('error', validationError)
      return
    }

    const id = `${Date.now()}-${crypto.randomUUID()}`
    const previewUrl = URL.createObjectURL(file)

    setUploads(prev => [
      ...prev,
      {
        id,
        name: file.name,
        previewUrl,
        progress: 5,
        status: 'compressing',
      },
    ])

    try {
      updateUpload(id, { progress: 20, status: 'compressing' })

      const compressedFile = await compressInspectionImage(file)

      const offlineMode = isOffline || !navigator.onLine

      if (offlineMode) {
        updateUpload(id, { progress: 70, status: 'uploading' })
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onerror = () => reject(new Error('Failed to read image'))
          reader.onload = () => resolve(String(reader.result ?? ''))
          reader.readAsDataURL(compressedFile)
        })

        const offlinePhoto: MaintenanceDoorPhoto = {
          url: dataUrl,
          path: `offline/${id}`,
          offline_data_url: dataUrl,
          offline_content_type: compressedFile.type || file.type || 'image/jpeg',
          offline_filename: compressedFile.name || file.name || 'photo.jpg',
        }

        appendPhoto(offlinePhoto)
        updateUpload(id, { progress: 100, status: 'done' })
        showToast('success', `${file.name} saved offline.`)
        window.setTimeout(() => {
          URL.revokeObjectURL(previewUrl)
          removeUpload(id)
        }, 900)
        return
      }

      updateUpload(id, { progress: 45, status: 'uploading' })

      const uploaded = await uploadInspectionImage({
        supabase,
        reportId: reportId || 'local-draft',
        doorId,
        file: compressedFile,
        onProgress: percent => {
          const mapped = Math.min(100, Math.max(45, percent))
          updateUpload(id, { progress: mapped, status: 'uploading' })
        },
      })

      appendPhoto(uploaded)

      updateUpload(id, { progress: 100, status: 'done' })
      showToast('success', `${file.name} uploaded successfully.`)

      window.setTimeout(() => {
        URL.revokeObjectURL(previewUrl)
        removeUpload(id)
      }, 900)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.'
      updateUpload(id, { progress: 100, status: 'error', error: message })
      showToast('error', message)
    }
  }

  const uploadManyFiles = async (files: File[]) => {
    const list = files.filter(Boolean)
    if (list.length === 0) return

    if (isOffline || !navigator.onLine) {
      for (const file of list) {
        await uploadOneFile(file)
      }
      return
    }

    const concurrency = 3
    let index = 0

    const worker = async () => {
      while (true) {
        const current = list[index]
        if (!current) return
        index += 1
        await uploadOneFile(current)
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, () => worker()))
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (files.length === 0 || disabled) return

    await uploadManyFiles(files)
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = Array.from(event.dataTransfer.files ?? []).filter(file => file.type.startsWith('image/'))
    if (files.length === 0) {
      showToast('error', 'Only image files are supported.')
      return
    }

    await uploadManyFiles(files)
  }

  const removePhoto = async (photo: MaintenanceDoorPhoto) => {
    const next = photos.filter(item => item.path !== photo.path)
    onChange(next)

    if (photo.path) {
      if (photo.path.startsWith('offline/')) {
        return
      }
      await supabase.storage.from('maintenance-images').remove([photo.path])
    }
  }

  useEffect(() => {
    if (photoPreview === null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPhotoPreview(null)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setPhotoPreview(p => {
          if (!p) return p
          if (p.kind === 'saved' && p.index > 0) return { kind: 'saved', index: p.index - 1 }
          if (p.kind === 'upload') {
            const ix = uploads.findIndex(u => u.id === p.id)
            if (ix > 0) return { kind: 'upload', id: uploads[ix - 1]!.id }
          }
          return p
        })
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setPhotoPreview(p => {
          if (!p) return p
          if (p.kind === 'saved' && p.index < photos.length - 1) {
            return { kind: 'saved', index: p.index + 1 }
          }
          if (p.kind === 'upload') {
            const ix = uploads.findIndex(u => u.id === p.id)
            if (ix >= 0 && ix < uploads.length - 1) return { kind: 'upload', id: uploads[ix + 1]!.id }
          }
          return p
        })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [photoPreview, photos.length, uploads])

  useEffect(() => {
    if (photoPreview === null) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [photoPreview])

  useEffect(() => {
    if (photoPreview?.kind !== 'saved') return
    if (photos.length === 0) {
      setPhotoPreview(null)
      return
    }
    if (photoPreview.index >= photos.length) {
      setPhotoPreview({ kind: 'saved', index: photos.length - 1 })
    }
  }, [photos.length, photoPreview])

  useEffect(() => {
    if (photoPreview?.kind !== 'upload') return
    if (!uploads.some(u => u.id === photoPreview.id)) {
      setPhotoPreview(null)
    }
  }, [uploads, photoPreview])

  const downloadPhoto = async (photo: MaintenanceDoorPhoto) => {
    try {
      const response = await fetch(photo.url)
      if (!response.ok) {
        throw new Error('Failed to download photo.')
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const extension = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
      link.href = objectUrl
      link.download = `maintenance-photo-${Date.now()}.${extension}`
      link.click()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download photo.'
      showToast('error', message)
    }
  }

  const downloadBlobUrl = async (blobUrl: string) => {
    try {
      const response = await fetch(blobUrl)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const extension = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
      link.href = objectUrl
      link.download = `maintenance-photo-${Date.now()}.${extension}`
      link.click()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download photo.'
      showToast('error', message)
    }
  }

  return (
    <div className="w-full space-y-3">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden w-full"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden w-full"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />

      <div
        aria-label="Upload inspection photos"
        onDragEnter={event => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={event => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={event => {
          event.preventDefault()
          setIsDragging(false)
        }}
        onDrop={handleDrop}
        className={`min-h-[140px] w-full rounded-xl border-2 border-dashed p-6 text-center transition ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-slate-700" />
            <Camera className="h-5 w-5 text-slate-700" />
          </div>

          <p className="text-sm font-semibold text-slate-800">📷 Upload Photos</p>
          <p className="text-xs text-slate-500">Drag and drop images</p>
          <p className="text-xs text-slate-500">or choose camera / files (multi-select supported)</p>

          <div className="mt-2 flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <button
              type="button"
              onClick={handleCameraClick}
              disabled={disabled || isUploading}
              className="h-12 w-full rounded-xl bg-slate-900 px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Take Photo'}
            </button>
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={disabled || isUploading}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 disabled:opacity-50"
            >
              Upload from Files
            </button>
          </div>
        </div>
      </div>

      {uploads.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {uploads.map(item => (
            <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setPhotoPreview({ kind: 'upload', id: item.id })}
                className="block w-full cursor-pointer text-left transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label={`Preview uploading file ${item.name}`}
              >
                <img src={item.previewUrl} alt={item.name} className="h-24 w-full rounded-t-xl object-cover" />
              </button>
              <div className="space-y-1 p-2">
                <p className="truncate text-xs font-medium text-slate-700">{item.name}</p>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${item.progress}%` }} />
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  {item.status === 'uploading' || item.status === 'compressing' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : item.status === 'error' ? (
                    <AlertCircle className="h-3 w-3 text-red-500" />
                  ) : null}
                  <span>
                    {item.status === 'compressing'
                      ? 'Compressing...'
                      : item.status === 'uploading'
                        ? `Uploading... ${item.progress}%`
                        : item.status === 'done'
                          ? 'Uploaded'
                          : item.error || 'Failed'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {photos.map((photo, index) => (
            <div key={photo.path} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setPhotoPreview({ kind: 'saved', index })}
                className="block w-full cursor-pointer text-left transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label={`View photo ${index + 1} full screen`}
              >
                <img
                  src={photo.url}
                  alt={`Inspection photo ${index + 1}`}
                  className="h-24 w-full rounded-xl object-cover"
                />
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  void downloadPhoto(photo)
                }}
                className="absolute right-11 top-1 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow hover:bg-white"
                aria-label="Download photo"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  void removePhoto(photo)
                }}
                className="absolute right-1 top-1 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow hover:bg-white"
                aria-label="Remove photo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {(() => {
        const previewSaved =
          photoPreview?.kind === 'saved' ? photos[photoPreview.index] : undefined
        const previewUpload =
          photoPreview?.kind === 'upload'
            ? uploads.find(u => u.id === photoPreview.id)
            : undefined
        const previewUrl = previewSaved?.url ?? previewUpload?.previewUrl
        if (!photoPreview || !previewUrl) return null

        const savedIdx = photoPreview.kind === 'saved' ? photoPreview.index : -1
        const uploadIx =
          photoPreview.kind === 'upload'
            ? uploads.findIndex(u => u.id === photoPreview.id)
            : -1
        const showPrev =
          (photoPreview.kind === 'saved' && photos.length > 1 && savedIdx > 0) ||
          (photoPreview.kind === 'upload' && uploads.length > 1 && uploadIx > 0)
        const showNext =
          (photoPreview.kind === 'saved' &&
            photos.length > 1 &&
            savedIdx < photos.length - 1) ||
          (photoPreview.kind === 'upload' &&
            uploads.length > 1 &&
            uploadIx >= 0 &&
            uploadIx < uploads.length - 1)
        const positionLabel =
          photoPreview.kind === 'saved'
            ? `${savedIdx + 1} / ${photos.length}`
            : uploadIx >= 0
              ? `${uploadIx + 1} / ${uploads.length}`
              : ''

        return (
          <div
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Photo preview"
            onClick={() => setPhotoPreview(null)}
          >
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                setPhotoPreview(null)
              }}
              className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Close preview"
            >
              <X className="h-6 w-6" />
            </button>

            {showPrev ? (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setPhotoPreview(p => {
                    if (!p) return p
                    if (p.kind === 'saved' && p.index > 0) return { kind: 'saved', index: p.index - 1 }
                    if (p.kind === 'upload') {
                      const ix = uploads.findIndex(u => u.id === p.id)
                      if (ix > 0) return { kind: 'upload', id: uploads[ix - 1]!.id }
                    }
                    return p
                  })
                }}
                className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:left-4"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
            ) : null}
            {showNext ? (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setPhotoPreview(p => {
                    if (!p) return p
                    if (p.kind === 'saved' && p.index < photos.length - 1) {
                      return { kind: 'saved', index: p.index + 1 }
                    }
                    if (p.kind === 'upload') {
                      const ix = uploads.findIndex(u => u.id === p.id)
                      if (ix >= 0 && ix < uploads.length - 1) {
                        return { kind: 'upload', id: uploads[ix + 1]!.id }
                      }
                    }
                    return p
                  })
                }}
                className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:right-4"
                aria-label="Next photo"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                if (previewSaved) void downloadPhoto(previewSaved)
                else if (previewUpload) void downloadBlobUrl(previewUpload.previewUrl)
              }}
              className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-lg hover:bg-slate-100"
            >
              <Download className="h-4 w-4" />
              Download
            </button>

            <p className="absolute bottom-4 left-4 z-10 rounded bg-black/40 px-2 py-1 text-xs text-white/90">
              {positionLabel}
            </p>

            <div
              className="flex max-h-[90vh] max-w-[90vw] items-center justify-center"
              onClick={e => e.stopPropagation()}
            >
              <img
                src={previewUrl}
                alt="Full size inspection photo"
                className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
              />
            </div>
          </div>
        )
      })()}

      {toasts.length > 0 && (
        <div className="fixed right-4 top-4 z-[9999] flex max-w-sm flex-col gap-2">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow ${
                toast.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : toast.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700'
              }`}
            >
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss"
                className="opacity-70 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
