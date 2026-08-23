import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

const TOOLS = [
  {
    href: '/dashboard/sales-engine/pipeline',
    icon: 'account_tree',
    label: 'CRM Pipeline',
    description: 'Track deals from lead through won/lost — revenue, probability, owner, follow-ups.',
  },
  {
    href: '/dashboard/sales-engine/analytics',
    icon: 'bar_chart',
    label: 'Analytics',
    description: 'Campaign performance, open rates, click rates, and engagement trends.',
  },
  {
    href: '/dashboard/sales-engine/assistant',
    icon: 'smart_toy',
    label: 'AI Assistant',
    description: 'Ask questions about your campaigns, contacts, and outreach strategy.',
  },
  {
    href: '/dashboard/sales-engine/agents',
    icon: 'manage_accounts',
    label: 'Agents',
    description: 'Monitor and trigger Sales Engine background agents.',
  },
  {
    href: '/dashboard/sales-engine/offer-assets',
    icon: 'folder_open',
    label: 'Offer Brochures',
    description: 'Manage product brochures attached to outreach emails.',
  },
] as const

export default async function SalesEngineToolsPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    redirect('/dashboard')
  }

  return (
    <div className="w-full min-w-0 max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Tools</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sales Engine operational tools — pipeline, analytics, AI, agents, and offer assets.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <span className="material-symbols-outlined mt-0.5 text-[28px] text-indigo-500 shrink-0">
              {tool.icon}
            </span>
            <div>
              <p className="font-semibold text-slate-900">{tool.label}</p>
              <p className="mt-1 text-sm text-slate-500">{tool.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
