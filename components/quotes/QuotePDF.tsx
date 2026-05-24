import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { registerRobotoForReactPdf } from '@/lib/pdf/reactPdfRoboto'
import { formatQuoteTaxonomyLine } from '@/lib/quotes/quoteTaxonomy'
import type { ServiceQuoteFormValues } from './types'

type QuotePDFProps = {
  data: {
    values: ServiceQuoteFormValues
    subtotal: number
    discount?: number
    gst: number
    grandTotal: number
  }
}

/** Reserved vertical space for fixed header and footer. */
const HEADER_H = 72
const FOOTER_H = 26

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 10,
    paddingTop: HEADER_H + 8,
    paddingBottom: FOOTER_H + 12,
    paddingHorizontal: 24,
    color: '#0f172a',
  },
  fixedHeader: {
    position: 'absolute',
    top: 12,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  fixedFooter: {
    position: 'absolute',
    bottom: 22,
    left: 24,
    right: 24,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    height: 1,
  },
  footerText: {
    position: 'absolute',
    bottom: 8,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#64748b',
  },
  logo: {
    width: 118,
    height: 40,
    objectFit: 'contain',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  companyName: {
    fontSize: 11,
    fontWeight: 700,
  },
  headerAddress: {
    fontSize: 8,
    marginTop: 1,
    color: '#64748b',
    lineHeight: 1.3,
  },
  titleBlock: {
    width: '30%',
    alignItems: 'flex-end',
  },
  quoteTitle: {
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  quoteMeta: {
    marginTop: 2,
    fontSize: 7,
    textAlign: 'right',
    color: '#334155',
  },
  /* Two-column info block below header */
  infoGrid: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 6,
  },
  infoCol: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 6,
  },
  infoTitle: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 4,
    color: '#334155',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  infoLabel: {
    width: 80,
    fontSize: 8,
    fontWeight: 700,
    color: '#475569',
  },
  infoValue: {
    flex: 1,
    fontSize: 8,
    color: '#0f172a',
  },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    fontWeight: 700,
    fontSize: 8,
    color: '#ffffff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  rowAlt: {
    backgroundColor: '#f8fafc',
  },
  notesRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f0f9ff',
  },
  cell: {
    paddingHorizontal: 3,
    paddingVertical: 4,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    alignSelf: 'flex-start',
    fontSize: 8,
  },
  cellHead: {
    paddingHorizontal: 3,
    paddingVertical: 4,
    borderRightWidth: 1,
    borderRightColor: '#475569',
    alignSelf: 'flex-start',
    fontSize: 8,
    color: '#ffffff',
  },
  descText: {
    width: '100%',
    fontSize: 8,
    lineHeight: 1.35,
  },
  notesText: {
    fontSize: 7.5,
    lineHeight: 1.35,
    color: '#0369a1',
    fontStyle: 'italic',
  },
  lastCell: {
    borderRightWidth: 0,
  },
  summaryBlock: {
    marginTop: 8,
  },
  summary: {
    marginTop: 0,
    marginLeft: '55%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 6,
    gap: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 2,
    fontSize: 9,
  },
  summaryDiscount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 2,
    fontSize: 9,
    color: '#dc2626',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
    fontSize: 11,
    fontWeight: 700,
  },
  closingBlock: {
    marginTop: 8,
  },
  notes: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 6,
  },
  notesBody: {
    fontSize: 8.5,
    lineHeight: 1.35,
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 2,
  },
  signatureGrid: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  sigItem: {
    width: '33.33%',
  },
  sigLine: {
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
    minHeight: 9,
  },
  sigLabel: {
    fontSize: 8.5,
  },
})

const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
})

const defaultNote =
  'Should you require any further information or clarification about this quotation, please do not hesitate to contact us.'

function rowTotal(item: ServiceQuoteFormValues['items'][number]): number {
  const computed = Number(item.qty || 0) * Number(item.unitPrice || 0)
  const override = Number(item.totalOverride)
  return !isNaN(override) && item.totalOverride !== undefined && item.totalOverride !== null
    ? override
    : computed
}

function snoLabel(item: ServiceQuoteFormValues['items'][number], index: number): string {
  return item.sno?.trim() || String(index + 1)
}

export function QuotePDF({ data }: QuotePDFProps) {
  registerRobotoForReactPdf()
  const { values, subtotal, discount = 0, gst, grandTotal } = data
  const hidePricing = Boolean(values.hidePricing)
  const discountPercent = Number(values.discountPercent ?? 0)
  const afterDiscount = subtotal - discount

  /* Column widths — unit price column hidden when hidePricing, total always shown */
  const col = hidePricing
    ? { sno: '5%', desc: '48%', w: '11%', h: '11%', qty: '10%', total: '15%' }
    : { sno: '5%', desc: '36%', w: '10%', h: '10%', qty: '8%', unit: '15%', total: '16%' }

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* ── Fixed header ── */}
        <View fixed style={styles.fixedHeader}>
          <Image style={styles.logo} src="/nbe-logo.png" />
          <View style={styles.headerCenter}>
            <Text style={styles.companyName}>NBE Australia</Text>
            <Text style={styles.headerAddress}>
              {values.companyAddress?.trim() || '22A Humeside Dr, Campbellfield VIC 3061'}
            </Text>
            <Text style={styles.headerAddress}>
              {values.companyEmail?.trim() || 'accountsreceivable@nbeaustralia.com.au'}
            </Text>
            <Text style={styles.headerAddress}>ABN: {values.abn?.trim() || '17 007 048 008'}</Text>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.quoteTitle}>QUOTE</Text>
            <Text style={styles.quoteMeta}>{formatQuoteTaxonomyLine(values.quoteType, values.quoteSubCategory)}</Text>
            <Text style={styles.quoteMeta}>No: {values.quoteNumber}</Text>
            <Text style={styles.quoteMeta}>Date: {values.serviceDate}</Text>
            {values.validUntil?.trim() && (
              <Text style={styles.quoteMeta}>Valid until: {values.validUntil}</Text>
            )}
          </View>
        </View>

        {/* ── Fixed footer ── */}
        <View fixed style={styles.fixedFooter} />
        <View fixed style={styles.footerText}>
          <Text>ABN: {values.abn?.trim() || '17 007 048 008'} | NBE Australia Pty Ltd</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>

        {/* ── Customer + Quote Info ── */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <Text style={styles.infoTitle}>Customer</Text>
            {values.customerCompany?.trim() ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Company</Text>
                <Text style={styles.infoValue}>{values.customerCompany}</Text>
              </View>
            ) : null}
            {values.contactPerson?.trim() ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Attn</Text>
                <Text style={styles.infoValue}>{values.contactPerson}</Text>
              </View>
            ) : null}
            {values.siteAddress?.trim() ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Site Address</Text>
                <Text style={styles.infoValue}>{values.siteAddress}</Text>
              </View>
            ) : null}
            {values.phone?.trim() ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{values.phone}</Text>
              </View>
            ) : null}
            {values.customerEmail?.trim() ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{values.customerEmail}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.infoCol}>
            <Text style={styles.infoTitle}>Quote Details</Text>
            {values.salesperson?.trim() ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Salesperson</Text>
                <Text style={styles.infoValue}>{values.salesperson}</Text>
              </View>
            ) : null}
            {values.paymentTerms?.trim() ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment Terms</Text>
                <Text style={styles.infoValue}>{values.paymentTerms}</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Quote Date</Text>
              <Text style={styles.infoValue}>{values.serviceDate}</Text>
            </View>
            {values.validUntil?.trim() ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Valid Until</Text>
                <Text style={styles.infoValue}>{values.validUntil}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Line Items Table ── */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.cellHead, { width: col.sno }]}>#</Text>
            <Text style={[styles.cellHead, { width: col.desc }]}>Description</Text>
            <Text style={[styles.cellHead, { width: col.w }]}>Width</Text>
            <Text style={[styles.cellHead, { width: col.h }]}>Height</Text>
            <Text style={[styles.cellHead, { width: col.qty }]}>Qty</Text>
            {!hidePricing && 'unit' in col && (
              <Text style={[styles.cellHead, { width: (col as {unit: string}).unit }]}>Unit Price</Text>
            )}
            <Text style={[styles.cellHead, styles.lastCell, { width: col.total }]}>Amount (ex GST)</Text>
          </View>

          {values.items.map((item, index) => {
            const total = rowTotal(item)
            const isAlt = index % 2 === 1

            return (
              <View key={`item-${index}`} wrap={false}>
                {/* Notes row — shown ABOVE the item row in the PDF */}
                {item.itemNotes?.trim() ? (
                  <View style={styles.notesRow}>
                    <Text style={[styles.cell, styles.lastCell, { width: '100%' }, styles.notesText]}>
                      {item.itemNotes.trim()}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.row, isAlt ? styles.rowAlt : {}]}>
                  <Text style={[styles.cell, { width: col.sno }]}>{snoLabel(item, index)}</Text>
                  <View style={[styles.cell, { width: col.desc }]}>
                    <Text style={styles.descText}>{item.description || '-'}</Text>
                  </View>
                  <Text style={[styles.cell, { width: col.w }]}>{item.width || '-'}</Text>
                  <Text style={[styles.cell, { width: col.h }]}>{item.height || '-'}</Text>
                  <Text style={[styles.cell, { width: col.qty }]}>{String(item.qty || 0)}</Text>
                  {!hidePricing && 'unit' in col && (
                    <Text style={[styles.cell, { width: (col as {unit: string}).unit }]}>
                      {currency.format(Number(item.unitPrice || 0))}
                    </Text>
                  )}
                  <Text style={[styles.cell, styles.lastCell, { width: col.total }]}>
                    {currency.format(total)}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>

        {/* ── Price Summary ── */}
        <View style={styles.summaryBlock}>
          <View wrap={false} style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text>Subtotal (ex GST)</Text>
              <Text>{currency.format(subtotal)}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.summaryDiscount}>
                <Text>Discount{discountPercent > 0 ? ` (${discountPercent}%)` : ''}</Text>
                <Text>−{currency.format(discount)}</Text>
              </View>
            )}
            {discount > 0 && (
              <View style={styles.summaryRow}>
                <Text>After Discount</Text>
                <Text>{currency.format(afterDiscount)}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text>GST (10%)</Text>
              <Text>{currency.format(gst)}</Text>
            </View>
            <View style={styles.summaryTotal}>
              <Text>Grand Total (inc GST)</Text>
              <Text>{currency.format(grandTotal)}</Text>
            </View>
          </View>
        </View>

        {/* ── Notes + Signature ── */}
        <View wrap={false} style={styles.closingBlock}>
          <View style={styles.notes}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesBody}>{values.notes || defaultNote}</Text>
          </View>

          <View style={styles.signatureGrid}>
            <View style={styles.sigItem}>
              <Text style={styles.sigLabel}>Client Signature</Text>
              <Text style={styles.sigLine}>{' '}</Text>
            </View>
            <View style={styles.sigItem}>
              <Text style={styles.sigLabel}>Name</Text>
              <Text style={styles.sigLine}>{values.printedName || ' '}</Text>
            </View>
            <View style={styles.sigItem}>
              <Text style={styles.sigLabel}>Date</Text>
              <Text style={styles.sigLine}>{values.signatureDate || ' '}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
