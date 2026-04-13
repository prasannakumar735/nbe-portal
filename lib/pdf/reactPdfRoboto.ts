import { existsSync } from 'fs'
import path from 'path'
import { Font } from '@react-pdf/renderer'

const DIR = path.join(process.cwd(), 'public', 'fonts', 'roboto')

let registered = false

/** Register Roboto for @react-pdf/renderer (server-side export). Safe to call multiple times. */
export function registerRobotoForReactPdf(): void {
  if (registered) return
  if (!existsSync(path.join(DIR, 'ROBOTO-REGULAR.TTF'))) return

  Font.register({
    family: 'Roboto',
    fonts: [
      { src: path.join(DIR, 'ROBOTO-LIGHT.TTF'), fontWeight: 300 },
      { src: path.join(DIR, 'ROBOTO-REGULAR.TTF'), fontWeight: 400 },
      { src: path.join(DIR, 'ROBOTO-MEDIUM.TTF'), fontWeight: 500 },
      { src: path.join(DIR, 'ROBOTO-BOLD.TTF'), fontWeight: 700 },
      { src: path.join(DIR, 'ROBOTO-ITALIC.TTF'), fontWeight: 400, fontStyle: 'italic' },
    ],
  })
  registered = true
}
