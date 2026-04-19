import { z } from 'zod'

/** Forgot / auth flows — keep tight bounds to reduce abuse surface. */
export const forgotPasswordBodySchema = z.object({
  email: z.string().max(320),
  /** Cloudflare Turnstile response token (required when Turnstile is configured). */
  turnstileToken: z.string().min(1).max(4096).optional(),
})

export const loginBodySchema = z.object({
  email: z.string().max(320),
  password: z.string().min(1).max(512),
  turnstileToken: z.string().min(1).max(4096).optional(),
})

export const resetPasswordConfirmBodySchema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(1).max(256),
})
