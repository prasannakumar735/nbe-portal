'use client'

import Link from 'next/link'
import { SalesEngineAdminShell } from '@/components/sales-engine/admin/SalesEngineAdminShell'

export function SalesEngineAdminAiSettingsPage() {
  return (
    <SalesEngineAdminShell
      title="AI settings"
      description="AI writing standards and prompt content are managed via the canonical framework and Prompt Library."
    >
      <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
        <li>
          <Link
            href="/dashboard/sales-engine/prompt-library"
            className="font-medium text-indigo-700 hover:text-indigo-900"
          >
            Prompt Library
          </Link>{' '}
          — product × industry × use case prompts, versioning, and activation.
        </li>
        <li>
          Global NBE email methodology is injected at assembly time from the canonical B2B framework
          (not duplicated here).
        </li>
        <li>Feature flags for AI reply analysis and draft generation are under Feature flags.</li>
      </ul>
    </SalesEngineAdminShell>
  )
}
