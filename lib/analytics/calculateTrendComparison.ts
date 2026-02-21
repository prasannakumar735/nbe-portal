export interface TrendComparison {
  direction: 'up' | 'down' | 'flat'
  changePercent: number
}

export function calculateTrendComparison(currentValue: number, previousValue: number): TrendComparison {
  if (previousValue === 0) {
    if (currentValue === 0) {
      return { direction: 'flat', changePercent: 0 }
    }

    return { direction: 'up', changePercent: 100 }
  }

  const changePercent = ((currentValue - previousValue) / previousValue) * 100

  if (Math.abs(changePercent) < 0.5) {
    return { direction: 'flat', changePercent: 0 }
  }

  return {
    direction: changePercent > 0 ? 'up' : 'down',
    changePercent: Number(Math.abs(changePercent).toFixed(1))
  }
}
