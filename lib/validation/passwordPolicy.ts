export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export function validatePasswordPolicy(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Use at most ${PASSWORD_MAX_LENGTH} characters.`)
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Include at least one lowercase letter.')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Include at least one uppercase letter.')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Include at least one number.')
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Include at least one special character (e.g. !@#$%^&*).')
  }
  // Reject obvious whitespace-only padding
  if (password.trim() !== password) {
    errors.push('Do not start or end the password with spaces.')
  }
  return { valid: errors.length === 0, errors }
}

export function passwordPolicySummary(): string {
  return 'At least 8 characters, including uppercase, lowercase, a number, and a special character.'
}
