import imageCompression from 'browser-image-compression'

const DEFAULT_MAX_SIZE_MB = 10

export function validateImageFile(file: File, maxSizeMb = DEFAULT_MAX_SIZE_MB): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Unsupported format. Please upload image files only.'
  }

  const maxBytes = maxSizeMb * 1024 * 1024
  if (file.size > maxBytes) {
    return `File too large. Maximum size is ${maxSizeMb}MB per image.`
  }

  return null
}

export async function compressInspectionImage(file: File): Promise<File> {
  const compressed: Blob = await imageCompression(file, {
    maxWidthOrHeight: 1600,
    initialQuality: 0.7,
    useWebWorker: true,
  })

  if (compressed instanceof File) {
    return compressed
  }

  return new File([compressed], file.name, {
    type: compressed.type || file.type || 'image/jpeg',
    lastModified: Date.now(),
  })
}
