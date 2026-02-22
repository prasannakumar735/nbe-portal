'use client'

/**
 * DEPRECATED: This file is now a re-export for backward compatibility
 * 
 * New code should import directly:
 * import { createSupabaseClient } from '@/lib/supabase/client'
 * 
 * This file maintains old imports to avoid breaking existing code.
 */

export { createSupabaseClient as getSupabaseClient } from './supabase/client'

// Default export for backward compatibility
import { createSupabaseClient } from './supabase/client'
export const supabase = createSupabaseClient()
