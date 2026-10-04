import { NextRequest } from 'next/server'
import { runMaintenanceSubmit } from '@/lib/maintenance/runMaintenanceSubmit'



export async function POST(request: NextRequest) {
  return runMaintenanceSubmit(request)
}
