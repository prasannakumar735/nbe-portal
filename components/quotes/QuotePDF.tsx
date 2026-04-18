import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { registerRobotoForReactPdf } from '@/lib/pdf/reactPdfRoboto'
import type { ServiceQuoteFormValues } from './types'

type QuotePDFProps = {
  data: {
    values: ServiceQuoteFormValues
    subtotal: number
    gst: number
    grandTotal: number
  }
}

/** Reserved vertical space for fixed header (company + address line + email line) and footer. */
const HEADER_H = 68
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
  /** Thin rule only — no long footer text (avoids mid-line breaks). */
  fixedFooter: {
    position: 'absolute',
    bottom: 22,
    left: 24,
    right: 24,
    borderTopWidth: 1,
    borderTopColor: '#cbd5e1',
    height: 1,
  },
  footerPage: {
    position: 'absolute',
    bottom: 8,
    right: 24,
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
  headerEmail: {
    fontSize: 8,
    marginTop: 1,
    color: '#64748b',
    lineHeight: 1.3,
  },
  /** Totals only — small block so it can sit under the last table row when space allows. */
  summaryBlock: {
    marginTop: 8,
  },
  /** Notes + signature together (does not pull totals to the next page with them). */
  closingBlock: {
    marginTop: 8,
  },
  titleBlock: {
    width: '28%',
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
  section: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 6,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  detailLabel: {
    width: 92,
    fontWeight: 700,
  },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    fontWeight: 700,
    fontSize: 9,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  cell: {
    paddingHorizontal: 3,
    paddingVertical: 4,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    alignSelf: 'flex-start',
    fontSize: 9,
  },
  descText: {
    width: '100%',
    fontSize: 9,
    lineHeight: 1.32,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  cSno: { width: '6%' },
  cDesc: { width: '40%' },
  cWidth: { width: '9%' },
  cHeight: { width: '9%' },
  cQty: { width: '8%' },
  cUnit: { width: '13%' },
  cTotal: { width: '13%' },
  summary: {
    marginTop: 0,
    marginLeft: '56%',
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
    fontSize: 10,
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    fontSize: 11,
    fontWeight: 700,
  },
  notes: {
    marginTop: 0,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 6,
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
  notesBody: {
    fontSize: 9,
    lineHeight: 1.35,
    marginTop: 3,
  },
  sigLabel: {
    fontSize: 9,
  },
})

const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
})

const defaultNote =
  'Should you require any further information or clarification about this quotation, please do not hesitate to contact us.'

export function QuotePDF({ data }: QuotePDFProps) {
  registerRobotoForReactPdf()
  const { values, subtotal, gst, grandTotal } = data

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View fixed style={styles.fixedHeader}>
          <Image style={styles.logo} src="/nbe-logo.png" />
          <View style={styles.headerCenter}>
            <Text style={styles.companyName}>NBE Australia</Text>
            <Text style={styles.headerAddress}>22A Humeside Dr, Campbellfield VIC 3061</Text>
            <Text style={styles.headerEmail}>
              {values.companyEmail?.trim() || 'accountsreceivable@nbeaustralia.com.au'}
            </Text>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.quoteTitle}>Service Quote</Text>
            <Text style={styles.quoteMeta}>Quote No: {values.quoteNumber}</Text>
            <Text style={styles.quoteMeta}>Quote date: {values.serviceDate}</Text>
          </View>
        </View>

        <View fixed style={styles.fixedFooter} />
        <Text
          fixed
          style={styles.footerPage}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text>{values.phone || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Site Address</Text>
            <Text>{values.siteAddress || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Company name</Text>
            <Text>{values.customerCompany || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Contact Person</Text>
            <Text>{values.contactPerson || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email</Text>
            <Text>{values.customerEmail || '-'}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.cell, styles.cSno]}>#</Text>
            <Text style={[styles.cell, styles.cDesc]}>Description</Text>
            <Text style={[styles.cell, styles.cWidth]}>W</Text>
            <Text style={[styles.cell, styles.cHeight]}>H</Text>
            <Text style={[styles.cell, styles.cQty]}>Qty</Text>
            <Text style={[styles.cell, styles.cUnit]}>Unit</Text>
            <Text style={[styles.cell, styles.cTotal, styles.lastCell]}>Total</Text>
          </View>

          {values.items.map((item, index) => {
            const rowTotal = Number(item.qty || 0) * Number(item.unitPrice || 0)
            return (
              <View key={`line-${index}`} style={styles.row} wrap>
                <Text style={[styles.cell, styles.cSno]}>{index + 1}</Text>
                <View style={[styles.cell, styles.cDesc]}>
                  <Text style={styles.descText}>{item.description || '-'}</Text>
                </View>
                <Text style={[styles.cell, styles.cWidth]}>{item.width || '-'}</Text>
                <Text style={[styles.cell, styles.cHeight]}>{item.height || '-'}</Text>
                <Text style={[styles.cell, styles.cQty]}>{String(item.qty || 0)}</Text>
                <Text style={[styles.cell, styles.cUnit]}>{currency.format(Number(item.unitPrice || 0))}</Text>
                <Text style={[styles.cell, styles.cTotal, styles.lastCell]}>{currency.format(rowTotal)}</Text>
              </View>
            )
          })}
        </View>

        {/*
          Inner summary box uses wrap={false} so Subtotal/GST/Grand Total are never split across pages.
          The outer wrapper has default wrap so it is not consecutive with the notes block’s wrap={false}.
        */}
        <View style={styles.summaryBlock}>
          <View wrap={false} style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text>Subtotal</Text>
              <Text>{currency.format(subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>GST (10%)</Text>
              <Text>{currency.format(gst)}</Text>
            </View>
            <View style={styles.summaryTotal}>
              <Text>Grand Total</Text>
              <Text>{currency.format(grandTotal)}</Text>
            </View>
          </View>
        </View>

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
