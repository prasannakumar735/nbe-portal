'use client'

import { BusinessScanCard } from '@/components/sales-engine/BusinessScanCard'
import { BusinessTable } from '@/components/sales-engine/BusinessTable'
import { CampaignBuilderPlaceholder } from '@/components/sales-engine/CampaignBuilderPlaceholder'
import { ContactExtractionProgress } from '@/components/sales-engine/ContactExtractionProgress'
import { ContactReviewTable } from '@/components/sales-engine/ContactReviewTable'
import { ContactsTable } from '@/components/sales-engine/ContactsTable'
import { SelectedEmailSummary } from '@/components/sales-engine/SelectedEmailSummary'
import { useBusinessScan } from '@/hooks/useBusinessScan'
import { useContactDiscovery } from '@/hooks/useContactDiscovery'
import { useSelectedContacts } from '@/hooks/useSelectedContacts'
export function SalesEnginePage() {
  const scan = useBusinessScan()
  const discovery = useContactDiscovery()
  const selection = useSelectedContacts(discovery.contacts)

  const showReviewLayer =
    discovery.contacts.length > 0 || discovery.contactsLoading || selection.extractedEmailCount > 0

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Sales Engine</h1>
        <p className="mt-1 text-sm text-slate-600">
          AI Powered Business Discovery and Outreach Platform
        </p>
      </header>

      <BusinessScanCard
        postcode={scan.postcode}
        onPostcodeChange={scan.setPostcode}
        onScan={() => void scan.scan()}
        onRefreshFromGoogle={() => void scan.refreshFromGoogle()}
        scanning={scan.scanning}
        error={scan.scanError}
      />

      {scan.listError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {scan.listError}
        </div>
      ) : null}

      {scan.showResultsTable ? (
        <BusinessTable
          rows={scan.rows}
          total={scan.total}
          page={scan.page}
          pageSize={scan.pageSize}
          loading={scan.listLoading}
          updatingId={scan.updatingId}
          selectedCount={scan.summary?.selected ?? 0}
          summaryLoading={scan.summaryLoading}
          onToggleSelected={(row, selected) => void scan.toggleSelected(row, selected)}
          onPageChange={scan.setPage}
          onPageSizeChange={(size) => {
            scan.setPageSize(size)
            scan.setPage(1)
          }}
          onExtractContacts={() => void discovery.extractContacts()}
          extracting={discovery.extracting}
        />
      ) : null}

      <ContactExtractionProgress
        active={discovery.extracting}
        completed={discovery.progressCompleted}
        total={discovery.progressTotal}
      />

      {discovery.extractError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {discovery.extractError}
        </div>
      ) : null}

      <ContactsTable
        rows={discovery.contacts}
        loading={discovery.contactsLoading}
        error={discovery.contactsError}
      />

      {showReviewLayer ? (
        <>
          <ContactReviewTable
            groups={selection.groups}
            loading={discovery.contactsLoading}
            recommendedIds={selection.recommendedIds}
            isSelected={selection.isSelected}
            onToggleContact={selection.toggleContact}
            onSelectAllCompany={selection.selectAllForCompany}
            onUnselectAllCompany={selection.unselectAllForCompany}
          />

          <SelectedEmailSummary
            businessesSelected={scan.summary?.selected ?? 0}
            emailsExtracted={selection.extractedEmailCount}
            emailsSelectedForCampaign={selection.selectedEmailCount}
            loading={scan.summaryLoading || discovery.contactsLoading}
          />

          <CampaignBuilderPlaceholder
            selectedEmailCount={selection.selectedEmailCount}
            selectedEmailIds={selection.selectedEmailIds}
            selectedBusinessIds={selection.selectedBusinessIds}
          />
        </>
      ) : null}
    </div>
  )
}
