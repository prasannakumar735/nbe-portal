import { Font } from '@react-pdf/renderer'

let registered = false

function resolveFontOrigin(fontOrigin?: string): string {
  const trimmed = fontOrigin?.replace(/\/$/, '').trim()
  if (trimmed) return trimmed
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '').trim()
  if (fromEnv) return fromEnv
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`
  }
  return 'http://127.0.0.1:3000'
}

/**
 * Register Roboto for `@react-pdf/renderer`. Safe to call multiple times.
 * Uses `/public/fonts/roboto/*.TTF` via URL (works in browser and Node when fonts are fetchable).
 *
 * @param fontOrigin — e.g. `request.nextUrl.origin` in Route Handlers so dev servers on non-3000 ports work.
 */
export function registerRobotoForReactPdf(fontOrigin?: string): void {
  if (registered) return

  const origin = resolveFontOrigin(fontOrigin)
  const src = (file: string) => `${origin}/fonts/roboto/${file}`

  Font.register({
    family: 'Roboto',
    fonts: [
      { src: src('ROBOTO-LIGHT.TTF'), fontWeight: 300 },
      { src: src('ROBOTO-REGULAR.TTF'), fontWeight: 400 },
      { src: src('ROBOTO-MEDIUM.TTF'), fontWeight: 500 },
      { src: src('ROBOTO-BOLD.TTF'), fontWeight: 700 },
      { src: src('ROBOTO-ITALIC.TTF'), fontWeight: 400, fontStyle: 'italic' },
    ],
  })
  registered = true
}
