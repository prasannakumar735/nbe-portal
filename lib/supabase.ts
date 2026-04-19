'use client'

export { createSupabaseClient as getSupabaseClient } from './supabase/client'

import { createSupabaseClient } from './supabase/client'
export const supabase = createSupabaseClient()
