
export function defaultBillableFromLevel1Code(code: string | null | undefined): boolean {
  const c = (code ?? '').trim().toUpperCase()
  return c === 'FAB' || c === 'OPS'
}
