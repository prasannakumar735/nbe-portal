import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { registerRobotoForReactPdf } from '@/lib/pdf/reactPdfRoboto'
import type { ServiceQuoteFormValues } from './types'

registerRobotoForReactPdf()

type QuotePDFProps = {
  data: {
    values: ServiceQuoteFormValues
    subtotal: number
    gst: number
    grandTotal: number
  }
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 10,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 28,
    color: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  logo: {
    width: 120,
    height: 40,
    objectFit: 'contain',
  },
  companyBlock: {
    flex: 1,
    marginLeft: 10,
    gap: 2,
  },
  companyName: {
    fontSize: 14,
    fontWeight: 700,
  },
  titleBlock: {
    width: '30%',
    alignItems: 'flex-end',
  },
  quoteTitle: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 2,
  },
  quoteMeta: {
    marginTop: 6,
    fontSize: 9,
  },
  section: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  detailLabel: {
    width: 90,
    fontWeight: 700,
  },
  table: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    fontWeight: 700,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    minHeight: 24,
  },
  cell: {
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  lastCell: {
    borderRightWidth: 0,
  },
  cSno: { width: '7%' },
  cDesc: { width: '39%' },
  cWidth: { width: '10%' },
  cHeight: { width: '10%' },
  cQty: { width: '8%' },
  cUnit: { width: '13%' },
  cTotal: { width: '13%' },
  summary: {
    marginTop: 12,
    marginLeft: '58%',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 8,
    gap: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 3,
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    fontSize: 11,
    fontWeight: 700,
  },
  notes: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 8,
  },
  signatureGrid: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 12,
  },
  sigItem: {
    width: '33.33%',
  },
  sigLine: {
    marginTop: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#64748b',
    minHeight: 12,
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
  const { values, subtotal, gst, grandTotal } = data

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image style={styles.logo} src="/nbe-logo.png" />

          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>NBE Australia</Text>
            <Text>22A Humeside Dr</Text>
            <Text>Campbellfield VIC 3061</Text>
            <Text>accountsreceivable@nbeaustralia.com.au</Text>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.quoteTitle}>QUOTE</Text>
            <Text style={styles.quoteMeta}>Quote No: {values.quoteNumber}</Text>
            <Text style={styles.quoteMeta}>Service Date: {values.serviceDate}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Customer Name</Text>
            <Text>{values.customerCompany || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Contact Person</Text>
            <Text>{values.contactPerson || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text>{values.phone || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Email</Text>
            <Text>{values.customerEmail || '-'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Site Address</Text>
            <Text>{values.siteAddress || '-'}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.cell, styles.cSno]}>S.No</Text>
            <Text style={[styles.cell, styles.cDesc]}>Description</Text>
            <Text style={[styles.cell, styles.cWidth]}>Width</Text>
            <Text style={[styles.cell, styles.cHeight]}>Height</Text>
            <Text style={[styles.cell, styles.cQty]}>Qty</Text>
            <Text style={[styles.cell, styles.cUnit]}>Unit Price</Text>
            <Text style={[styles.cell, styles.cTotal, styles.lastCell]}>Total</Text>
          </View>

          {values.items.map((item, index) => {
            const rowTotal = Number(item.qty || 0) * Number(item.unitPrice || 0)
            return (
              <View key={`${item.description}-${index}`} style={styles.row}>
                <Text style={[styles.cell, styles.cSno]}>{index + 1}</Text>
                <Text style={[styles.cell, styles.cDesc]}>{item.description || '-'}</Text>
                <Text style={[styles.cell, styles.cWidth]}>{item.width || '-'}</Text>
                <Text style={[styles.cell, styles.cHeight]}>{item.height || '-'}</Text>
                <Text style={[styles.cell, styles.cQty]}>{String(item.qty || 0)}</Text>
                <Text style={[styles.cell, styles.cUnit]}>{currency.format(Number(item.unitPrice || 0))}</Text>
                <Text style={[styles.cell, styles.cTotal, styles.lastCell]}>{currency.format(rowTotal)}</Text>
              </View>
            )
          })}
        </View>

        <View style={styles.summary}>
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

        <View style={styles.notes}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text>{values.notes || defaultNote}</Text>
        </View>

        <View style={styles.signatureGrid}>
          <View style={styles.sigItem}>
            <Text>Client Signature</Text>
            <Text style={styles.sigLine}>{' '}</Text>
          </View>
          <View style={styles.sigItem}>
            <Text>Printed Name</Text>
            <Text style={styles.sigLine}>{values.printedName || ' '}</Text>
          </View>
          <View style={styles.sigItem}>
            <Text>Date</Text>
            <Text style={styles.sigLine}>{values.signatureDate || ' '}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
