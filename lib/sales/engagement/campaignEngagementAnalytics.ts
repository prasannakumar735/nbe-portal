import type { SupabaseClient } from '@supabase/supabase-js'
import {
  countSalesEngagementEventsByCampaign,
  rollupSalesEngagementEventsByPrompt,
} from '@/lib/sales/repositories/salesEngagementEventRepository'
import { listSalesContactEngagementByCampaign } from '@/lib/sales/repositories/salesContactEngagementRepository'
import type { CampaignEngagementFunnel } from '@/lib/sales/types/engagementEvent.types'

function sumContactFlags(
  rows: Awaited<ReturnType<typeof listSalesContactEngagementByCampaign>>,
): Pick<
  CampaignEngagementFunnel,
  | 'contactsDelivered'
  | 'contactsOpened'
  | 'contactsClicked'
  | 'contactsReplied'
  | 'contactsBounced'
  | 'contactsUnsubscribed'
> {
  let contactsDelivered = 0
  let contactsOpened = 0
  let contactsClicked = 0
  let contactsReplied = 0
  let contactsBounced = 0
  let contactsUnsubscribed = 0
  for (const row of rows) {
    if (row.delivered) contactsDelivered += 1
    if (row.opened) contactsOpened += 1
    if (row.clicked) contactsClicked += 1
    if (row.reply_detected) contactsReplied += 1
    if (row.bounce_detected) contactsBounced += 1
    if (row.unsubscribed) contactsUnsubscribed += 1
  }
  return {
    contactsDelivered,
    contactsOpened,
    contactsClicked,
    contactsReplied,
    contactsBounced,
    contactsUnsubscribed,
  }
}

export async function getCampaignEngagementFunnel(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<CampaignEngagementFunnel> {
  const [eventCounts, contacts] = await Promise.all([
    countSalesEngagementEventsByCampaign(supabase, campaignId),
    listSalesContactEngagementByCampaign(supabase, campaignId),
  ])

  return {
    delivered: eventCounts.delivered,
    opened: eventCounts.opened,
    clicked: eventCounts.clicked,
    replied: eventCounts.replied,
    bounced: eventCounts.bounced,
    unsubscribed: eventCounts.unsubscribed,
    ...sumContactFlags(contacts),
  }
}

export type PromptPerformanceSnapshot = {
  prompt_name: string
  prompt_version: number
  delivered: number
  opened: number
  clicked: number
  replied: number
  bounced: number
  unsubscribed: number
  reply_rate: number | null
  open_rate: number | null
  click_rate: number | null
  sample_size: number
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 1000
}

export async function computePromptPerformanceSnapshots(
  supabase: SupabaseClient,
  options?: { campaignId?: string },
): Promise<PromptPerformanceSnapshot[]> {
  const rows = await rollupSalesEngagementEventsByPrompt(supabase, options)
  return rows.map((row) => {
    const sample = row.delivered
    return {
      ...row,
      sample_size: sample,
      reply_rate: rate(row.replied, sample),
      open_rate: rate(row.opened, sample),
      click_rate: rate(row.clicked, sample),
    }
  })
}

export async function persistPromptPerformanceSnapshots(
  supabase: SupabaseClient,
  snapshots: PromptPerformanceSnapshot[],
): Promise<number> {
  if (snapshots.length === 0) return 0
  const now = new Date().toISOString()
  const payload = snapshots.map((s) => ({
    prompt_name: s.prompt_name,
    prompt_version: s.prompt_version,
    reply_rate: s.reply_rate,
    approval_rate: null,
    conversion_rate: s.click_rate,
    sample_size: s.sample_size,
    computed_at: now,
  }))
  const { data, error } = await supabase.from('sales_ai_prompt_metrics').insert(payload).select('id')
  if (error) throw error
  return data?.length ?? 0
}
