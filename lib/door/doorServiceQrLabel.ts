import { buildDoorSerialSuffix } from '@/lib/door/doorSerial'

export const DOOR_SERVICE_QR_LABEL_TEMPLATE_SRC = '/door_QR_Code.jpeg'

type Rgb = { r: number; g: number; b: number }

function isWhite(p: Rgb, threshold = 230): boolean {
  return p.r >= threshold && p.g >= threshold && p.b >= threshold
}

function isBlack(p: Rgb, threshold = 45): boolean {
  return p.r <= threshold && p.g <= threshold && p.b <= threshold
}

/** Largest solid white square in the central band (QR placeholder on the template). */
export function findQrPlaceholderBox(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; size: number } | null {
  const minY = Math.floor(height * 0.22)
  const maxY = Math.floor(height * 0.76)
  const minX = Math.floor(width * 0.1)
  const maxX = Math.floor(width * 0.9)

  let best: { x: number; y: number; size: number } | null = null
  let bestArea = 0
  const step = 2

  const pixel = (x: number, y: number): Rgb => {
    const i = (y * width + x) * 4
    return { r: data[i], g: data[i + 1], b: data[i + 2] }
  }

  for (let y = minY; y < maxY; y += step) {
    for (let x = minX; x < maxX; x += step) {
      if (!isWhite(pixel(x, y))) continue

      let size = 0
      while (x + size < maxX && isWhite(pixel(x + size, y))) {
        size += step
      }
      if (size < 40) continue

      let square = true
      for (let dy = 0; dy < size && square; dy += step) {
        for (let dx = 0; dx < size; dx += step) {
          if (!isWhite(pixel(x + dx, y + dy))) {
            square = false
            break
          }
        }
      }
      if (!square) continue

      const area = size * size
      if (area > bestArea) {
        bestArea = area
        best = { x, y, size }
      }
    }
  }

  return best
}

/** QR white frame position on the reference art (47.5 × 76 mm label). */
function computeQrBoxFromLabelBounds(
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  },
  canvasWidth: number,
): { x: number; y: number; size: number } {
  const labelWidth = bounds.maxX - bounds.minX
  const labelHeight = bounds.maxY - bounds.minY
  const fullBleedLabel = labelWidth / canvasWidth > 0.85
  const widthRatio = fullBleedLabel ? 333 / 560 : 0.402
  const yRatio = fullBleedLabel ? 316 / 894 : 0.355
  const size = Math.round(labelWidth * widthRatio)
  const x = Math.round(bounds.minX + (labelWidth - size) / 2)
  const y = Math.round(bounds.minY + labelHeight * yRatio)
  return { x, y, size }
}

function resolveQrPlaceholderBox(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; size: number } {
  const fromScan = findQrPlaceholderBox(data, width, height)
  if (fromScan) return fromScan

  const labelBounds = findLabelBlackBounds(data, width, height)
  if (!labelBounds) {
    throw new Error('Could not locate QR placeholder on label template.')
  }
  return computeQrBoxFromLabelBounds(labelBounds, width)
}

/** Small white rectangle beside "Serial No. P" for dynamic digits. */
export function findSerialFillBox(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  qrBox: { x: number; y: number; size: number },
): { x: number; y: number; width: number; height: number } | null {
  const minY = Math.floor(height * 0.72)
  const maxY = Math.floor(height * 0.86)
  const minX = Math.floor(width * 0.35)
  const maxX = Math.floor(width * 0.92)
  const step = 2

  const pixel = (x: number, y: number): Rgb => {
    const i = (y * width + x) * 4
    return { r: data[i], g: data[i + 1], b: data[i + 2] }
  }

  let best: { x: number; y: number; width: number; height: number } | null = null
  let bestArea = 0

  for (let y = minY; y < maxY; y += step) {
    for (let x = minX; x < maxX; x += step) {
      if (!isWhite(pixel(x, y))) continue

      let rectWidth = 0
      while (x + rectWidth < maxX && isWhite(pixel(x + rectWidth, y))) {
        rectWidth += step
      }
      if (rectWidth < 36 || rectWidth > 160) continue

      let rectHeight = 0
      let solid = true
      while (solid && y + rectHeight < maxY) {
        for (let dx = 0; dx < rectWidth; dx += step) {
          if (!isWhite(pixel(x + dx, y + rectHeight))) {
            solid = false
            break
          }
        }
        if (solid) rectHeight += step
      }
      if (rectHeight < 10 || rectHeight > 48) continue

      const area = rectWidth * rectHeight
      if (area >= qrBox.size * qrBox.size * 0.2) continue

      if (area > bestArea) {
        bestArea = area
        best = { x, y, width: rectWidth, height: rectHeight }
      }
    }
  }

  return best
}

function computeSerialFillBoxFromLabelBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  canvasWidth: number,
): { x: number; y: number; width: number; height: number } {
  const labelWidth = bounds.maxX - bounds.minX
  const labelHeight = bounds.maxY - bounds.minY
  const fullBleedLabel = labelWidth / canvasWidth > 0.85
  const xRatio = fullBleedLabel ? 311 / 560 : 0.52
  const yRatio = fullBleedLabel ? 685 / 894 : 0.76
  const wRatio = fullBleedLabel ? 92 / 560 : 0.16
  const hRatio = fullBleedLabel ? 22 / 894 : 0.028

  return {
    x: Math.round(bounds.minX + labelWidth * xRatio),
    y: Math.round(bounds.minY + labelHeight * yRatio),
    width: Math.round(labelWidth * wRatio),
    height: Math.round(labelHeight * hRatio),
  }
}

function resolveSerialFillBox(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  qrBox: { x: number; y: number; size: number },
): { x: number; y: number; width: number; height: number } | null {
  const fromScan = findSerialFillBox(data, width, height, qrBox)
  if (fromScan) return fromScan

  const labelBounds = findLabelBlackBounds(data, width, height)
  if (!labelBounds) return null
  return computeSerialFillBoxFromLabelBounds(labelBounds, width)
}

function findLabelBlackBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  let found = false
  const step = 3

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      const p = { r: data[i], g: data[i + 1], b: data[i + 2] }
      if (!isBlack(p)) continue
      found = true
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  if (!found) return null
  return { minX, minY, maxX, maxY }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

async function loadRobotoRegular(): Promise<FontFace | null> {
  if (typeof FontFace === 'undefined') return null
  try {
    const face = new FontFace('Roboto', 'url(/fonts/roboto/ROBOTO-REGULAR.TTF)')
    await face.load()
    document.fonts.add(face)
    return face
  } catch {
    return null
  }
}

export type ComposeDoorServiceQrLabelOptions = {
  qrImageSrc: string
  doorLabel: string
  doorSerial?: string | null
  templateSrc?: string
}

export async function composeDoorServiceQrLabelPngDataUrl(
  options: ComposeDoorServiceQrLabelOptions,
): Promise<string> {
  const templateSrc = options.templateSrc ?? DOOR_SERVICE_QR_LABEL_TEMPLATE_SRC
  await loadRobotoRegular()

  const [templateImage, qrImage] = await Promise.all([
    loadImage(templateSrc),
    loadImage(options.qrImageSrc),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = templateImage.naturalWidth
  canvas.height = templateImage.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Failed to create canvas context.')
  }

  context.drawImage(templateImage, 0, 0)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const qrBox = resolveQrPlaceholderBox(imageData.data, canvas.width, canvas.height)

  context.fillStyle = '#ffffff'
  context.fillRect(qrBox.x, qrBox.y, qrBox.size, qrBox.size)

  const qrInsetRatio = (81 - 70) / (2 * 81)
  const inset = qrBox.size * qrInsetRatio
  const qrDrawSize = qrBox.size - inset * 2
  context.drawImage(qrImage, qrBox.x + inset, qrBox.y + inset, qrDrawSize, qrDrawSize)

  const serialSuffix = buildDoorSerialSuffix(options.doorLabel, options.doorSerial)
  const serialBox = resolveSerialFillBox(imageData.data, canvas.width, canvas.height, qrBox)

  if (serialBox && serialSuffix) {
    context.fillStyle = '#ffffff'
    context.fillRect(serialBox.x, serialBox.y, serialBox.width, serialBox.height)

    const fontSize = Math.max(9, serialBox.height * 0.72)
    context.fillStyle = '#000000'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = `${fontSize}px Roboto, Arial, sans-serif`
    context.fillText(
      serialSuffix,
      serialBox.x + serialBox.width / 2,
      serialBox.y + serialBox.height / 2,
    )
  }

  return canvas.toDataURL('image/png')
}
