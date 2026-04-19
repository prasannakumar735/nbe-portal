import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchIsManagerOrAdmin } from '@/lib/auth/supabase-role'
import { securityLogApiForbidden, securityLogApiUnauthorized } from '@/lib/security/securityLogger'
import { getApiSecurityContext, type SecurityRequest } from '@/lib/security/withSecurityLogging'

/**
 * @param request — When passed, 401/403 emit structured logs for monitoring (401/403 spikes per path/IP).
 */
export async function requireManagerReportsApi(
  supabase: SupabaseClient,
  request?: SecurityRequest,
): Promise<{ userId: string } | NextResponse> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    if (request) {
      const sec = getApiSecurityContext(request)
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const ok = await fetchIsManagerOrAdmin(supabase, user.id)
  if (!ok) {
    if (request) {
      const sec = getApiSecurityContext(request)
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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return { userId: user.id }
}
