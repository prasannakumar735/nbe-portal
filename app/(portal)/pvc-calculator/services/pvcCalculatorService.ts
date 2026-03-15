import type { PVCCalculationResponse } from '@/lib/types/pvc.types'
import type { PVCFormValues } from '../components/PVCForm'

export const pvcCalculatorService = {
  async calculate(input: PVCFormValues & { confirmQuote?: boolean }): Promise<PVCCalculationResponse> {
    const response = await fetch('/api/pvc/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to process PVC calculation.')
    }

    return data as PVCCalculationResponse
  },
}
