import { PVCQuotesList } from '@/components/pvc/PVCQuotesList'
import { PvcWorkflowDashboardBanner } from '@/components/pvc/PvcWorkflowDashboardBanner'

export default function PVCCalculatorPage() {
  return (
    <div className="space-y-4">
      <PvcWorkflowDashboardBanner />
      <PVCQuotesList />
    </div>
  )
}
