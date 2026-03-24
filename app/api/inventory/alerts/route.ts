import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('Supabase auth error:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('components')
      .select('id, sku, name, unit, stock_quantity, min_stock')

    if (error) {
      console.error('Supabase fetch error:', error)
      throw error
    }

    console.log('Fetched components:', data)

    if (!data) {
      return NextResponse.json([])
    }

    const alerts = data.filter((item) => {
      const stock = Number(item.stock_quantity || 0)
      const min = Number(item.min_stock || 0)
      return stock <= min
    })

    return NextResponse.json(alerts)
  } catch (error) {
    console.error('Alerts API ERROR:', error)
    return NextResponse.json(
      {
        error: 'Failed to load alerts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
