/** Rough mainland Australia + Tasmania bounds (matches calendar geocode route). */
export function isWithinAustralia(lat: number, lng: number): boolean {
  if (lat > 0) return false
  if (lat < -45 || lat > -9) return false
  if (lng < 110 || lng > 155) return false
  return true
}
