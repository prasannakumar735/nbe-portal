import { NextRequest } from 'next/server'
import { runMaintenanceSubmit } from '@/lib/maintenance/runMaintenanceSubmit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  return runMaintenanceSubmit(request)
}
