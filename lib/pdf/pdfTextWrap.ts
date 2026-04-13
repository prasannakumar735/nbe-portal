/**
 * Word-wrap for pdf-lib (no HTML/CSS). Splits on spaces; breaks long tokens to fit maxWidth.
 */
export type PdfFontMetrics = {
  widthOfTextAtSize: (text: string, size: number) => number
}

export function wrapPdfTextLines(
  text: string,
  font: PdfFontMetrics,
  fontSize: number,
  maxWidth: number,
  options?: { emptyPlaceholder?: string }
): string[] {
  const emptyPlaceholder = options?.emptyPlaceholder ?? '-'
  const raw = String(text ?? '').trim()
  if (!raw) return [emptyPlaceholder]

  const lines: string[] = []
  let line = ''

  const flush = () => {
    if (line) {
      lines.push(line)
      line = ''
    }
  }

  const pushHardBroken = (word: string) => {
    let chunk = ''
    for (let i = 0; i < word.length; i += 1) {
      const c = word[i]!
      const next = chunk + c
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth || chunk.length === 0) {
        chunk = next
      } else {
        lines.push(chunk)
        chunk = c
      }
    }
    if (chunk) line = chunk
  }

  for (const word of raw.split(/\s+/)) {
    if (!word) continue
    if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
      flush()
      pushHardBroken(word)
      continue
    }
    const trial = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(trial, fontSize) <= maxWidth) {
      line = trial
    } else {
      flush()
      line = word
    }
  }
  flush()
  return lines.length ? lines : [emptyPlaceholder]
}
