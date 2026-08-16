import { z } from 'zod'

export const salesCampaignCatalogQuerySchema = z.object({
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v !== 'false'),
})

export const createSalesCampaignBodySchema = z.object({
  name: z.string().trim().min(1, 'Campaign name is required.').max(200),
  campaignTypeId: z.string().uuid(),
  offerTypeId: z.string().uuid(),
  selectedEmailIds: z.array(z.string().uuid()).min(1).max(500),
  selectedBusinessIds: z.array(z.string().uuid()).min(1).max(500),
})

export type CreateSalesCampaignBody = z.infer<typeof createSalesCampaignBodySchema>
