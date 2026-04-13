'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Camera, ChevronLeft, ChevronRight, Download, ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { createSupabaseClient } from '@/lib/supabase/client'
import { uploadMaintenancePhotos } from '@/lib/services/maintenancePhotoUpload'
import type { MaintenanceDoorPhoto } from '@/lib/types/maintenance.types'

type PhotoUploadProps = {
  reportId?: string
  doorId: string
  photos: MaintenanceDoorPhoto[]
  disabled?: boolean
  onChange: (photos: MaintenanceDoorPhoto[]) => void
}

export function PhotoUpload({ reportId, doorId, photos, disabled = false, onChange }: PhotoUploadProps) {
  const supabase = useMemo(() => createSupabaseClient(), [])
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  const openPicker = () => {
    if (disabled || isUploading) return
    inputRef.current?.click()
  }

  useEffect(() => {
    if (previewIndex === null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewIndex(null)
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setPreviewIndex(i => (i !== null && i > 0 ? i - 1 : i))
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setPreviewIndex(i => (i !== null && i < photos.length - 1 ? i + 1 : i))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewIndex, photos.length])

  useEffect(() => {
    if (previewIndex === null) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [previewIndex])

  useEffect(() => {
    if (previewIndex === null) return
    if (photos.length === 0) {
      setPreviewIndex(null)
      return
    }
    if (previewIndex >= photos.length) setPreviewIndex(photos.length - 1)
  }, [photos.length, previewIndex])

  const downloadPhoto = async (photo: MaintenanceDoorPhoto) => {
    try {
      const response = await fetch(photo.url)
      if (!response.ok) throw new Error('Failed to download photo.')
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const extension = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
      link.href = objectUrl
      link.download = `maintenance-photo-${Date.now()}.${extension}`
      link.click()
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    }
  }

  const handleUpload = async (files: File[]) => {
    if (files.length === 0 || disabled || isUploading) return

    setError('')
    setProgress(0)
    setIsUploading(true)

    try {
      const uploaded = await uploadMaintenancePhotos({
        supabase,
        reportId: reportId || 'local-draft',
        doorId,
        files,
        onProgress: percent => setProgress(percent),
      })

      onChange([...photos, ...uploaded])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    await handleUpload(files)
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)

    const files = Array.from(event.dataTransfer.files ?? []).filter(file => file.type.startsWith('image/'))
    await handleUpload(files)
  }

  const removePhoto = async (photo: MaintenanceDoorPhoto) => {
    const next = photos.filter(item => item.path !== photo.path)
    onChange(next)

    if (photo.path) {
      await supabase.storage.from('maintenance-images').remove([photo.path])
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={handleFileInput}
        disabled={disabled || isUploading}
      />

      <div
        aria-label="Upload door photos"
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
        className={`rounded-xl border-2 border-dashed p-4 transition md:p-6 ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-slate-700" />
            <Camera className="h-5 w-5 text-slate-700" />
          </div>
          <p className="text-sm font-semibold text-slate-800">Upload Photo</p>
          <p className="text-xs text-slate-500 md:hidden">Tap to select or capture photos</p>
          <p className="hidden text-xs text-slate-500 md:block">Drag and drop image files, or use the upload button</p>

          <button
            type="button"
            onClick={event => {
              event.stopPropagation()
              openPicker()
            }}
            disabled={disabled || isUploading}
            className="mt-2 h-12 w-full rounded-xl bg-slate-900 px-5 text-sm font-bold text-white disabled:opacity-50 md:w-auto"
          >
            {isUploading ? 'Uploading...' : 'Upload Photos'}
          </button>
        </div>
      </div>

      {isUploading && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-blue-700">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading {progress}%
          </div>
          <div className="h-2 rounded-full bg-blue-100">
            <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-xs font-semibold text-red-700">{error}</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <div key={photo.path} className="relative overflow-hidden rounded-lg">
              <button
                type="button"
                onClick={() => setPreviewIndex(index)}
                className="block w-full cursor-pointer text-left transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label={`View photo ${index + 1} full screen`}
              >
                <img src={photo.url} alt={`Door photo ${index + 1}`} className="h-24 w-full rounded-lg object-cover" />
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

      {previewIndex !== null && photos[previewIndex] ? (
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
          onClick={() => setPreviewIndex(null)}
        >
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              setPreviewIndex(null)
            }}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close preview"
          >
            <X className="h-6 w-6" />
          </button>

          {photos.length > 1 ? (
            <>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setPreviewIndex(i => (i !== null && i > 0 ? i - 1 : i))
                }}
                disabled={previewIndex <= 0}
                className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 md:left-4"
                aria-label="Previous photo"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setPreviewIndex(i =>
                    i !== null && i < photos.length - 1 ? i + 1 : i,
                  )
                }}
                disabled={previewIndex >= photos.length - 1}
                className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 md:right-4"
                aria-label="Next photo"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              void downloadPhoto(photos[previewIndex]!)
            }}
            className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-lg hover:bg-slate-100"
          >
            <Download className="h-4 w-4" />
            Download
          </button>

          <p className="absolute bottom-4 left-4 z-10 rounded bg-black/40 px-2 py-1 text-xs text-white/90">
            {previewIndex + 1} / {photos.length}
          </p>

          <div
            className="flex max-h-[90vh] max-w-[90vw] items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={photos[previewIndex]!.url}
              alt={`Photo ${previewIndex + 1} full size`}
              className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
