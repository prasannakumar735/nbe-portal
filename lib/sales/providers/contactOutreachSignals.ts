/** Future engagement signals (opens, replies, bounces) adjust computed outreach priority. */
export type ContactEngagementSignals = {
  opened?: boolean
  replied?: boolean
  bounced?: boolean
  unsubscribed?: boolean
}

export function applyEngagementAdjustments(
  basePriority: number,
  signals: ContactEngagementSignals,
): number {
  let adjusted = basePriority
  if (signals.replied) adjusted += 15
  if (signals.opened) adjusted += 5
  if (signals.bounced) adjusted -= 40
  if (signals.unsubscribed) adjusted -= 50
  return Math.min(100, Math.max(0, adjusted))
}
