export function stripNullBytes(input: string): string {
  return input.replace(/\0/g, '')
}

export function clampTextLength(input: string, max: number): string {
  if (input.length <= max) return input
  return input.slice(0, max)
}

export function sanitizePlainText(input: string, maxLength: number): string {
  return stripNullBytes(clampTextLength(input, maxLength)).trimEnd()
}
