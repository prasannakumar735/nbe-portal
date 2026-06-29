export const SALES_CAMPAIGN_BUILDER_SESSION_KEY = 'nbe_sales_campaign_builder_draft'

export type CampaignBuilderSessionPayload = {
  selectedEmailIds: string[]
  selectedBusinessIds: string[]
}

export function saveCampaignBuilderSession(payload: CampaignBuilderSessionPayload): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(SALES_CAMPAIGN_BUILDER_SESSION_KEY, JSON.stringify(payload))
}

export function loadCampaignBuilderSession(): CampaignBuilderSessionPayload | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(SALES_CAMPAIGN_BUILDER_SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CampaignBuilderSessionPayload
    if (
      !Array.isArray(parsed.selectedEmailIds) ||
      !Array.isArray(parsed.selectedBusinessIds)
    ) {
      return null
    }
    return {
      selectedEmailIds: parsed.selectedEmailIds.map(String),
      selectedBusinessIds: parsed.selectedBusinessIds.map(String),
    }
  } catch {
    return null
  }
}

export function clearCampaignBuilderSession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SALES_CAMPAIGN_BUILDER_SESSION_KEY)
}
