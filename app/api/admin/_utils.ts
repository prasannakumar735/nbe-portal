import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { isManagerOrAdminRole } from '@/lib/auth/roles'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { securityLogApiForbidden, securityLogApiUnauthorized } from '@/lib/security/securityLogger'
import { getApiSecurityContext, type SecurityRequest } from '@/lib/security/withSecurityLogging'

type AuthResult =
  | { ok: true; userId: string; role: string; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }

/**
 * Confirms JWT + manager/admin role before returning a **service role** client.
 * Never expose `createServiceRoleClient()` to routes that skip this check — it bypasses RLS.
 */
export async function requireManagerOrAdminApi(request?: SecurityRequest): Promise<AuthResult> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    if (request) {
      const path = 'nextUrl' in request ? request.nextUrl.pathname : new URL(request.url).pathname
      const sec = getApiSecurityContext(request, `${request.method} ${path}`)
      securityLogApiUnauthorized(
        {
          path: sec.path,
          method: sec.method,
          ip: sec.ip,
          reason: 'no_session',
          user_agent: sec.user_agent,
          route_name: sec.route_name,
          correlation_id: sec.correlation_id,
        },
        request,
      )
    }
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = String((profile as { role?: string } | null)?.role ?? '').trim()
  if (!isManagerOrAdminRole(role)) {
    if (request) {
      const path = 'nextUrl' in request ? request.nextUrl.pathname : new URL(request.url).pathname
      const sec = getApiSecurityContext(request, `${request.method} ${path}`)
      securityLogApiForbidden(
        {
          path: sec.path,
          method: sec.method,
          ip: sec.ip,
          userId: user.id,
          reason: 'not_manager_or_admin',
          user_agent: sec.user_agent,
          route_name: sec.route_name,
          correlation_id: sec.correlation_id,
        },
        request,
      )
    }
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true, userId: user.id, role, supabase: createServiceRoleClient() }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status })
}

export function fail(error: string, status = 400, issues?: unknown) {
  return NextResponse.json({ ok: false, error, issues }, { status })
}
