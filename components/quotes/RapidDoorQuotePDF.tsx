import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { registerRobotoForReactPdf } from '@/lib/pdf/reactPdfRoboto'
import type { RapidDoorQuoteFormValues } from './types'
import { RAPID_DOOR_TERMS_SECTIONS } from '@/lib/quotes/rapidDoorTermsPdf'

type RapidDoorQuotePDFProps = {
  data: {
    values: RapidDoorQuoteFormValues
    subtotal: number
    gst: number
    grandTotal: number
  }
}

/** Brand assets in /public — purple block logo reads closest to printed quotes. */
const PDF_LOGO_SRC = '/NBE_Logo_2026_WG.png'
/** Bundled brochure artwork (`public/quotes/`) — swap files without code changes. */
const DIAGRAM_SRC = '/quotes/industrial-rapid-door-diagram.png'
const SCHEDULE_COLLAGE_SRC = '/quotes/schedule-a-collage.png'

const BLACK = '#000000'
const WHITE = '#ffffff'
const RULE_PT = 3

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontSize: 9,
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 28,
    color: '#0f172a',
  },
  footerPage: {
    position: 'absolute',
    bottom: 12,
    right: 28,
    fontSize: 8,
    color: '#475569',
  },
  quoteMega: {
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: BLACK,
  },
  quoteSubtitle: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    color: BLACK,
    textAlign: 'right',
  },
  headerDates: {
    marginTop: 12,
    fontSize: 9,
    fontWeight: 500,
    textAlign: 'right',
    lineHeight: 1.45,
    color: BLACK,
  },
  logo: {
    width: 122,
    height: 44,
    objectFit: 'contain',
  },
  abnUnderLogo: {
    marginTop: 8,
    fontSize: 9,
    fontWeight: 700,
    color: BLACK,
  },
  supplierName: {
    marginTop: 14,
    fontSize: 10,
    fontWeight: 700,
    color: BLACK,
  },
  supplierLine: {
    marginTop: 4,
    fontSize: 8.5,
    lineHeight: 1.45,
    color: BLACK,
  },
  thickRule: {
    marginTop: 14,
    borderBottomWidth: RULE_PT,
    borderBottomColor: BLACK,
    width: '100%',
  },
  rowCustomerDiagram: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 14,
    alignItems: 'stretch',
  },
  colCustomer: {
    width: '48%',
  },
  colDiagram: {
    width: '52%',
    minHeight: 228,
  },
  blackBarLabel: {
    backgroundColor: BLACK,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  blackBarLabelText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.2,
  },
  custRow: {
    flexDirection: 'row',
    marginTop: 6,
    fontSize: 9,
    lineHeight: 1.45,
  },
  custLabel: {
    width: 76,
    fontWeight: 700,
    color: BLACK,
  },
  diagramWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: BLACK,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  diagramImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  table: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: BLACK,
  },
  tableHeadRow: {
    flexDirection: 'row',
    backgroundColor: BLACK,
    alignItems: 'stretch',
  },
  thCell: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: WHITE,
    justifyContent: 'center',
  },
  thText: {
    color: WHITE,
    fontSize: 7.5,
    fontWeight: 700,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    backgroundColor: WHITE,
  },
  bodyRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tdCell: {
    paddingHorizontal: 4,
    paddingVertical: 5,
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
    fontSize: 8,
    lineHeight: 1.35,
  },
  tdLast: {
    borderRightWidth: 0,
  },
  cNo: { width: '5%' },
  cItem: { width: '19%' },
  cDesc: { width: '29%' },
  cWh: { width: '8%' },
  cHt: { width: '8%' },
  cQty: { width: '8%' },
  cUnit: { width: '11%' },
  cTot: { width: '12%' },
  summaryWrap: {
    marginTop: 14,
    marginLeft: 'auto',
    width: '46%',
    borderWidth: 1,
    borderColor: BLACK,
  },
  summaryInnerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    fontSize: 10,
  },
  summaryTotalBlack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: BLACK,
  },
  summaryTotalBlackText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: 700,
  },
  sigBlackBar: {
    flexDirection: 'row',
    backgroundColor: BLACK,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginTop: 18,
  },
  sigBlackLab: {
    flex: 1,
    color: WHITE,
    fontSize: 8,
    fontWeight: 700,
  },
  sigUnderRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 4,
  },
  sigUnderCol: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: BLACK,
    minHeight: 28,
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  disclaimer: {
    marginTop: 16,
    fontSize: 7.5,
    lineHeight: 1.42,
    color: '#1e293b',
    textAlign: 'justify',
  },
  scheduleTitleMain: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 6,
    color: BLACK,
  },
  scheduleSubtitle: {
    fontSize: 11,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: 1,
    color: BLACK,
  },
  scheduleNotes: {
    marginTop: 14,
    fontSize: 9,
    lineHeight: 1.45,
    color: '#334155',
  },
  collageWrap: {
    marginTop: 12,
    height: 400,
    borderWidth: 1,
    borderColor: BLACK,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  slimHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: BLACK,
    marginBottom: 12,
  },
  termsTitle: {
    fontSize: 13,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 8,
    color: BLACK,
  },
  termsSub: {
    fontSize: 10,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 14,
    color: BLACK,
  },
  termsHeading: {
    fontSize: 9,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 5,
    color: BLACK,
  },
  termsBullet: {
    fontSize: 7.5,
    lineHeight: 1.42,
    marginBottom: 3,
    paddingLeft: 8,
    color: '#1e293b',
    textAlign: 'justify',
  },
})

const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
})

function fmtDate(s: string) {
  const t = String(s ?? '').slice(0, 10)
  if (!t) return '—'
  const [y, m, d] = t.split('-')
  if (!y || !m || !d) return t
  return `${d}/${m}/${y}`
}

function PdfLogo() {
  return <Image style={styles.logo} src={PDF_LOGO_SRC} />
}

function IndustrialDoorDiagramPanel() {
  return (
    <View style={styles.diagramWrap}>
      <Image style={styles.diagramImage} src={DIAGRAM_SRC} />
    </View>
  )
}

export function RapidDoorQuotePDF({ data }: RapidDoorQuotePDFProps) {
  registerRobotoForReactPdf()
  const { values, subtotal, gst, grandTotal } = data

  const footerNum = (
    <Text
      fixed
      style={styles.footerPage}
      render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
    />
  )

  const supplierLines = (
    <>
      <Text style={styles.supplierName}>{values.companyName}</Text>
      <Text style={styles.supplierLine}>{values.companyAddress}</Text>
      <Text style={styles.supplierLine}>{values.companyEmail?.trim() || 'accountsreceivable@nbeaustralia.com.au'}</Text>
      <Text style={[styles.supplierLine, { marginTop: 8 }]}>
        {values.salesContactName}
        {'\n'}
        {values.salesContactPhone}
        {'\n'}
        {values.salesContactEmail}
      </Text>
    </>
  )

  const quoteRightHeader = (
    <View style={{ alignItems: 'flex-end', flexShrink: 0, marginLeft: 12 }}>
      <Text style={styles.quoteMega}>QUOTE</Text>
      <Text style={styles.quoteSubtitle}>{values.quoteSubtitle}</Text>
      <Text style={styles.headerDates}>
        DATE: {fmtDate(values.serviceDate)}
        {'\n'}
        VALID UNTIL: {fmtDate(values.validUntil)}
        {'\n'}
        Quote No: {values.quoteNumber}
      </Text>
    </View>
  )

  const customerBlock = (
    <>
      <View style={styles.blackBarLabel}>
        <Text style={styles.blackBarLabelText}>CUSTOMER</Text>
      </View>
      <View style={{ paddingTop: 10 }}>
        <View style={styles.custRow}>
          <Text style={styles.custLabel}>Attn</Text>
          <Text style={{ flex: 1 }}>{values.attn?.trim() || '—'}</Text>
        </View>
        <View style={styles.custRow}>
          <Text style={styles.custLabel}>Company</Text>
          <Text style={{ flex: 1 }}>{values.customerCompany || '—'}</Text>
        </View>
        <View style={styles.custRow}>
          <Text style={styles.custLabel}>Contact</Text>
          <Text style={{ flex: 1 }}>{values.contactPerson?.trim() || '—'}</Text>
        </View>
        <View style={styles.custRow}>
          <Text style={styles.custLabel}>Site Address</Text>
          <Text style={{ flex: 1 }}>{values.siteAddress || '—'}</Text>
        </View>
        <View style={styles.custRow}>
          <Text style={styles.custLabel}>Phone</Text>
          <Text style={{ flex: 1 }}>{values.phone || '—'}</Text>
        </View>
        <View style={styles.custRow}>
          <Text style={styles.custLabel}>Email</Text>
          <Text style={{ flex: 1 }}>{values.customerEmail || '—'}</Text>
        </View>
      </View>
    </>
  )

  const scheduleCollagePanel = (
    <View style={styles.collageWrap}>
      <Image style={{ width: '100%', height: '100%', objectFit: 'contain' }} src={SCHEDULE_COLLAGE_SRC} />
    </View>
  )

  const slimDocHeader = (
    <View style={styles.slimHeaderRow}>
      <PdfLogo />
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 10, fontWeight: 700 }}>ABN: {values.abn}</Text>
        <Text style={{ fontSize: 9, fontWeight: 700, marginTop: 6 }}>{values.quoteSubtitle}</Text>
      </View>
    </View>
  )

  return (
    <Document>
      {/* ——— Page 1 : quotation ——— */}
      <Page size="A4" style={styles.page} wrap>
        {footerNum}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ width: '58%', flexShrink: 1 }}>
            <PdfLogo />
            <Text style={styles.abnUnderLogo}>ABN: {values.abn}</Text>
            {supplierLines}
          </View>
          {quoteRightHeader}
        </View>

        <View style={styles.thickRule} />

        <View style={styles.rowCustomerDiagram}>
          <View style={styles.colCustomer}>{customerBlock}</View>
          <View style={styles.colDiagram}>
            <IndustrialDoorDiagramPanel />
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeadRow}>
            <View style={[styles.thCell, styles.cNo]}>
              <Text style={styles.thText}>NO</Text>
            </View>
            <View style={[styles.thCell, styles.cItem]}>
              <Text style={styles.thText}>ITEM</Text>
            </View>
            <View style={[styles.thCell, styles.cDesc]}>
              <Text style={styles.thText}>DESCRIPTION</Text>
            </View>
            <View style={[styles.thCell, styles.cWh]}>
              <Text style={styles.thText}>WIDTH</Text>
            </View>
            <View style={[styles.thCell, styles.cHt]}>
              <Text style={styles.thText}>HEIGHT</Text>
            </View>
            <View style={[styles.thCell, styles.cQty]}>
              <Text style={styles.thText}>QTY</Text>
            </View>
            <View style={[styles.thCell, styles.cUnit]}>
              <Text style={styles.thText}>UNIT PRICE</Text>
            </View>
            <View style={[styles.thCell, styles.cTot, { borderRightWidth: 0 }]}>
              <Text style={styles.thText}>TOTAL</Text>
            </View>
          </View>

          {values.items.map((item, index) => {
            const rowTotal = Number(item.qty || 0) * Number(item.unitPrice || 0)
            const alt = index % 2 === 1
            return (
              <View
                key={`rd-${index}`}
                wrap={false}
                style={[styles.bodyRow, ...(alt ? [styles.bodyRowAlt] : [])]}
              >
                <View style={[styles.tdCell, styles.cNo]}>
                  <Text>{index + 1}</Text>
                </View>
                <View style={[styles.tdCell, styles.cItem]}>
                  <Text>{item.itemTitle?.trim() || '—'}</Text>
                </View>
                <View style={[styles.tdCell, styles.cDesc]}>
                  <Text>{item.description?.trim() || ''}</Text>
                </View>
                <View style={[styles.tdCell, styles.cWh]}>
                  <Text>{item.width?.trim() || ''}</Text>
                </View>
                <View style={[styles.tdCell, styles.cHt]}>
                  <Text>{item.height?.trim() || ''}</Text>
                </View>
                <View style={[styles.tdCell, styles.cQty]}>
                  <Text>{String(item.qty ?? '')}</Text>
                </View>
                <View style={[styles.tdCell, styles.cUnit]}>
                  <Text>{currency.format(Number(item.unitPrice || 0))}</Text>
                </View>
                <View style={[styles.tdCell, styles.cTot, styles.tdLast]}>
                  <Text>{currency.format(rowTotal)}</Text>
                </View>
              </View>
            )
          })}
        </View>

        <View wrap={false} style={styles.summaryWrap}>
          <View style={styles.summaryInnerRow}>
            <Text>Subtotal</Text>
            <Text>{currency.format(subtotal)}</Text>
          </View>
          <View style={styles.summaryInnerRow}>
            <Text>GST (10%)</Text>
            <Text>{currency.format(gst)}</Text>
          </View>
          <View style={styles.summaryTotalBlack}>
            <Text style={styles.summaryTotalBlackText}>TOTAL</Text>
            <Text style={styles.summaryTotalBlackText}>{currency.format(grandTotal)}</Text>
          </View>
        </View>

        <View wrap={false}>
          <View style={styles.sigBlackBar}>
            <Text style={styles.sigBlackLab}>Client Signature</Text>
            <Text style={styles.sigBlackLab}>Printed Name</Text>
            <Text style={styles.sigBlackLab}>Date</Text>
          </View>
          <View style={styles.sigUnderRow}>
            <View style={styles.sigUnderCol}>
              <Text style={{ fontSize: 1 }}> </Text>
            </View>
            <View style={styles.sigUnderCol}>
              <Text style={{ fontSize: 9 }}>{values.printedName || ' '}</Text>
            </View>
            <View style={styles.sigUnderCol}>
              <Text style={{ fontSize: 9 }}>{values.signatureDate ? fmtDate(values.signatureDate) : ' '}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.disclaimer}>{values.introNote}</Text>
      </Page>

      {/* ——— Page 2 : Schedule A ——— */}
      <Page size="A4" style={styles.page} wrap>
        {footerNum}
        {slimDocHeader}
        <Text style={styles.scheduleTitleMain}>QUOTE – (Schedule A)</Text>
        <Text style={styles.scheduleSubtitle}>{values.quoteSubtitle}</Text>
        {scheduleCollagePanel}
        <Text style={styles.scheduleNotes}>{values.scheduleANotes?.trim() || '—'}</Text>
      </Page>

      {/* ——— Page 3 : Terms ——— */}
      <Page size="A4" style={styles.page} wrap>
        {footerNum}
        {slimDocHeader}
        <Text style={styles.termsTitle}>TERMS & CONDITIONS</Text>
        <Text style={styles.termsSub}>{values.quoteSubtitle} FOR CUSTOMERS</Text>
        {RAPID_DOOR_TERMS_SECTIONS.map(section => (
          <View key={section.heading}>
            <Text style={styles.termsHeading}>{section.heading}</Text>
            {section.bullets.map((b, i) => (
              <Text key={`${section.heading}-${i}`} style={styles.termsBullet}>
                • {b}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}
