import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Supabase client for Edge middleware — reads session from cookies and can refresh session.
 * Must not use the service role key here.
 *
 * @param forwardedHeaders — Pass through headers from middleware (e.g. `x-nonce` + CSP) so Next.js can
 *   attach nonces to streamed HTML; must be reused on every `NextResponse.next` refresh.
 */
export function createSupabaseMiddlewareClient(request: NextRequest, forwardedHeaders: Headers) {
  function nextWithForwardedHeaders() {
    return NextResponse.next({
      request: { headers: forwardedHeaders },
    })
  }

  let response = nextWithForwardedHeaders()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = nextWithForwardedHeaders()
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  return { supabase, response }
}
