import type { SupabaseClient } from '@supabase/supabase-js'
import { listSalesGeneratedEmailsByCampaign } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import type { SalesGeneratedEmail } from '@/lib/sales/types/generatedEmail.types'

/** Prior emails in the same thread (oldest first) for follow-up context. */
export async function listThreadEmailsForFollowup(
  supabase: SupabaseClient,
  input: {
    campaignId: string
    contactId: string
    threadRootEmailId: string
  },
): Promise<SalesGeneratedEmail[]> {
  const rows = await listSalesGeneratedEmailsByCampaign(supabase, input.campaignId, {
    contactId: input.contactId,
  })
  const inThread = rows.filter(
    (row) => row.id === input.threadRootEmailId || row.thread_root_email_id === input.threadRootEmailId,
  )
  return inThread.sort((a, b) => {
    const pos = a.sequence_position - b.sequence_position
    if (pos !== 0) return pos
    return a.version - b.version
  })
}

export function formatThreadContextBlock(emails: SalesGeneratedEmail[]): string {
  if (emails.length === 0) {
    return '## Thread history\n(no prior messages loaded)'
  }
  const sections = emails.map((email, index) => {
    return [
      `### Message ${index + 1} (v${email.version}, position ${email.sequence_position}, status ${email.status})`,
      `Subject: ${email.subject}`,
      '',
      email.body,
    ].join('\n')
  })
  return [
    '## Thread history (reference only — do not copy wording)',
    'Write a new follow-up that advances the conversation. Do not repeat sentences or subject lines from prior messages.',
    'Use Australian English; stay professional and consultative.',
    '',
    ...sections,
  ].join('\n\n')
}
