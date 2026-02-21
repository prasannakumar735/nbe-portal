import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local')
}

const hasPlaceholderConfig =
  supabaseUrl.includes('replace-me') || supabaseAnonKey.includes('replace-me')

if (hasPlaceholderConfig) {
  throw new Error('Supabase environment variables still contain placeholder values. Update NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local with real project credentials.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
