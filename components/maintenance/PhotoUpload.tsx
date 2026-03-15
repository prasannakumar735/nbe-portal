'use client'

import { useMemo, useRef, useState } from 'react'
import { AlertCircle, Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react'
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

  const openPicker = () => {
    if (disabled || isUploading) return
    inputRef.current?.click()
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
    // Reset the input value BEFORE uploading so the same file can be re-selected
    // if the user removes it and wants to re-upload it.
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
          {photos.map(photo => (
            <div key={photo.path} className="relative">
              <img src={photo.url} alt="Door upload preview" className="h-24 w-full rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => {
                  void removePhoto(photo)
                }}
                className="absolute right-1 top-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow"
                aria-label="Remove photo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
