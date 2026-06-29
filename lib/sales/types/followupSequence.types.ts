export type SalesFollowupSequence = {
  id: string
  campaign_id: string
  enabled: boolean
  max_followups: number
  followup_delay_days: number
  stop_on_reply: boolean
  created_at: string
}

export type SalesFollowupSequenceInsert = {
  campaign_id: string
  enabled?: boolean
  max_followups?: number
  followup_delay_days?: number
  stop_on_reply?: boolean
}

export type SalesFollowupSequenceUpdate = Partial<
  Pick<
    SalesFollowupSequence,
    'enabled' | 'max_followups' | 'followup_delay_days' | 'stop_on_reply'
  >
>
