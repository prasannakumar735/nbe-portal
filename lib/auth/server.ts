/**
 * Server-side auth utilities for Next.js App Router
 * 
 * IMPORTANT: These functions ONLY read cookies and session data.
 * They do NOT modify cookies (which would throw errors in Server Components).
 */

import { cookies } from 'next/headers'

export async function getServerSessionFromCookies() {
  try {
    const cookieStore = await cookies()
    const authCookie = cookieStore.get('sb-nzfmwpcieontrjzbirma-auth-token')
    
    if (!authCookie?.value) {
      return null
    }

    // Parse the session from the cookie (base64-encoded)
    try {
      // Decode base64 to UTF-8 string
      const decodedValue = Buffer.from(authCookie.value, 'base64').toString('utf8')
      const session = JSON.parse(decodedValue)
      return session
    } catch {
      return null
    }
  } catch (error) {
    console.error('Error reading session from cookies:', error)
    return null
  }
}

/**
 * Check if user is authenticated on the server
 * This is a basic check - actual auth should be via client-side Supabase
 */
export async function isServerAuthenticated(): Promise<boolean> {
  const session = await getServerSessionFromCookies()
  return !!session
}

/**
 * Get user ID from server cookies (read-only, safe for Server Components)
 */
export async function getServerUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    // The Supabase auth cookie is base64-encoded JSON
    
    const authCookie = cookieStore.get('sb-nzfmwpcieontrjzbirma-auth-token')
    if (authCookie?.value) {
      try {
        // Decode base64 to UTF-8 string
        const decodedValue = Buffer.from(authCookie.value, 'base64').toString('utf8')
        const session = JSON.parse(decodedValue)
        return session.user?.id || null
      } catch {
        // Cookie is not valid base64+JSON, return null gracefully
        return null
      }
    }
    return null
  } catch (error) {
    console.error('Error extracting user ID:', error)
    return null
  }
}
