import { readFile } from 'fs/promises'
import { join } from 'path'

export async function loadNbeLogoBytes(): Promise<Uint8Array | null> {
  for (const logoPath of ['nbe-logo.png', 'logo/nbe-logo.png', 'logo.png']) {
    try {
      return new Uint8Array(await readFile(join(process.cwd(), 'public', logoPath)))
    } catch {
      // try next
    }
  }
  return null
}
