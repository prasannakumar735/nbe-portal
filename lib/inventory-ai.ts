type StockUsageInput = {
  productId: string
  historicalOrderQuantities: number[]
}

type ReorderSuggestionInput = {
  componentId: string
  stockQuantity: number
  minStock: number
  averageDailyUsage?: number
}

type InventoryMovementSample = {
  componentId: string
  movementType: 'in' | 'out' | 'adjustment' | 'reserved' | 'release'
  quantity: number
  timestamp: string
}

export async function predictStockUsage(input: StockUsageInput): Promise<{
  productId: string
  predictedNextPeriodUsage: number
  confidence: number
}> {
  const samples = input.historicalOrderQuantities.length
  const avg = samples ? input.historicalOrderQuantities.reduce((acc, value) => acc + value, 0) / samples : 0

  return {
    productId: input.productId,
    predictedNextPeriodUsage: Number(avg.toFixed(2)),
    confidence: samples >= 10 ? 0.72 : 0.45,
  }
}

export async function suggestReorder(input: ReorderSuggestionInput): Promise<{
  componentId: string
  reorderRecommended: boolean
  suggestedOrderQty: number
}> {
  const safetyBuffer = input.averageDailyUsage ? input.averageDailyUsage * 7 : input.minStock
  const threshold = Math.max(input.minStock, safetyBuffer)
  const deficit = threshold - input.stockQuantity

  return {
    componentId: input.componentId,
    reorderRecommended: deficit > 0,
    suggestedOrderQty: deficit > 0 ? Number(deficit.toFixed(2)) : 0,
  }
}

export async function detectAnomalies(input: {
  movements: InventoryMovementSample[]
}): Promise<{
  anomalies: Array<{ componentId: string; reason: string }>
}> {
  const anomalies = input.movements
    .filter((movement) => movement.movementType === 'adjustment' && Math.abs(movement.quantity) > 100)
    .map((movement) => ({
      componentId: movement.componentId,
      reason: 'Large adjustment movement detected',
    }))

  return { anomalies }
}
