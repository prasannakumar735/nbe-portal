import { createBrowserClient } from '@supabase/ssr'

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseUrl = rawSupabaseUrl
	? rawSupabaseUrl.startsWith('http')
		? rawSupabaseUrl
		: `https://${rawSupabaseUrl}.supabase.co`
	: ''

const supabasePublishableKey =
	process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

if (!supabaseUrl) {
	throw new Error(
		'NEXT_PUBLIC_SUPABASE_URL is required. Use full URL (https://<project>.supabase.co) or project ref only.'
	)
}

if (!supabasePublishableKey) {
	throw new Error(
		'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) is required.'
	)
}

if (supabasePublishableKey.startsWith('sb_secret_')) {
	throw new Error(
		'Supabase secret keys (sb_secret_*) must never be exposed via NEXT_PUBLIC_* variables. Use a publishable/anon key for client-side access.'
	)
}

export const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey)
