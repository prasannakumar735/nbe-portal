'use client'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { loadDoorImageStyle } from '@/app/(portal)/admin/settings/QuoteSettingsClient'
import { createSupabaseClient } from '@/lib/supabase/client'
import type { DoorLineItem } from '@/lib/pdf/generateRapidDoorQuotePdf'
import type { DoorOptionsMap, DoorOption } from '@/app/api/quotes/rapid-door/options/route'

// ── Quote number helpers ──────────────────────────────────────────────────────
async function fetchNextRapidDoorQuoteNumber(): Promise<string> {
  const res = await fetch('/api/quotes/next-number?prefix=QRRD')
  if (!res.ok) throw new Error('Failed to allocate quote number')
  const { quoteNumber } = await res.json()
  return quoteNumber as string
}
function todayDisplay(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// ── Constants ────────────────────────────────────────────────────────────────
const RAPID_DOOR_TYPES = ['PE01', 'SP01', 'FR01', 'CAD01', 'CL01', 'ES01']
const DOOR_MODEL_SIZES = [100, 125, 150, 200]
const EH_OFFSET: Record<string, number> = {
  PE01: 400, FR01: 900, SP01: 450, CAD01: 950, CL01: 400, ES01: 400,
}
function getDoorPrefix(doorType: string) { return doorType.replace(/\d+$/, '') }
function getDoorModelOptions(doorType: string) {
  const prefix = getDoorPrefix(doorType)
  return DOOR_MODEL_SIZES.map(s => `${prefix} ${s}`)
}
function calcExternal(openingW: string, openingH: string, doorType: string, doorModel: string): { ew: string; eh: string } {
  const cw = parseInt(openingW) || 0
  const ch = parseInt(openingH) || 0
  const modelNum = parseInt(doorModel.split(' ')[1] ?? '0') || 0
  const ew = cw + (modelNum * 2) + 158
  const eh = ch + (EH_OFFSET[doorType] ?? 400)
  return { ew: ew > 158 ? String(ew) : '', eh: eh > 400 ? String(eh) : '' }
}

const COLOUR_IMAGE_CODE: Record<string, string> = {
  'BL 543': 'BL', 'RD 356': 'RD', 'YL 119': 'YL',
  'OR 244': 'OR', 'GR 679': 'GR', 'GY 729': 'GY',
}
const DOOR_IMAGE_CONFIG: Record<string, { prefix: string; ext: string }> = {
  PE01:  { prefix: 'PE125',  ext: 'webp' },
  SP01:  { prefix: 'SP150',  ext: 'webp' },
  FR01:  { prefix: 'FR150',  ext: 'webp' },
  CAD01: { prefix: 'CAD200', ext: 'webp' },
  CL01:  { prefix: 'CL125',  ext: 'png'  },
  ES01:  { prefix: 'ES125',  ext: 'webp' },
}
function getDoorImageUrl(doorType: string, colourLabel: string): string | null {
  const code = COLOUR_IMAGE_CODE[colourLabel]
  const cfg  = DOOR_IMAGE_CONFIG[doorType]
  if (!code || !cfg) return null
  const folder = loadDoorImageStyle()
  return `/images/${folder}/${doorType}/${cfg.prefix}_${code}.png`
}

// Door type names are now DB-driven via doorOptions['door_type']
// Safety/Detection categories split into two display groups
// safetyEdgeColour uses its own state (rendered separately using existing colour picker)
const SAFETY_FEATURES_KEYS: { key: string; label: string }[] = [
  { key: 'indicatorLamp', label: 'Indicator Lamp' },
  { key: 'safety',        label: 'Safety Sensor'  },
  // Safety Edge Colour rendered separately using safetyEdgeColour state
  { key: 'safetyOther',   label: 'Other'          },
]
const ACTIVATION_KEYS: { key: string; label: string }[] = [
  { key: 'pushButton',    label: 'Push Button'    },
  { key: 'radar',         label: 'Radar'          },
  { key: 'remoteControl', label: 'Remote Control' },
  { key: 'inductLoop',    label: 'Induction Loop' },
  { key: 'swipe',         label: 'Other'          },
]
// Combined list for safetyLines/safetyByCategory derivation
const SAFETY_DETECTION_KEYS = [...SAFETY_FEATURES_KEYS, ...ACTIVATION_KEYS]
const QUOTE_TYPES = [
  { value: 'GENERAL',                    label: 'General',                       icon: 'description', description: 'Standard quotation for general works and services' },
  { value: 'INDUSTRIAL_RAPID_DOOR',      label: 'Industrial Rapid Door',         icon: 'garage',      description: 'Supply and installation of industrial rapid roller doors' },
  { value: 'PVC_FLEX_SYSTEM',            label: 'PVC Flex System',               icon: 'view_column', description: 'PVC strip curtain systems and flexible door solutions' },
  { value: 'MAINTENANCE_SERVICE_REPAIR', label: 'Maintenance Service / Repair',  icon: 'build',       description: 'Scheduled maintenance, service calls and repair works' },
  { value: 'PARTS',                      label: 'Parts',                         icon: 'settings',    description: 'Spare parts and component supply only' },
]

const SELECT_CLS = 'w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
const LABEL_CLS      = 'mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400'
const LABEL_REQ_CLS  = 'mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400 after:content-["*"] after:ml-0.5 after:text-red-400'
const INPUT_CLS  = 'w-full rounded-xl border border-slate-200 bg-white py-3 px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">expand_more</span>
    </div>
  )
}

// ── Saved door type (locked door items for multi-door quotes) ─────────────────
type SavedDoor = {
  id: string
  doorType: string
  openingW: string
  openingH: string
  doorModel: string
  frame: string
  curtain: string
  colour: string
  motorKw: string
  motorSide: string
  cbSide: string
  doorControl: string
  safetyEdgeColour: string
  safetyLines: string[]
  safetyByCategory: Record<string, string>
  qty: number
  unitPrice: number
  delivery: number
  installation: number
  demolition: number
  equipHire: number
  accTravel: number
  lineTotal: number
  customDesc: string | null
}

// ── Tooltip component ─────────────────────────────────────────────────────────
// Portal-based tooltip — renders in document.body so it escapes overflow:hidden on parent containers.
// normal-case + tracking-normal override any uppercase/tracking inherited from label styles.
function Tip({ text }: { text?: string }) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})
  const triggerRef = useRef<HTMLSpanElement>(null)

  const reposition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const clampedX = Math.max(138, Math.min(centerX, window.innerWidth - 138))
    setPanelStyle({
      top: rect.top - 10,
      left: clampedX,
      transform: 'translate(-50%, -100%)',
    })
  }, [])

  useEffect(() => {
    if (!open) return
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, reposition])

  if (!text) return null

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        role="button"
        aria-label="More information"
        className="inline-flex items-center ml-1 align-middle cursor-help text-slate-400 hover:text-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 transition-colors"
        onMouseEnter={() => { setOpen(true) }}
        onMouseLeave={() => { setOpen(false) }}
        onFocus={() => { setOpen(true) }}
        onBlur={() => { setOpen(false) }}
      >
        <span className="material-symbols-outlined text-[15px] leading-none select-none">info</span>
      </span>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          className="pointer-events-none fixed w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11.5px] leading-relaxed text-slate-700 shadow-lg normal-case tracking-normal font-normal"
          style={panelStyle}
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-200" />
        </div>,
        document.body,
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NewQuotesPage() {
  // DB-driven option lists (fetched once on mount)
  const [doorOptions, setDoorOptions] = useState<DoorOptionsMap>({})
  const [tooltips,    setTooltips]    = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/quotes/rapid-door/options')
      .then(r => r.ok ? r.json() as Promise<DoorOptionsMap> : Promise.reject())
      .then(setDoorOptions)
      .catch(() => { /* UI remains functional; dropdowns show no options until retry */ })
    fetch('/api/quotes/rapid-door/tooltips')
      .then(r => r.ok ? r.json() as Promise<Record<string, string>> : Promise.reject())
      .then(setTooltips)
      .catch(() => { /* tooltips optional — fields still work without them */ })
  }, [])

  function opts(category: string): DoorOption[] { return doorOptions[category] ?? [] }
  function optCodes(category: string): string[]  { return opts(category).map(o => o.code) }
  // code→description lookup (used for frame display name in desc lines and PDF calls)
  function optDesc(category: string, code: string): string {
    return doorOptions[category]?.find(o => o.code === code)?.description || code
  }
  // door type name from DB (falls back to the code itself if not yet loaded)
  function doorTypeName(code: string): string {
    return doorOptions['door_type']?.find(o => o.code === code)?.label ?? code
  }

  // Quote type
  const [selected, setSelected] = useState<string>('')

  // Door form
  const [doorType,      setDoorType]     = useState<string>('')
  const [doorModel,     setDoorModel]    = useState('')
  const [openingW,      setOpeningW]     = useState('')
  const [openingH,      setOpeningH]     = useState('')
  const [frame,         setFrame]        = useState('')
  const [curtain,       setCurtain]      = useState('')
  const [colour,        setColour]       = useState('')
  const [motorKw,       setMotorKw]      = useState('')
  const [motorSide,     setMotorSide]    = useState('')
  const [cbSide,            setCbSide]           = useState('')
  const [doorControl,       setDoorControl]      = useState('')
  const [safetyEdgeColour,  setSafetyEdgeColour] = useState('')
  const [qty,           setQty]          = useState('1')
  const [unitPrice,     setUnitPrice]    = useState('')
  const [safetyValues,  setSafetyValues] = useState<Record<string, string>>({})
  const [motorEnabled,  setMotorEnabled] = useState(true)
  const [showSafety,    setShowSafety]   = useState(true)
  const [showActivation, setShowActivation] = useState(true)
  const [showMotor,     setShowMotor]    = useState(true)

  // Custom door image upload
  const [customDoorImage,     setCustomDoorImage]     = useState<string | null>(null)  // base64 data URL
  const [customDoorImageName, setCustomDoorImageName] = useState<string | null>(null)
  const customImageInputRef = useRef<HTMLInputElement>(null)

  function handleCustomImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      // Resize and convert to JPEG so pdf-lib can embed it and the payload stays small
      const img = new window.Image()
      img.onload = () => {
        const MAX_W = 800
        const scale = img.naturalWidth > MAX_W ? MAX_W / img.naturalWidth : 1
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.naturalWidth  * scale)
        canvas.height = Math.round(img.naturalHeight * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setCustomDoorImage(canvas.toDataURL('image/jpeg', 0.88))
        setCustomDoorImageName(file.name)
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }
  const [endUser,           setEndUser]           = useState<'CUSTOMER' | 'DISTRIBUTOR' | 'TENDER' | ''>('CUSTOMER')
  const [includeSummary,    setIncludeSummary]    = useState(true)
  const [individualInstall, setIndividualInstall] = useState(false)
  const [delivery,          setDelivery]         = useState('')
  const [installation,      setInstallation]     = useState('')
  const [demolition,        setDemolition]       = useState('')
  const [demolitionEnabled, setDemolitionEnabled] = useState(false)
  const [demolitionScope,   setDemolitionScope]  = useState('')
  const [equipHire,         setEquipHire]        = useState('')
  const [accTravel,         setAccTravel]        = useState('')

  // Quotation description (editable)
  const [editingDesc, setEditingDesc]   = useState(false)
  const [customDesc,  setCustomDesc]    = useState<string | null>(null)
  const [tempDesc,    setTempDesc]      = useState('')

  // Editable notes / disclaimers
  const DEFAULT_PAGE2_SUMMARY_NOTE = "This quotation is based on the NBE Standard Door with galvanised frame, 900 g/m² PVC curtain and RAL 7035 zinc-coated control box. Optional extras are additional unless listed in the relevant Door Specification. Final dimensions, site conditions and access must be confirmed before manufacture. Delivery, demolition, equipment hire and installation are excluded unless shown as priced line items. Electrical works are limited to connections between the control panel and door equipment; power supply and isolator are by others. All supply and works are subject to NBE Australia's standard Terms & Conditions."
  const [page2SummaryNote,    setPage2SummaryNote]    = useState<string>('')
  const [editingPage2Note,    setEditingPage2Note]    = useState(false)
  const [tempPage2Note,       setTempPage2Note]       = useState('')

  // Maintenance quote — editable disclaimer + T&C end user selector
  const DEFAULT_MAINT_TERMS = 'This quotation covers the maintenance service, repair works and/or parts listed above. Pricing is valid for 30 days from the date of issue. Work will be carried out during standard business hours unless otherwise agreed. Additional works identified on-site will be quoted separately before proceeding. Travel, accommodation and after-hours rates may apply depending on site location and scheduling requirements. All works are subject to NBE Australia\'s standard Terms & Conditions.'
  const [maintTerms,        setMaintTerms]        = useState<string>('')
  const [editingMaintTerms, setEditingMaintTerms] = useState(false)
  const [tempMaintTerms,    setTempMaintTerms]    = useState('')
  const [maintEndUser,      setMaintEndUser]      = useState<'CUSTOMER' | 'DISTRIBUTOR' | 'TENDER' | ''>('CUSTOMER')

  // Maintenance quote — editable sender / company info
  const [maintSenderName,    setMaintSenderName]    = useState('NBE AUSTRALIA')
  const [maintSenderAddress, setMaintSenderAddress] = useState('22A Humeside Dr, Campbellfield VIC 3061, Australia')
  const [maintSenderEmail,   setMaintSenderEmail]   = useState('accountsreceivable@nbeaustralia.com.au')
  const [maintContactName,   setMaintContactName]   = useState('Andrew Newton')
  const [maintContactPhone,  setMaintContactPhone]  = useState('(04) 2705 5556')
  const [maintContactEmail,  setMaintContactEmail]  = useState('anewton@nbeaustralia.com.au')

  // General quote — editable disclaimer + T&C end user selector
  const DEFAULT_GENERAL_TERMS = 'This quotation covers the goods and/or services listed above. Pricing is valid for 30 days from the date of issue. All works are subject to NBE Australia\'s standard Terms & Conditions.'
  const [generalTerms,        setGeneralTerms]        = useState<string>('')
  const [editingGeneralTerms, setEditingGeneralTerms] = useState(false)
  const [tempGeneralTerms,    setTempGeneralTerms]    = useState('')
  const [generalEndUser,      setGeneralEndUser]      = useState<'CUSTOMER' | 'DISTRIBUTOR' | 'TENDER' | ''>('CUSTOMER')

  // General quote — editable sender / company info
  const [generalSenderName,    setGeneralSenderName]    = useState('NBE AUSTRALIA')
  const [generalSenderAddress, setGeneralSenderAddress] = useState('22A Humeside Dr, Campbellfield VIC 3061, Australia')
  const [generalSenderEmail,   setGeneralSenderEmail]   = useState('accountsreceivable@nbeaustralia.com.au')
  const [generalContactName,   setGeneralContactName]   = useState('Andrew Newton')
  const [generalContactPhone,  setGeneralContactPhone]  = useState('(04) 2705 5556')
  const [generalContactEmail,  setGeneralContactEmail]  = useState('anewton@nbeaustralia.com.au')

  // Parts quote — editable disclaimer + T&C end user selector
  const DEFAULT_PARTS_TERMS = 'This quotation covers the parts and components listed above. Pricing is valid for 30 days from the date of issue. All items are subject to availability at time of order. All supply is subject to NBE Australia\'s standard Terms & Conditions.'
  const [partsTerms,        setPartsTerms]        = useState<string>('')
  const [editingPartsTerms, setEditingPartsTerms] = useState(false)
  const [tempPartsTerms,    setTempPartsTerms]    = useState('')
  const [partsEndUser,      setPartsEndUser]      = useState<'CUSTOMER' | 'DISTRIBUTOR' | 'TENDER' | ''>('CUSTOMER')

  // Parts quote — editable sender / company info
  const [partsSenderName,    setPartsSenderName]    = useState('NBE AUSTRALIA')
  const [partsSenderAddress, setPartsSenderAddress] = useState('22A Humeside Dr, Campbellfield VIC 3061, Australia')
  const [partsSenderEmail,   setPartsSenderEmail]   = useState('accountsreceivable@nbeaustralia.com.au')
  const [partsContactName,   setPartsContactName]   = useState('Andrew Newton')
  const [partsContactPhone,  setPartsContactPhone]  = useState('(04) 2705 5556')
  const [partsContactEmail,  setPartsContactEmail]  = useState('anewton@nbeaustralia.com.au')

  function loadNotesFromStorage(qn: string) {
    try {
      const s = localStorage.getItem(`nbe_note2_${qn}`)
      if (s) setPage2SummaryNote(s)
    } catch { /* ignore */ }
  }
  function saveNote2(qn: string | null, text: string) {
    setPage2SummaryNote(text)
    if (!qn) return
    try { localStorage.setItem(`nbe_note2_${qn}`, text) } catch { /* ignore */ }
  }

  // Multi-door
  const [savedDoors, setSavedDoors] = useState<SavedDoor[]>([])

  // Customer
  const [custName,       setCustName]       = useState('')
  const [custAttn,       setCustAttn]       = useState('')
  const [custAddress,    setCustAddress]    = useState('')
  const [custPostcode,   setCustPostcode]   = useState('')
  const [custPhone,      setCustPhone]      = useState('')
  const [custEmail,      setCustEmail]      = useState('')
  const [custCanBeBlank, setCustCanBeBlank] = useState(false)

  // Generation / preview
  const [quoteNumber,  setQuoteNumber]  = useState<string | null>(null)
  const quoteNumberRef = useRef<string | null>(null)  // stable ref — avoids stale closure in handleGenerateQuote
  const quoteIdRef     = useRef<string | null>(null)  // Supabase quotes.id — set after first save
  const [generating,   setGenerating]   = useState(false)
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null)
  const [showPreview,  setShowPreview]  = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  // List view vs form view
  const [view, setView] = useState<'list' | 'form'>('list')
  const [search, setSearch] = useState('')

  // Recent quotes (loaded from Supabase)
  type DetailRow = {
    customer_attn: string | null; customer_postcode: string | null
    customer_phone: string | null; customer_email: string | null
    doors: DoorLineItem[] | null
    include_summary: boolean | null; individual_install: boolean | null
    end_user_type: string | null; image_style: string | null
    page1_disclaimer: string | null; page2_note: string | null
  }
  type RecentQuoteRow = {
    id: string; quote_number: string; customer_name: string | null
    site_address: string | null; valid_until: string | null
    service_date: string; total: number; workflow_status: string
    rapid_door_quote_details: DetailRow | null
  }
  const [recentQuotes, setRecentQuotes]     = useState<RecentQuoteRow[]>([])
  const [recentLoading, setRecentLoading]   = useState(true)

  function loadRecentQuotes() {
    setRecentLoading(true)
    fetch('/api/quotes/rapid-door/list?limit=25')
      .then(r => r.json())
      .then(j => { if (j.ok) setRecentQuotes(j.data ?? []) })
      .catch(() => {/* non-fatal */})
      .finally(() => setRecentLoading(false))
  }

  useEffect(() => { loadRecentQuotes() }, [])

  // Logged-in user email (for CC self option)
  const [loggedInEmail, setLoggedInEmail] = useState('')
  useEffect(() => {
    createSupabaseClient().auth.getUser()
      .then(({ data }) => { if (data.user?.email) setLoggedInEmail(data.user.email) })
      .catch(() => { /* non-critical — CC-self option just won't pre-fill */ })
  }, [])

  // ── Signature (single HTML blob, persisted in localStorage) ─────────────────
  const [sigHtml,       setSigHtml]       = useState('')
  const [includeSig,    setIncludeSig]    = useState(true)
  const [showSigEditor, setShowSigEditor] = useState(false)
  const sigEditorRef  = useRef<HTMLDivElement>(null)
  const sigFileRef    = useRef<HTMLInputElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  useEffect(() => {
    try {
      // Migrate old separate fields → single HTML blob
      const oldText  = localStorage.getItem('nbe_sig_text')
      const oldImage = localStorage.getItem('nbe_sig_image')
      const html     = localStorage.getItem('nbe_sig_html')
      const inc      = localStorage.getItem('nbe_sig_include')
      if (html) {
        setSigHtml(html)
      } else if (oldText || oldImage) {
        // Build HTML from legacy storage
        const parts: string[] = []
        if (oldImage) parts.push(`<img src="${oldImage}" style="max-height:48px;display:block" alt="logo">`)
        if (oldText)  parts.push(`<div style="white-space:pre-wrap">${oldText.replace(/</g, '&lt;')}</div>`)
        const migrated = parts.join('')
        setSigHtml(migrated)
        localStorage.setItem('nbe_sig_html', migrated)
      }
      if (inc !== null) setIncludeSig(inc !== 'false')
    } catch { /* ignore */ }
  }, [])

  function saveSigHtml(html: string, include: boolean) {
    try {
      localStorage.setItem('nbe_sig_html', html)
      localStorage.setItem('nbe_sig_include', String(include))
    } catch { /* ignore */ }
  }

  function saveSelectionBeforeUpload() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  function insertImageAtCursor(dataUrl: string) {
    const editor = sigEditorRef.current
    if (!editor) return
    editor.focus()
    // Restore saved cursor position
    if (savedRangeRef.current) {
      const sel = window.getSelection()
      if (sel) { sel.removeAllRanges(); sel.addRange(savedRangeRef.current) }
    }
    const img = document.createElement('img')
    img.src = dataUrl
    img.style.cssText = 'max-height:48px;vertical-align:middle;display:inline-block'
    img.alt = 'logo'
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      range.insertNode(img)
      range.setStartAfter(img)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      editor.appendChild(img)
    }
    const html = editor.innerHTML
    setSigHtml(html)
    saveSigHtml(html, includeSig)
  }

  function handleSigImageUpload(file: File) {
    const reader = new FileReader()
    reader.onload = () => insertImageAtCursor(reader.result as string)
    reader.readAsDataURL(file)
  }

  // ── Email modal ───────────────────────────────────────────────────────────────
  const [showEmailModal,  setShowEmailModal]  = useState(false)
  const [emailTo,         setEmailTo]         = useState('')
  const [emailCc,         setEmailCc]         = useState('')
  const [ccSelf,          setCcSelf]          = useState(false)
  const [emailSubject,    setEmailSubject]    = useState('')
  const [emailBody,       setEmailBody]       = useState('')
  const [attachPdf,       setAttachPdf]       = useState(true)
  const [emailSending,    setEmailSending]    = useState(false)
  const [emailResult,     setEmailResult]     = useState<{ ok: boolean; msg: string } | null>(null)

  function buildDefaultEmailBody() {
    // Only use custAttn (contact person) for the greeting — never the quote number fallback
    const contactName = custAttn || (custName && custName !== quoteNumber ? custName : '')
    const greeting = contactName ? `Hi ${contactName},` : 'Hi,'
    const qnRef = quoteNumber ? `\nQuotation Ref: ${quoteNumber}\n` : ''
    const companyName = custName && custName !== quoteNumber ? ` for ${custName}` : ''
    return `${greeting}
${qnRef}
Please find attached the industrial rapid door quotation${companyName}.

The quote includes all relevant specifications and pricing as discussed. Please do not hesitate to contact us should you require any further information or clarification.`
  }

  function openEmailModal() {
    setEmailTo(custEmail || '')
    setEmailCc('')
    setCcSelf(false)
    setEmailSubject(quoteNumber ? `Rapid Door Quotation – ${quoteNumber}${custName ? ` – ${custName}` : ''}` : 'Rapid Door Quotation')
    setEmailBody(buildDefaultEmailBody())
    setEmailResult(null)
    setAttachPdf(true)
    setShowSigEditor(false)
    setShowEmailModal(true)
  }

  function emailIsValid(addr: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.trim()) }
  const toList = emailTo.split(/[,;\n]/).map(e => e.trim()).filter(e => e.length > 0)
  const toAllValid = toList.length > 0 && toList.every(emailIsValid)
  const ccList = emailCc.split(/[,;\n]/).map(e => e.trim()).filter(e => e.length > 0)
  const ccAllValid = ccList.length === 0 || ccList.every(emailIsValid)
  const canSendEmail = toAllValid && ccAllValid && emailSubject.trim().length > 0 && emailBody.trim().length > 0 && !emailSending

  // Colour dropdown
  const [colourOpen,          setColourOpen]          = useState(false)
  const [safetyEdgeColourOpen,setSafetyEdgeColourOpen] = useState(false)
  const colourRef          = useRef<HTMLDivElement>(null)
  const safetyEdgeColourRef = useRef<HTMLDivElement>(null)

  function setSafetyField(key: string, val: string) {
    setSafetyValues(prev => ({ ...prev, [key]: val }))
  }

  function resetDoorForm() {
    setDoorType(''); setDoorModel(''); setOpeningW(''); setOpeningH(''); setFrame(''); setCurtain('')
    setColour(''); setMotorKw(''); setMotorSide(''); setCbSide(''); setDoorControl(''); setSafetyEdgeColour(''); setQty('1')
    setUnitPrice(''); setSafetyValues({}); setMotorEnabled(true); setEndUser('CUSTOMER')
    setCustomDoorImage(null); setCustomDoorImageName(null)
    setDelivery(''); setInstallation(''); setDemolition(''); setDemolitionEnabled(false); setDemolitionScope(''); setEquipHire(''); setAccTravel('')
    setCustomDesc(null); setEditingDesc(false)
  }

  function resetAll() {
    resetDoorForm()
    setQuoteNumber(null)
    quoteNumberRef.current = null
    quoteIdRef.current = null
    setSavedDoors([])
    setPreviewUrl(null)
    setShowPreview(false)
    setPage2SummaryNote('')
    setCustName(''); setCustAttn(''); setCustAddress(''); setCustPostcode(''); setCustPhone(''); setCustEmail('')
    setIncludeSummary(true); setIndividualInstall(false)
    setMaintItems(Array.from({ length: 5 }, emptyMaintItem))
    setSavedPvcDoors([]); resetActivePvcDoor()
    setPvcDiscountPct(''); setPvcDelivery(''); setPvcInstallation('')
  }

  // ── Explicit save (without generating PDF) ───────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleSaveQuote() {
    if (!quoteNumber && !quoteNumberRef.current) {
      // Allocate a quote number if we don't have one yet
      try {
        const qn = await fetchNextRapidDoorQuoteNumber()
        quoteNumberRef.current = qn
        setQuoteNumber(qn)
        loadNotesFromStorage(qn)
      } catch {
        setSaveMsg({ ok: false, text: 'Failed to allocate quote number. Try again.' })
        return
      }
    }
    const qn = quoteNumberRef.current!
    setSaving(true)
    setSaveMsg(null)
    try {
      const validDate = new Date(); validDate.setDate(validDate.getDate() + 30)
      const validUntil = `${String(validDate.getDate()).padStart(2,'0')}/${String(validDate.getMonth()+1).padStart(2,'0')}/${validDate.getFullYear()}`
      const res = await fetch('/api/quotes/rapid-door/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteNumber: qn,
          quoteId: quoteIdRef.current ?? undefined,
          date: todayDisplay(), validUntil,
          customerName: custName, customerAttn: custAttn,
          customerAddress: custAddress || '—',
          customerPostcode: custPostcode, customerPhone: custPhone, customerEmail: custEmail,
          grandTotal,
          doors: [
            ...savedDoors,
            // include the active door if it has enough data to be meaningful
            ...(doorModel && openingW && openingH ? [{
              id: 'active',
              doorType, doorModel, openingW, openingH, frame, curtain, colour,
              motorKw, motorSide, cbSide, doorControl, safetyEdgeColour,
              safetyLines: safetySelected,
              safetyByCategory: { ...safetyValues },
              qty: qtyN, unitPrice: unitN,
              delivery: delivN, installation: instN, demolition: demolN, equipHire: equipN, accTravel: travN,
              lineTotal, customDesc,
            }] : []),
          ],
          includeSummary, individualInstall: !includeSummary ? individualInstall : false,
          endUser: endUser || undefined,
          imageStyle: loadDoorImageStyle(),
          page2SummaryNote: page2SummaryNote || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      if (json.quoteId && !quoteIdRef.current) quoteIdRef.current = json.quoteId
      setSaveMsg({ ok: true, text: `Saved as ${qn}` })
    } catch (e) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  // ── Load a saved quote into the form ─────────────────────────────────────────
  function loadQuoteFromRow(q: RecentQuoteRow) {
    resetDoorForm()
    setPreviewUrl(null); setShowPreview(false)
    setSelected('INDUSTRIAL_RAPID_DOOR')
    setQuoteNumber(q.quote_number)
    quoteNumberRef.current = q.quote_number
    quoteIdRef.current = q.id
    // Customer
    setCustName(q.customer_name ?? '')
    setCustAddress(q.site_address ?? '')
    const det = q.rapid_door_quote_details
    if (det) {
      setCustAttn(det.customer_attn ?? '')
      setCustPostcode(det.customer_postcode ?? '')
      setCustPhone(det.customer_phone ?? '')
      setCustEmail(det.customer_email ?? '')
      setIncludeSummary(det.include_summary !== false)
      setIndividualInstall(det.individual_install ?? false)
      const eu = det.end_user_type ?? ''
      setEndUser((eu === 'CUSTOMER' || eu === 'DISTRIBUTOR' || eu === 'TENDER') ? eu : '')
      if (det.page2_note) setPage2SummaryNote(det.page2_note)
      // Load all doors except last into savedDoors; restore last door into form
      const doors = Array.isArray(det.doors) ? det.doors as DoorLineItem[] : []
      if (doors.length > 1) {
        const saved: SavedDoor[] = doors.slice(0, -1).map(d => ({
          id: crypto.randomUUID(),
          doorType: d.doorType, doorModel: d.doorModel ?? '',
          openingW: String(d.openingW ?? ''), openingH: String(d.openingH ?? ''),
          frame: d.frameRaw ?? (d as unknown as SavedDoor).frame ?? '', curtain: d.curtain ?? '', colour: d.colour ?? '',
          motorKw: d.motorKw ?? '', motorSide: d.motorSide ?? '', cbSide: d.cbSide ?? '', doorControl: (d as unknown as SavedDoor).doorControl ?? '', safetyEdgeColour: (d as unknown as SavedDoor).safetyEdgeColour ?? '',
          safetyLines: (d.safetyLines ?? []) as string[], safetyByCategory: (d.safetyByCategory ?? {}) as Record<string, string>,
          qty: Number(d.qty ?? 1), unitPrice: Number(d.unitPrice ?? 0),
          delivery: Number(d.delivery ?? 0), installation: Number(d.installation ?? 0), demolition: Number(d.demolition ?? 0),
          equipHire: Number(d.equipHire ?? 0), accTravel: Number(d.accTravel ?? 0),
          lineTotal: Number(d.lineTotal ?? 0), customDesc: d.customDesc ?? null,
        }))
        setSavedDoors(saved)
      } else {
        setSavedDoors([])
      }
      // Restore last door into active form
      const last = doors[doors.length - 1]
      if (last) {
        setDoorType(last.doorType ?? '')
        setDoorModel(last.doorModel ?? '')
        setOpeningW(String(last.openingW ?? ''))
        setOpeningH(String(last.openingH ?? ''))
        setFrame(last.frameRaw ?? (last as unknown as SavedDoor).frame ?? '')
        setCurtain(last.curtain ?? '')
        setColour(last.colour ?? '')
        setMotorKw(last.motorKw ?? '')
        setMotorSide(last.motorSide ?? '')
        setCbSide(last.cbSide ?? '')
        setSafetyEdgeColour((last as unknown as SavedDoor).safetyEdgeColour ?? '')
        setQty(String(last.qty ?? 1))
        setUnitPrice(String(last.unitPrice ?? ''))
        setDelivery(String(last.delivery || ''))
        setInstallation(String(last.installation || ''))
        setDemolition(String(last.demolition || ''))
        setEquipHire(String(last.equipHire || ''))
        setAccTravel(String(last.accTravel || ''))
        if (last.safetyByCategory) setSafetyValues(last.safetyByCategory as Record<string, string>)
      }
    }
    setSaveMsg(null)
    setView('form')
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colourRef.current          && !colourRef.current.contains(e.target as Node))          setColourOpen(false)
      if (safetyEdgeColourRef.current && !safetyEdgeColourRef.current.contains(e.target as Node)) setSafetyEdgeColourOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Cleanup blob URL on unmount
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  // ── Maintenance / Repair state ───────────────────────────────────────────────
  type MaintItem = { item: string; description: string; width: string; height: string; qty: number; unitPrice: number }
  const emptyMaintItem = (): MaintItem => ({ item: '', description: '', width: '', height: '', qty: 1, unitPrice: 0 })
  const [maintItems, setMaintItems] = useState<MaintItem[]>(() => Array.from({ length: 5 }, emptyMaintItem))

  type GeneralItem = { sno: string; item: string; description: string; width: string; height: string; qty: number; unitPrice: number; notes: string; overridePrice: string; discount: string }
  const emptyGeneralItem = (i = 0): GeneralItem => ({ sno: String(i + 1), item: '', description: '', width: '', height: '', qty: 1, unitPrice: 0, notes: '', overridePrice: '', discount: '' })
  const [generalItems, setGeneralItems] = useState<GeneralItem[]>(() => Array.from({ length: 5 }, (_, i) => emptyGeneralItem(i)))
  const [generalCols, setGeneralCols] = useState({ width: true, height: true, notes: false, override: false, discount: false })
  const [generalNotesOpen, setGeneralNotesOpen] = useState<Set<number>>(new Set())
  const [showGeneralDiscount, setShowGeneralDiscount] = useState(false)
  const [generalDiscountPct, setGeneralDiscountPct] = useState('')

  function updateGeneralItem<K extends keyof GeneralItem>(i: number, key: K, val: GeneralItem[K]) {
    setGeneralItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it))
  }
  function toggleGeneralCol(col: keyof typeof generalCols) {
    setGeneralCols(prev => ({ ...prev, [col]: !prev[col] }))
  }

  type PartsItem = { item: string; description: string; width: string; height: string; qty: number; unitPrice: number }
  const emptyPartsItem = (): PartsItem => ({ item: '', description: '', width: '', height: '', qty: 1, unitPrice: 0 })
  const [partsItems, setPartsItems] = useState<PartsItem[]>(() => Array.from({ length: 5 }, emptyPartsItem))

  function updatePartsItem<K extends keyof PartsItem>(i: number, key: K, val: PartsItem[K]) {
    setPartsItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it))
  }

  function updateMaintItem<K extends keyof MaintItem>(i: number, key: K, val: MaintItem[K]) {
    setMaintItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it))
  }

  // ── PVC Flex System state ────────────────────────────────────────────────────
  type PvcFlexDoorItem = {
    id: string
    openingW: string; openingH: string
    stripWidth: number; thickness: number
    grade: 'Ambient' | 'Freezer'
    profile: 'Ribbed' | 'Flat' | 'Coloured'
    hanger: 'Galvanised' | 'Stainless Steel'
    supplyType: 'Complete Door' | 'Strip Curtain Only' | 'Headrail Only'
    mountingType: 'Face Fixed' | 'Soffit Fixed'
    sliding: 'NA' | 'Single' | 'Dual'
    raisedHeadrail: boolean
    qty: number
  }

  // Saved/locked doors (chips at top) + individual active-door fields (rapid-door style)
  const [savedPvcDoors, setSavedPvcDoors] = useState<PvcFlexDoorItem[]>([])
  const [pvcW,       setPvcW]       = useState('')
  const [pvcH,       setPvcH]       = useState('')
  const [pvcStripW,  setPvcStripW]  = useState(200)
  const [pvcThick,   setPvcThick]   = useState(2)
  const [pvcGrade,   setPvcGrade]   = useState<'Ambient' | 'Freezer'>('Ambient')
  const [pvcProfile, setPvcProfile] = useState<'Ribbed' | 'Flat' | 'Coloured'>('Ribbed')
  const [pvcHanger,  setPvcHanger]  = useState<'Galvanised' | 'Stainless Steel'>('Galvanised')
  const [pvcSupply,  setPvcSupply]  = useState<'Complete Door' | 'Strip Curtain Only' | 'Headrail Only'>('Complete Door')
  const [pvcMount,   setPvcMount]   = useState<'Face Fixed' | 'Soffit Fixed'>('Face Fixed')
  const [pvcSliding, setPvcSliding] = useState<'NA' | 'Single' | 'Dual'>('NA')
  const [pvcRaisedHR, setPvcRaisedHR] = useState(false)
  const [pvcQtyStr,  setPvcQtyStr]  = useState('1')

  function resetActivePvcDoor() {
    setPvcW(''); setPvcH(''); setPvcStripW(200); setPvcThick(2)
    setPvcGrade('Ambient'); setPvcProfile('Ribbed'); setPvcHanger('Galvanised')
    setPvcSupply('Complete Door'); setPvcMount('Face Fixed')
    setPvcSliding('NA'); setPvcRaisedHR(false); setPvcQtyStr('1')
  }

  function lockAndAddPvcDoor() {
    if (!pvcW || !pvcH) return
    setSavedPvcDoors(prev => [...prev, {
      id: crypto.randomUUID(), openingW: pvcW, openingH: pvcH,
      stripWidth: pvcStripW, thickness: pvcThick, grade: pvcGrade, profile: pvcProfile,
      hanger: pvcHanger, supplyType: pvcSupply, mountingType: pvcMount,
      sliding: pvcSliding, raisedHeadrail: pvcRaisedHR, qty: parseInt(pvcQtyStr) || 1,
    }])
    resetActivePvcDoor()
  }

  function removeSavedPvcDoor(id: string) {
    setSavedPvcDoors(prev => prev.filter(d => d.id !== id))
  }

  function editSavedPvcDoor(id: string) {
    const d = savedPvcDoors.find(x => x.id === id)
    if (!d) return
    // If there's unsaved data in the active form, save it first
    if (pvcW && pvcH) lockAndAddPvcDoor()
    setPvcW(d.openingW); setPvcH(d.openingH); setPvcStripW(d.stripWidth); setPvcThick(d.thickness)
    setPvcGrade(d.grade); setPvcProfile(d.profile); setPvcHanger(d.hanger)
    setPvcSupply(d.supplyType); setPvcMount(d.mountingType)
    setPvcSliding(d.sliding); setPvcRaisedHR(d.raisedHeadrail); setPvcQtyStr(String(d.qty))
    setSavedPvcDoors(prev => prev.filter(x => x.id !== id))
  }

  const [pvcDiscountPct, setPvcDiscountPct] = useState('')
  const [pvcDelivery, setPvcDelivery] = useState('')
  const [pvcInstallation, setPvcInstallation] = useState('')

  const DEFAULT_PVC_TERMS = "This quotation covers the PVC strip curtain system(s) listed above. Strip configurations are calculated from nominated opening dimensions; final measurements must be verified on-site before manufacture. Pricing is valid for 30 days from date of issue. Delivery and installation are excluded unless shown as priced line items. All supply and installation is subject to NBE Australia's standard Terms & Conditions."
  const [pvcTerms, setPvcTerms] = useState<string>('')
  const [editingPvcTerms, setEditingPvcTerms] = useState(false)
  const [tempPvcTerms, setTempPvcTerms] = useState('')
  const [pvcEndUser, setPvcEndUser] = useState<'CUSTOMER' | 'DISTRIBUTOR' | 'TENDER' | ''>('CUSTOMER')

  const [pvcSenderName,    setPvcSenderName]    = useState('NBE AUSTRALIA')
  const [pvcSenderAddress, setPvcSenderAddress] = useState('22A Humeside Dr, Campbellfield VIC 3061, Australia')
  const [pvcSenderEmail,   setPvcSenderEmail]   = useState('accountsreceivable@nbeaustralia.com.au')
  const [pvcContactName,   setPvcContactName]   = useState('Andrew Newton')
  const [pvcContactPhone,  setPvcContactPhone]  = useState('(04) 2705 5556')
  const [pvcContactEmail,  setPvcContactEmail]  = useState('anewton@nbeaustralia.com.au')

  async function handleGenerateMaintenance() {
    setGenerating(true)
    try {
      if (!quoteNumberRef.current) {
        const res = await fetch('/api/quotes/next-number?prefix=QREP')
        if (!res.ok) throw new Error('Failed to allocate quote number')
        const { quoteNumber: qn } = await res.json() as { quoteNumber: string }
        quoteNumberRef.current = qn
        setQuoteNumber(qn)
      }
      const filled = maintItems.filter(it => it.item.trim())
      const validDate = new Date(); validDate.setDate(validDate.getDate() + 30)
      const validUntil = `${String(validDate.getDate()).padStart(2,'0')}/${String(validDate.getMonth()+1).padStart(2,'0')}/${validDate.getFullYear()}`
      const res = await fetch('/api/quotes/maintenance/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteNumber: quoteNumberRef.current,
          date: todayDisplay(), validUntil,
          customerName: custName, customerAttn: custAttn,
          customerAddress: custAddress, customerPostcode: custPostcode,
          customerPhone: custPhone, customerEmail: custEmail,
          lineItems: filled,
          terms: maintTerms || DEFAULT_MAINT_TERMS,
          endUser: maintEndUser || undefined,
          senderName: maintSenderName, senderAddress: maintSenderAddress, senderEmail: maintSenderEmail,
          contactName: maintContactName, contactPhone: maintContactPhone, contactEmail: maintContactEmail,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Unknown' })); alert(`Failed: ${e.error}`); return }
      const blob = await res.blob()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setShowPreview(true)
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setGenerating(false)
    }
  }

  async function handleGenerateParts() {
    setGenerating(true)
    try {
      if (!quoteNumberRef.current) {
        const res = await fetch('/api/quotes/next-number?prefix=QPTS')
        if (!res.ok) throw new Error('Failed to allocate quote number')
        const { quoteNumber: qn } = await res.json() as { quoteNumber: string }
        quoteNumberRef.current = qn
        setQuoteNumber(qn)
      }
      const filled = partsItems.filter(it => it.item.trim())
      const validDate = new Date(); validDate.setDate(validDate.getDate() + 30)
      const validUntil = `${String(validDate.getDate()).padStart(2,'0')}/${String(validDate.getMonth()+1).padStart(2,'0')}/${validDate.getFullYear()}`
      const res = await fetch('/api/quotes/parts/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteNumber: quoteNumberRef.current,
          date: todayDisplay(), validUntil,
          customerName: custName, customerAttn: custAttn,
          customerAddress: custAddress, customerPostcode: custPostcode,
          customerPhone: custPhone, customerEmail: custEmail,
          lineItems: filled,
          terms: partsTerms || DEFAULT_PARTS_TERMS,
          endUser: partsEndUser || undefined,
          senderName: partsSenderName, senderAddress: partsSenderAddress, senderEmail: partsSenderEmail,
          contactName: partsContactName, contactPhone: partsContactPhone, contactEmail: partsContactEmail,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Unknown' })); alert(`Failed: ${e.error}`); return }
      const blob = await res.blob()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setShowPreview(true)
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setGenerating(false)
    }
  }

  async function handleGenerateGeneral() {
    setGenerating(true)
    try {
      if (!quoteNumberRef.current) {
        const res = await fetch('/api/quotes/next-number?prefix=QGEN')
        if (!res.ok) throw new Error('Failed to allocate quote number')
        const { quoteNumber: qn } = await res.json() as { quoteNumber: string }
        quoteNumberRef.current = qn
        setQuoteNumber(qn)
      }
      const filled = generalItems.filter(it => it.item.trim())
      const validDate = new Date(); validDate.setDate(validDate.getDate() + 30)
      const validUntil = `${String(validDate.getDate()).padStart(2,'0')}/${String(validDate.getMonth()+1).padStart(2,'0')}/${validDate.getFullYear()}`
      const res = await fetch('/api/quotes/general/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteNumber: quoteNumberRef.current,
          date: todayDisplay(), validUntil,
          customerName: custName, customerAttn: custAttn,
          customerAddress: custAddress, customerPostcode: custPostcode,
          customerPhone: custPhone, customerEmail: custEmail,
          lineItems: filled,
          terms: generalTerms || DEFAULT_GENERAL_TERMS,
          endUser: generalEndUser || undefined,
          senderName: generalSenderName, senderAddress: generalSenderAddress, senderEmail: generalSenderEmail,
          contactName: generalContactName, contactPhone: generalContactPhone, contactEmail: generalContactEmail,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Unknown' })); alert(`Failed: ${e.error}`); return }
      const blob = await res.blob()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setShowPreview(true)
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setGenerating(false)
    }
  }

  async function handleGeneratePvcFlex() {
    setGenerating(true)
    try {
      if (!quoteNumberRef.current) {
        const res = await fetch('/api/quotes/next-number?prefix=QPVC')
        if (!res.ok) throw new Error('Failed to allocate quote number')
        const { quoteNumber: qn } = await res.json() as { quoteNumber: string }
        quoteNumberRef.current = qn
        setQuoteNumber(qn)
      }

      // Dynamic import to avoid sending calculator code to all pages
      const { calcPvcNewQuote, buildPvcDoorDescription, discountedSellPrice, autoRaisedHeadrailSize } =
        await import('@/lib/pvc/pvcNewQuoteCalculator')

      const discPct = parseFloat(pvcDiscountPct) || 0
      const validDate = new Date(); validDate.setDate(validDate.getDate() + 30)
      const validUntil = `${String(validDate.getDate()).padStart(2,'0')}/${String(validDate.getMonth()+1).padStart(2,'0')}/${validDate.getFullYear()}`

      // Combine saved doors + active door (if filled)
      const activeDoor: PvcFlexDoorItem | null = pvcW && pvcH ? {
        id: 'active', openingW: pvcW, openingH: pvcH,
        stripWidth: pvcStripW, thickness: pvcThick, grade: pvcGrade, profile: pvcProfile,
        hanger: pvcHanger, supplyType: pvcSupply, mountingType: pvcMount,
        sliding: pvcSliding, raisedHeadrail: pvcRaisedHR, qty: parseInt(pvcQtyStr) || 1,
      } : null
      const allPvcDoors = [...savedPvcDoors, ...(activeDoor ? [activeDoor] : [])]
      const filledDoors = allPvcDoors.filter(d => d.openingW && d.openingH)
      const doorLineItems = filledDoors.map((d, i) => {
        const raisedHR = d.raisedHeadrail
          ? autoRaisedHeadrailSize(parseFloat(d.openingW) || 0)
          : 'NA' as const
        const spec = {
          openingW: parseFloat(d.openingW) || 0,
          openingH: parseFloat(d.openingH) || 0,
          stripWidth: d.stripWidth,
          thickness: d.thickness,
          grade: d.grade,
          profile: d.profile,
          hanger: d.hanger,
          supplyType: d.supplyType,
          mountingType: d.mountingType,
          sliding: d.sliding,
          raisedHeadrail: raisedHR,
        }
        const calc = calcPvcNewQuote(spec)
        const unitPrice = discountedSellPrice(spec, calc, discPct)
        return {
          item: `Door ${i + 1}`,
          description: buildPvcDoorDescription(spec, calc),
          qty: d.qty,
          unitPrice: Math.round(unitPrice * 100) / 100,
          originalPrice: Math.round(calc.sellPrice * 100) / 100,
        }
      })

      const res = await fetch('/api/quotes/pvc-flex/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteNumber: quoteNumberRef.current,
          date: todayDisplay(), validUntil,
          customerName: custName, customerAttn: custAttn,
          customerAddress: custAddress, customerPostcode: custPostcode,
          customerPhone: custPhone, customerEmail: custEmail,
          doors: doorLineItems,
          delivery:     parseFloat(pvcDelivery)     || undefined,
          installation: parseFloat(pvcInstallation) || undefined,
          discountPct:  discPct || undefined,
          terms: pvcTerms || DEFAULT_PVC_TERMS,
          endUser: pvcEndUser || undefined,
          senderName: pvcSenderName, senderAddress: pvcSenderAddress, senderEmail: pvcSenderEmail,
          contactName: pvcContactName, contactPhone: pvcContactPhone, contactEmail: pvcContactEmail,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({ error: 'Unknown' })); alert(`Failed: ${e.error}`); return }
      const blob = await res.blob()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setShowPreview(true)
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setGenerating(false)
    }
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const qtyN      = parseFloat(qty) || 1
  const unitN     = parseFloat(unitPrice) || 0
  const delivN    = parseFloat(delivery) || 0
  const instN     = parseFloat(installation) || 0
  const demolN    = parseFloat(demolition) || 0
  const equipN    = parseFloat(equipHire) || 0
  const travN     = parseFloat(accTravel) || 0
  const lineTotal = qtyN * unitN + delivN + instN + demolN + equipN + travN

  const safetySelected = Object.values(safetyValues).filter(v => v && v !== '-')

const autoDescLines = [
  doorType ? `${doorType} | ${doorTypeName(doorType)}` : '',
  [
    openingW && openingH ? `${openingW} W × ${openingH} H mm` : '',
    frame ? `${optDesc('frame', frame)} frame` : '',
    colour,
  ].filter(v => typeof v === 'string' && v.trim().length > 0).join(' | ')
].filter(Boolean)

  const displayDesc = customDesc ?? autoDescLines.join('\n')

  const isRapidDoor       = selected === 'INDUSTRIAL_RAPID_DOOR'
  const isMaintenance     = selected === 'MAINTENANCE_SERVICE_REPAIR'
  const isGeneral         = selected === 'GENERAL'
  const isParts           = selected === 'PARTS'
  const isPvcFlex         = selected === 'PVC_FLEX_SYSTEM'
  const showRightPanel    = isRapidDoor && !!doorType

  const grandTotal = lineTotal + savedDoors.reduce((sum, d) => sum + d.lineTotal, 0)

  const customerFilled = !!custName && !!custAddress
  const { ew: extW, eh: extH } = doorType && doorModel && openingW && openingH
    ? calcExternal(openingW, openingH, doorType, doorModel)
    : { ew: '', eh: '' }

  const canGenerate = !generating && !!doorType && !!doorModel && !!openingW && !!openingH && !!frame &&
    !!curtain && !!colour && !!qty && !!unitPrice &&
    (custCanBeBlank || customerFilled)

  const missingFields = [
    !doorType                                   && 'Door Type',
    !doorModel                                  && 'Door Model',
    !openingW                                   && 'Clear Width',
    !openingH                                   && 'Clear Height',
    !frame                                      && 'Frame',
    !curtain                                    && 'Curtain',
    !colour                                     && 'Colour',
    !unitPrice                                  && 'Unit Price',
    (!custCanBeBlank && !customerFilled)        && 'Customer Name & Address',
  ].filter(Boolean) as string[]

  // ── Save current door to locked list ────────────────────────────────────────
  function saveCurrentDoor() {
    const door: SavedDoor = {
      id: crypto.randomUUID(),
      doorType, doorModel, openingW, openingH, frame, curtain, colour,
      motorKw, motorSide, cbSide, doorControl, safetyEdgeColour,
      safetyLines: safetySelected,
      safetyByCategory: { ...safetyValues },
      qty: qtyN, unitPrice: unitN,
      delivery: delivN, installation: instN, demolition: demolN, equipHire: equipN, accTravel: travN,
      lineTotal, customDesc,
    }
    setSavedDoors(prev => [...prev, door])
  }

  function handleAddAnotherDoor() {
    saveCurrentDoor()
    resetDoorForm()
    setShowPreview(false)
  }

  function removeSavedDoor(id: string) {
    setSavedDoors(prev => prev.filter(d => d.id !== id))
  }

  function editSavedDoor(id: string) {
    const d = savedDoors.find(x => x.id === id)
    if (!d) return
    // Restore this door's fields into the current form
    setDoorType(d.doorType); setDoorModel(d.doorModel ?? ''); setOpeningW(d.openingW); setOpeningH(d.openingH)
    setFrame(d.frame); setCurtain(d.curtain); setColour(d.colour)
    setMotorKw(d.motorKw); setMotorSide(d.motorSide); setCbSide(d.cbSide); setDoorControl(d.doorControl ?? ''); setSafetyEdgeColour(d.safetyEdgeColour ?? '')
    setQty(String(d.qty)); setUnitPrice(String(d.unitPrice))
    setDelivery((d.delivery ?? 0) > 0 ? String(d.delivery) : '')
    setInstallation(d.installation > 0 ? String(d.installation) : '')
    const demolVal = d.demolition > 0 ? String(d.demolition) : ''
    setDemolition(demolVal)
    setDemolitionEnabled(d.demolition > 0)
    setDemolitionScope((d as any).demolitionScope ?? '')
    setEquipHire(d.equipHire > 0 ? String(d.equipHire) : '')
    setAccTravel(d.accTravel > 0 ? String(d.accTravel) : '')
    setCustomDesc(d.customDesc); setEditingDesc(false)
    // Safety: reconstruct safetyValues map from safetyLines
    if (d.safetyLines.length > 0) {
      // We can't reconstruct per-field mapping perfectly, so put first 6 into the keys
      const keys = ['indicatorLamp','safety','pushButton','radar','remoteControl','inductLoop','swipe']
      const vals: Record<string,string> = {}
      d.safetyLines.forEach((v, i) => { if (keys[i]) vals[keys[i]] = v })
      setSafetyValues(vals)
    } else {
      setSafetyValues({}); setMotorEnabled(false)
    }
    // Remove from saved list so it's back in the form
    setSavedDoors(prev => prev.filter(x => x.id !== id))
    setShowPreview(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Generate quote ───────────────────────────────────────────────────────────
  async function handleGenerateQuote() {
    setGenerating(true)
    try {
      const qn = quoteNumberRef.current ?? await fetchNextRapidDoorQuoteNumber()
      if (!quoteNumberRef.current) {
        quoteNumberRef.current = qn
        setQuoteNumber(qn)
        loadNotesFromStorage(qn)
      }

      const validDate = new Date()
      validDate.setDate(validDate.getDate() + 30)
      const validUntil = `${String(validDate.getDate()).padStart(2,'0')}/${String(validDate.getMonth()+1).padStart(2,'0')}/${validDate.getFullYear()}`

      // Build all doors (saved + current)
      const allDoors = [
        ...savedDoors.map(d => {
          const { ew, eh } = calcExternal(d.openingW, d.openingH, d.doorType, d.doorModel ?? '')
          return {
            doorType: d.doorType, doorTypeName: doorTypeName(d.doorType),
            doorModel: d.doorModel,
            openingW: d.openingW, openingH: d.openingH,
            externalW: ew, externalH: eh,
            frameRaw: d.frame,
            frame: optDesc('frame', d.frame),
            curtain: d.curtain, colour: d.colour,
            motorKw: d.motorKw, motorSide: d.motorSide, cbSide: d.cbSide, doorControl: d.doorControl ?? '',
            safetyEdgeColour: d.safetyEdgeColour ?? '',
            safetyLines: d.safetyLines,
            safetyByCategory: d.safetyByCategory,
            qty: d.qty, unitPrice: d.unitPrice,
            delivery: d.delivery ?? 0, installation: d.installation, demolition: d.demolition,
            equipHire: d.equipHire, accTravel: d.accTravel,
            lineTotal: d.lineTotal, customDesc: d.customDesc,
            colourCode: COLOUR_IMAGE_CODE[d.colour] ?? null,
            scope: ((d as any).demolitionScope as string | undefined) || undefined,
          }
        }),
        {
          doorType, doorTypeName: doorTypeName(doorType),
          doorModel,
          openingW, openingH,
          externalW: extW, externalH: extH,
          frameRaw: frame,
          frame: optDesc('frame', frame),
          curtain, colour,
          motorKw, motorSide, cbSide, doorControl, safetyEdgeColour,
          safetyLines: safetySelected,
          safetyByCategory: { ...safetyValues },
          qty: qtyN, unitPrice: unitN,
          delivery: delivN, installation: instN, demolition: demolN, equipHire: equipN, accTravel: travN,
          lineTotal, customDesc,
          colourCode: COLOUR_IMAGE_CODE[colour] ?? null,
          scope: demolitionScope || undefined,
        },
      ]

      const res = await fetch('/api/quotes/rapid-door/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteNumber: qn, date: todayDisplay(), validUntil,
          doors: allDoors,
          grandTotal,
          imageStyle: loadDoorImageStyle(),
          customerName: custName, customerAttn: custAttn,
          customerAddress: custAddress, customerPostcode: custPostcode,
          customerPhone: custPhone, customerEmail: custEmail,
          page2SummaryNote: page2SummaryNote || undefined,
          endUser:          endUser          || undefined,
          includeSummary,
          individualInstall: !includeSummary ? individualInstall : undefined,
          customDoorImageBase64: customDoorImage || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        alert(`Failed: ${err.error}`); return
      }

      const blob = await res.blob()
      // Revoke previous URL before creating new one
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setShowPreview(true)

      // Save to Supabase (non-fatal — PDF already generated)
      try {
        const saveRes = await fetch('/api/quotes/rapid-door/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteNumber: qn,
            quoteId: quoteIdRef.current ?? undefined,
            date: todayDisplay(), validUntil,
            customerName: custName, customerAttn: custAttn,
            customerAddress: custAddress, customerPostcode: custPostcode,
            customerPhone: custPhone, customerEmail: custEmail,
            grandTotal, doors: allDoors,
            includeSummary,
            individualInstall: !includeSummary ? individualInstall : false,
            endUser: endUser || undefined,
            imageStyle: loadDoorImageStyle(),
            page2SummaryNote: page2SummaryNote || undefined,
          }),
        })
        const saveJson = await saveRes.json()
        if (saveJson.ok && saveJson.quoteId && !quoteIdRef.current) {
          quoteIdRef.current = saveJson.quoteId
        }
      } catch { /* non-fatal */ }

      // Scroll to preview
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setGenerating(false)
    }
  }

  function handleDownload() {
    if (!previewUrl || !quoteNumber) return
    const a = document.createElement('a')
    a.href = previewUrl
    const safeCust = (custName || 'CUSTOMER')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 50)
    const euPart = endUser ? `_${endUser}` : ''
    a.download = `${quoteNumber}_${safeCust}${euPart}.pdf`
    a.click()
  }

  function handleEditQuote() {
    setShowPreview(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filteredQuotes = recentQuotes.filter(q => {
    if (!search.trim()) return true
    const s = search.trim().toLowerCase()
    return (
      (q.quote_number ?? '').toLowerCase().includes(s) ||
      (q.customer_name ?? '').toLowerCase().includes(s)
    )
  })

  // ── Render ──────────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">New Quotes</h1>
            <p className="mt-1 text-sm text-slate-500">Create and manage quotations — General, Rapid Door, PVC, Maintenance &amp; Parts.</p>
          </div>
          <button type="button" onClick={() => { resetAll(); setView('form') }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Quote
          </button>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">search</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Customer name or quote number…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <button type="button" onClick={loadRecentQuotes}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh
          </button>
        </div>

        {/* Quotes table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {recentLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
              <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
              <span className="text-sm">Loading quotes…</span>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
              <span className="material-symbols-outlined text-5xl text-slate-300">receipt_long</span>
              <p className="text-sm font-medium">
                {search.trim() ? 'No quotes match your search' : 'No rapid door quotes yet'}
              </p>
              {!search.trim() && (
                <button type="button" onClick={() => { resetAll(); setView('form') }}
                  className="mt-1 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Create first quote
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto xl:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                      <th className="px-6 py-3">Quote #</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Doors</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Total (inc. GST)</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotes.map(q => {
                      const doorCount = Array.isArray(q.rapid_door_quote_details?.doors) ? q.rapid_door_quote_details!.doors.length : '—'
                      const [y, m, d] = (q.service_date ?? '').split('-')
                      const dateStr = y ? `${d}/${m}/${y}` : '—'
                      return (
                        <tr key={q.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition">
                          <td className="px-6 py-3.5 font-mono text-xs font-semibold text-indigo-700">{q.quote_number}</td>
                          <td className="px-4 py-3.5 font-medium text-slate-800">{q.customer_name || <span className="text-slate-400 italic font-normal">No customer</span>}</td>
                          <td className="px-4 py-3.5 text-slate-500">{doorCount}</td>
                          <td className="px-4 py-3.5 text-slate-500">{dateStr}</td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800">${Number(q.total ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                              {(q.workflow_status ?? 'draft').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <button type="button" onClick={() => loadQuoteFromRow(q)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition">
                                <span className="material-symbols-outlined text-[13px]">edit</span>Open
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile/tablet cards */}
              <ul className="space-y-0 xl:hidden divide-y divide-slate-100">
                {filteredQuotes.map(q => {
                  const doorCount = Array.isArray(q.rapid_door_quote_details?.doors) ? q.rapid_door_quote_details!.doors.length : '—'
                  const [y, m, d] = (q.service_date ?? '').split('-')
                  const dateStr = y ? `${d}/${m}/${y}` : '—'
                  return (
                    <li key={q.id} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs font-semibold text-indigo-700">{q.quote_number}</p>
                        <p className="mt-0.5 text-sm font-medium text-slate-800">{q.customer_name || <span className="text-slate-400 italic font-normal">No customer</span>}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{doorCount} door{doorCount !== 1 ? 's' : ''} · {dateStr}</p>
                        <button type="button" onClick={() => loadQuoteFromRow(q)}
                          className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition">
                          <span className="material-symbols-outlined text-[13px]">edit</span>Open
                        </button>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-slate-800">${Number(q.total ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
                        <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          {(q.workflow_status ?? 'draft').replace(/_/g, ' ')}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Form header with back button */}
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => { loadRecentQuotes(); setView('list') }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          All Quotes
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{quoteNumber ? `Quote ${quoteNumber}` : 'New Quote'}</h1>
          <p className="mt-0.5 text-sm text-slate-500">Fill in the details below to generate a quotation PDF</p>
        </div>
      </div>

      {/* ── Saved door chips (multi-door) ──────────────────────────────────── */}
      {savedDoors.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Doors in this quote:</span>
          {savedDoors.map((d, i) => (
            <div key={d.id} className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1">
              <span className="text-xs font-semibold text-indigo-700">Door {i + 1}: {d.doorType}</span>
              <span className="text-[10px] text-indigo-500">{d.openingW}×{d.openingH}mm</span>
              <button type="button" onClick={() => editSavedDoor(d.id)}
                title="Edit this door"
                className="ml-1 text-indigo-400 hover:text-indigo-600 transition">
                <span className="material-symbols-outlined text-[14px]">edit</span>
              </button>
              <button type="button" onClick={() => removeSavedDoor(d.id)}
                title="Remove this door"
                className="text-indigo-300 hover:text-red-500 transition">
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Main two-column layout ─────────────────────────────────────────── */}
      <div className={`${showRightPanel ? 'flex gap-6 items-stretch' : (isMaintenance || isGeneral || isParts || isPvcFlex) ? 'block w-full' : 'max-w-2xl'}`}>

        {/* ── LEFT: form card ─────────────────────────────────────────────── */}
        <div className={`${showRightPanel ? 'flex-1 min-w-0' : 'w-full'} rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col`}>
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-base font-semibold text-slate-800">
              {savedDoors.length > 0 ? `Add Door ${savedDoors.length + 1}` : 'Start a New Quote'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">Select the type of quotation you want to create</p>
          </div>

          <div className="px-6 py-6 space-y-5">

            {/* Quote Type — only show when no doors saved yet */}
            {savedDoors.length === 0 && (
              <div>
                <label className={LABEL_CLS}>Quote Type</label>
                <SelectWrapper>
                  <select value={selected} onChange={e => { setSelected(e.target.value); resetAll() }} className={SELECT_CLS}>
                    <option value="" disabled>— Select quote type —</option>
                    {QUOTE_TYPES.map(qt => <option key={qt.value} value={qt.value}>{qt.label}</option>)}
                  </select>
                </SelectWrapper>
              </div>
            )}

            {/* Selected type info card */}
            {selected && savedDoors.length === 0 && (() => {
              const qt = QUOTE_TYPES.find(qt => qt.value === selected)!
              return (
                <div className="flex items-start gap-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-4">
                  <span className="material-symbols-outlined mt-0.5 text-2xl text-indigo-500">{qt.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-indigo-800">{qt.label}</p>
                    <p className="mt-0.5 text-xs text-indigo-600">{qt.description}</p>
                  </div>
                </div>
              )
            })()}

          </div>{/* ── close px-6 padded div — maintenance renders at card level below ── */}

          {/* ── Maintenance / Repair form ──────────────────────────────── */}
          {isMaintenance && (() => {
              const maintSubtotal = maintItems.reduce((s, it) => s + it.qty * it.unitPrice, 0)
              const fmtM = (n: number) => n === 0 ? '$0.00' : `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              return (
                <div className="space-y-0 divide-y divide-slate-100">

                  {/* ── Sender / Company Info ── */}
                  <div className="px-6 pt-5 pb-5">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="border-b border-slate-100 px-5 py-3 bg-slate-50">
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">From (Sender Details)</span>
                      </div>
                      <div className="px-5 py-4">
                        <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                          {([
                            ['Company',       maintSenderName,    setMaintSenderName,    'NBE AUSTRALIA'],
                            ['Address',       maintSenderAddress, setMaintSenderAddress, '22A Humeside Dr, Campbellfield VIC 3061'],
                            ['Company Email', maintSenderEmail,   setMaintSenderEmail,   'accountsreceivable@nbeaustralia.com.au'],
                            ['Contact Name',  maintContactName,   setMaintContactName,   'Andrew Newton'],
                            ['Contact Phone', maintContactPhone,  setMaintContactPhone,  '(04) 2705 5556'],
                            ['Contact Email', maintContactEmail,  setMaintContactEmail,  'anewton@nbeaustralia.com.au'],
                          ] as [string, string, (v: string) => void, string][]).map(([label, value, setter, placeholder]) => (
                            <div key={label}>
                              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</label>
                              <input type="text" value={value} placeholder={placeholder} onChange={e => setter(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Customer Details (inline for maintenance) ── */}
                  <div className="px-6 pb-0 pt-5">
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Customer Details</span>
                        <span className="text-red-400 text-sm font-bold">*</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={custCanBeBlank} onChange={e => setCustCanBeBlank(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-xs text-slate-500">Customer details can be blank</span>
                      </label>
                    </div>
                    {custCanBeBlank && (
                      <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                        <span className="material-symbols-outlined text-[14px] text-amber-500">warning</span>
                        <p className="text-xs text-amber-700">Quote will be generated without customer details. This is for internal/draft use only.</p>
                      </div>
                    )}
                    <div className="px-5 py-4">
                      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                        {([
                          ['Customer',  custName,     setCustName,     'Company or customer name', true],
                          ['Attention', custAttn,     setCustAttn,     'Contact person',            false],
                          ['Address',   custAddress,  setCustAddress,  'Street address',            true],
                          ['Postcode',  custPostcode, setCustPostcode, '3000',                      false],
                          ['Phone',     custPhone,    setCustPhone,    '(03) 9000 0000',            false],
                          ['Email',     custEmail,    setCustEmail,    'contact@company.com.au',    false],
                        ] as [string, string, (v: string) => void, string, boolean][]).map(([label, value, setter, placeholder, required]) => (
                          <div key={label}>
                            <label className={`mb-1.5 block text-xs font-semibold uppercase tracking-widest ${!custCanBeBlank && required && !value ? 'text-red-400' : 'text-slate-400'}`}>
                              {label}{required && !custCanBeBlank && <span className="ml-0.5 text-red-400">*</span>}
                            </label>
                            <input type="text" value={value} placeholder={placeholder} onChange={e => setter(e.target.value)}
                              className={`w-full rounded-xl border py-2.5 px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500/20 ${!custCanBeBlank && required && !value ? 'border-red-300 focus:border-red-400 bg-white' : 'border-slate-200 bg-white focus:border-indigo-400'}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  </div>{/* end customer details px-6 wrapper */}

                  {/* Line items table — full-width, no side padding */}
                  <div className="border-t border-slate-100 rounded-b-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-900 text-white text-left text-[10px] font-semibold uppercase tracking-wider">
                          {/* Row 1: # | ITEM | DESCRIPTION(colspan=3 spans desc+width+height) | QTY | UNIT PRICE | TOTAL | + */}
                          <tr className="border-b border-slate-700">
                            <th rowSpan={2} className="px-3 py-2.5 w-8 align-middle">#</th>
                            <th rowSpan={2} className="px-2 py-2.5 w-36 align-middle">Item</th>
                            <th colSpan={3} className="px-2 pt-2.5 pb-0 text-center border-b border-slate-700">Description</th>
                            <th rowSpan={2} className="px-2 py-2.5 w-12 text-center align-middle">Qty</th>
                            <th rowSpan={2} className="px-2 py-2.5 w-24 text-right align-middle">Unit Price</th>
                            <th rowSpan={2} className="px-2 py-2.5 w-24 text-right align-middle">Total</th>
                            <th rowSpan={2} className="px-2 py-2.5 w-8 align-middle">
                              <button type="button" onClick={() => setMaintItems(prev => [...prev, emptyMaintItem()])}
                                title="Add row"
                                className="flex items-center gap-0.5 rounded-md bg-white/15 hover:bg-white/30 px-1.5 py-1 text-[10px] font-semibold text-white transition mx-auto">
                                <span className="material-symbols-outlined text-[13px]">add</span>
                              </button>
                            </th>
                          </tr>
                          {/* Row 2: sub-labels — [empty for desc text] | WIDTH | HEIGHT */}
                          <tr className="border-b border-slate-600 text-[9px] text-slate-300 font-medium">
                            <th className="px-2 pb-1.5" />{/* description text col — no sub-label */}
                            <th className="px-2 pb-1.5 w-20 text-center">Width</th>
                            <th className="px-2 pb-1.5 w-20 text-center">Height</th>
                          </tr>
                        </thead>
                        <tbody>
                          {maintItems.map((it, i) => (
                            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/60">
                              <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                              <td className="px-2 py-1.5">
                                <input type="text" value={it.item} onChange={e => updateMaintItem(i, 'item', e.target.value)}
                                  placeholder="Item name" className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="text" value={it.description} onChange={e => updateMaintItem(i, 'description', e.target.value)}
                                  placeholder="Description" className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="text" value={it.width} onChange={e => updateMaintItem(i, 'width', e.target.value)}
                                  placeholder="—" className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-center focus:border-indigo-400 focus:outline-none" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="text" value={it.height} onChange={e => updateMaintItem(i, 'height', e.target.value)}
                                  placeholder="—" className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-center focus:border-indigo-400 focus:outline-none" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" min={1} value={it.qty} onChange={e => updateMaintItem(i, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-center focus:border-indigo-400 focus:outline-none" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" min={0} step={0.01} value={it.unitPrice || ''} onChange={e => updateMaintItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  placeholder="0.00" className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-right focus:border-indigo-400 focus:outline-none" />
                              </td>
                              <td className="px-2 py-1.5 text-right font-medium text-slate-700 tabular-nums">
                                {it.qty * it.unitPrice > 0 ? fmtM(it.qty * it.unitPrice) : '—'}
                              </td>
                              <td className="px-1 py-1.5">
                                <button type="button" onClick={() => setMaintItems(prev => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i))}
                                  className="rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-500">
                                  <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Totals */}
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex justify-end">
                      <div className="w-48 space-y-1 text-xs">
                        <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="tabular-nums font-medium">{fmtM(maintSubtotal)}</span></div>
                        <div className="flex justify-between text-slate-500"><span>GST (10%)</span><span className="tabular-nums">{fmtM(maintSubtotal * 0.1)}</span></div>
                        <div className="flex justify-between rounded-lg bg-slate-800 px-2.5 py-1.5 text-white font-semibold"><span>TOTAL</span><span className="tabular-nums">{fmtM(maintSubtotal * 1.1)}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* End User T&C selector */}
                  <div className="px-6 pt-5">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                        End User <span className="normal-case font-normal text-slate-400">— selects which T&amp;C document is appended</span>
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['CUSTOMER', 'DISTRIBUTOR', 'TENDER'] as const).map(type => (
                          <button key={type} type="button"
                            onClick={() => setMaintEndUser(prev => prev === type ? '' : type)}
                            className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition ${
                              maintEndUser === type
                                ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                            }`}>
                            <span className="material-symbols-outlined text-[18px]">
                              {type === 'CUSTOMER' ? 'person' : type === 'DISTRIBUTOR' ? 'local_shipping' : 'gavel'}
                            </span>
                            {type.charAt(0) + type.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                      {!maintEndUser && (
                        <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">info</span>
                          No T&amp;C will be appended if no end user is selected.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quote Disclaimer */}
                  <div className="px-6 pt-4 pb-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Quote Disclaimer</span>
                        {!editingMaintTerms ? (
                          <button type="button" onClick={() => { setTempMaintTerms(maintTerms || DEFAULT_MAINT_TERMS); setEditingMaintTerms(true) }}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition">
                            <span className="material-symbols-outlined text-[14px]">edit</span>Edit
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => { setMaintTerms(tempMaintTerms); setEditingMaintTerms(false) }}
                              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 transition">
                              <span className="material-symbols-outlined text-[13px]">check</span>Save
                            </button>
                            <button type="button" onClick={() => setEditingMaintTerms(false)}
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition">
                              Cancel
                            </button>
                            {maintTerms && (
                              <button type="button" onClick={() => { setMaintTerms(''); setEditingMaintTerms(false) }}
                                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-50 transition">
                                Reset
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {editingMaintTerms ? (
                        <textarea rows={4} value={tempMaintTerms} onChange={e => setTempMaintTerms(e.target.value)}
                          className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-[12px] text-slate-700 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 resize-y" />
                      ) : (
                        <p className="text-[12px] text-slate-500 leading-relaxed whitespace-pre-wrap">
                          {maintTerms || DEFAULT_MAINT_TERMS}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Generate button */}
                  <div className="px-6 pt-3 pb-6">
                  <button type="button"
                    disabled={generating || (!custCanBeBlank && !customerFilled)}
                    onClick={handleGenerateMaintenance}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title={!custCanBeBlank && !customerFilled ? 'Customer name and address are required' : undefined}>
                    {generating
                      ? <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Generating…</>
                      : <><span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>{showPreview ? 'Regenerate Quote' : 'Generate Quote'}</>
                    }
                  </button>
                  </div>
                </div>
              )
          })()}

          {/* ── Parts quote form ── */}
          {isParts && (() => {
              const partsSubtotal = partsItems.reduce((s, it) => s + it.qty * it.unitPrice, 0)
              const fmtP = (n: number) => n === 0 ? '$0.00' : `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              return (
                <div className="space-y-0 divide-y divide-slate-100">

                  {/* ── Sender / Company Info ── */}
                  <div className="px-6 pt-5 pb-5">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="border-b border-slate-100 px-5 py-3 bg-slate-50">
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">From (Sender Details)</span>
                      </div>
                      <div className="px-5 py-4">
                        <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                          {([
                            ['Company',       partsSenderName,    setPartsSenderName,    'NBE AUSTRALIA'],
                            ['Address',       partsSenderAddress, setPartsSenderAddress, '22A Humeside Dr, Campbellfield VIC 3061'],
                            ['Company Email', partsSenderEmail,   setPartsSenderEmail,   'accountsreceivable@nbeaustralia.com.au'],
                            ['Contact Name',  partsContactName,   setPartsContactName,   'Andrew Newton'],
                            ['Contact Phone', partsContactPhone,  setPartsContactPhone,  '(04) 2705 5556'],
                            ['Contact Email', partsContactEmail,  setPartsContactEmail,  'anewton@nbeaustralia.com.au'],
                          ] as [string, string, (v: string) => void, string][]).map(([label, value, setter, placeholder]) => (
                            <div key={label}>
                              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</label>
                              <input type="text" value={value} placeholder={placeholder} onChange={e => setter(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Customer Details ── */}
                  <div className="px-6 pb-0 pt-5">
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Customer Details</span>
                        <span className="text-red-400 text-sm font-bold">*</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={custCanBeBlank} onChange={e => setCustCanBeBlank(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-xs text-slate-500">Customer details can be blank</span>
                      </label>
                    </div>
                    {custCanBeBlank && (
                      <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                        <span className="material-symbols-outlined text-[14px] text-amber-500">warning</span>
                        <p className="text-xs text-amber-700">Quote will be generated without customer details. This is for internal/draft use only.</p>
                      </div>
                    )}
                    <div className="px-5 py-4">
                      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                        {([
                          ['Customer',  custName,     setCustName,     'Company or customer name', true],
                          ['Attention', custAttn,     setCustAttn,     'Contact person',            false],
                          ['Address',   custAddress,  setCustAddress,  'Street address',            true],
                          ['Postcode',  custPostcode, setCustPostcode, '3000',                      false],
                          ['Phone',     custPhone,    setCustPhone,    '(03) 9000 0000',            false],
                          ['Email',     custEmail,    setCustEmail,    'contact@company.com.au',    false],
                        ] as [string, string, (v: string) => void, string, boolean][]).map(([label, value, setter, placeholder, required]) => (
                          <div key={label}>
                            <label className={`mb-1.5 block text-xs font-semibold uppercase tracking-widest ${!custCanBeBlank && required && !value ? 'text-red-400' : 'text-slate-400'}`}>
                              {label}{required && !custCanBeBlank && <span className="ml-0.5 text-red-400">*</span>}
                            </label>
                            <input type="text" value={value} placeholder={placeholder} onChange={e => setter(e.target.value)}
                              className={`w-full rounded-xl border py-2.5 px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500/20 ${!custCanBeBlank && required && !value ? 'border-red-300 focus:border-red-400 bg-white' : 'border-slate-200 bg-white focus:border-indigo-400'}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  </div>

                  {/* Line items table — full-width */}
                  <div className="border-t border-slate-100 rounded-b-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-900 text-white text-left text-[10px] font-semibold uppercase tracking-wider">
                          <tr className="border-b border-slate-700">
                            <th rowSpan={2} className="px-3 py-2.5 w-8 align-middle">#</th>
                            <th rowSpan={2} className="px-2 py-2.5 w-36 align-middle">Item</th>
                            <th colSpan={3} className="px-2 pt-2.5 pb-0 text-center border-b border-slate-700">Description</th>
                            <th rowSpan={2} className="px-2 py-2.5 w-12 text-center align-middle">Qty</th>
                            <th rowSpan={2} className="px-2 py-2.5 w-24 text-right align-middle">Unit Price</th>
                            <th rowSpan={2} className="px-2 py-2.5 w-24 text-right align-middle">Total</th>
                            <th rowSpan={2} className="px-2 py-2.5 w-8 align-middle">
                              <button type="button" onClick={() => setPartsItems(prev => [...prev, emptyPartsItem()])}
                                title="Add row"
                                className="flex items-center gap-0.5 rounded-md bg-white/15 hover:bg-white/30 px-1.5 py-1 text-[10px] font-semibold text-white transition mx-auto">
                                <span className="material-symbols-outlined text-[13px]">add</span>
                              </button>
                            </th>
                          </tr>
                          <tr className="border-b border-slate-600 text-[9px] text-slate-300 font-medium">
                            <th className="px-2 pb-1.5" />
                            <th className="px-2 pb-1.5 w-20 text-center">Width</th>
                            <th className="px-2 pb-1.5 w-20 text-center">Height</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partsItems.map((it, i) => (
                            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/60">
                              <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
                              <td className="px-2 py-1.5">
                                <input type="text" value={it.item} onChange={e => updatePartsItem(i, 'item', e.target.value)}
                                  placeholder="Item name" className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="text" value={it.description} onChange={e => updatePartsItem(i, 'description', e.target.value)}
                                  placeholder="Description" className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="text" value={it.width} onChange={e => updatePartsItem(i, 'width', e.target.value)}
                                  placeholder="—" className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-center focus:border-indigo-400 focus:outline-none" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="text" value={it.height} onChange={e => updatePartsItem(i, 'height', e.target.value)}
                                  placeholder="—" className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-center focus:border-indigo-400 focus:outline-none" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" min={1} value={it.qty} onChange={e => updatePartsItem(i, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-center focus:border-indigo-400 focus:outline-none" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input type="number" min={0} step={0.01} value={it.unitPrice || ''} onChange={e => updatePartsItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  placeholder="0.00" className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-right focus:border-indigo-400 focus:outline-none" />
                              </td>
                              <td className="px-2 py-1.5 text-right font-medium text-slate-700 tabular-nums">
                                {it.qty * it.unitPrice > 0 ? fmtP(it.qty * it.unitPrice) : '—'}
                              </td>
                              <td className="px-1 py-1.5">
                                <button type="button" onClick={() => setPartsItems(prev => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i))}
                                  className="rounded p-0.5 text-slate-300 hover:bg-red-50 hover:text-red-500">
                                  <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Totals */}
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex justify-end">
                      <div className="w-48 space-y-1 text-xs">
                        <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="tabular-nums font-medium">{fmtP(partsSubtotal)}</span></div>
                        <div className="flex justify-between text-slate-500"><span>GST (10%)</span><span className="tabular-nums">{fmtP(partsSubtotal * 0.1)}</span></div>
                        <div className="flex justify-between rounded-lg bg-slate-800 px-2.5 py-1.5 text-white font-semibold"><span>TOTAL</span><span className="tabular-nums">{fmtP(partsSubtotal * 1.1)}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* End User T&C selector */}
                  <div className="px-6 pt-5">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                        End User <span className="normal-case font-normal text-slate-400">— selects which T&amp;C document is appended</span>
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['CUSTOMER', 'DISTRIBUTOR', 'TENDER'] as const).map(type => (
                          <button key={type} type="button"
                            onClick={() => setPartsEndUser(prev => prev === type ? '' : type)}
                            className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition ${
                              partsEndUser === type
                                ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                            }`}>
                            <span className="material-symbols-outlined text-[18px]">
                              {type === 'CUSTOMER' ? 'person' : type === 'DISTRIBUTOR' ? 'local_shipping' : 'gavel'}
                            </span>
                            {type.charAt(0) + type.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                      {!partsEndUser && (
                        <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">info</span>
                          No T&amp;C will be appended if no end user is selected.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quote Disclaimer */}
                  <div className="px-6 pt-4 pb-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Quote Disclaimer</span>
                        {!editingPartsTerms ? (
                          <button type="button" onClick={() => { setTempPartsTerms(partsTerms || DEFAULT_PARTS_TERMS); setEditingPartsTerms(true) }}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition">
                            <span className="material-symbols-outlined text-[14px]">edit</span>Edit
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => { setPartsTerms(tempPartsTerms); setEditingPartsTerms(false) }}
                              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 transition">
                              <span className="material-symbols-outlined text-[13px]">check</span>Save
                            </button>
                            <button type="button" onClick={() => setEditingPartsTerms(false)}
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition">
                              Cancel
                            </button>
                            {partsTerms && (
                              <button type="button" onClick={() => { setPartsTerms(''); setEditingPartsTerms(false) }}
                                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-50 transition">
                                Reset
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {editingPartsTerms ? (
                        <textarea rows={4} value={tempPartsTerms} onChange={e => setTempPartsTerms(e.target.value)}
                          className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-[12px] text-slate-700 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 resize-y" />
                      ) : (
                        <p className="text-[12px] text-slate-500 leading-relaxed whitespace-pre-wrap">
                          {partsTerms || DEFAULT_PARTS_TERMS}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Generate button */}
                  <div className="px-6 pt-3 pb-6">
                  <button type="button"
                    disabled={generating || (!custCanBeBlank && !customerFilled)}
                    onClick={handleGenerateParts}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title={!custCanBeBlank && !customerFilled ? 'Customer name and address are required' : undefined}>
                    {generating
                      ? <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Generating…</>
                      : <><span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>{showPreview ? 'Regenerate Quote' : 'Generate Quote'}</>
                    }
                  </button>
                  </div>
                </div>
              )
          })()}

          {/* ── General quote form ── */}
          {isGeneral && (() => {
              const fmtG = (n: number) => n === 0 ? '$0.00' : `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              const rowTotal = (it: GeneralItem) => {
                const base = it.overridePrice !== '' ? (parseFloat(it.overridePrice) || 0) : it.qty * it.unitPrice
                const disc = parseFloat(it.discount) || 0
                return base * (1 - disc / 100)
              }
              const generalSubtotal = generalItems.reduce((s, it) => s + rowTotal(it), 0)
              const discPct = parseFloat(generalDiscountPct) || 0
              const generalAfterDiscount = generalSubtotal * (1 - discPct / 100)
              return (
                <div className="space-y-0 divide-y divide-slate-100">

                  {/* ── Sender / Company Info ── */}
                  <div className="px-6 pt-5 pb-5">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="border-b border-slate-100 px-5 py-3 bg-slate-50">
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">From (Sender Details)</span>
                      </div>
                      <div className="px-5 py-4">
                        <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                          {([
                            ['Company',       generalSenderName,    setGeneralSenderName,    'NBE AUSTRALIA'],
                            ['Address',       generalSenderAddress, setGeneralSenderAddress, '22A Humeside Dr, Campbellfield VIC 3061'],
                            ['Company Email', generalSenderEmail,   setGeneralSenderEmail,   'accountsreceivable@nbeaustralia.com.au'],
                            ['Contact Name',  generalContactName,   setGeneralContactName,   'Andrew Newton'],
                            ['Contact Phone', generalContactPhone,  setGeneralContactPhone,  '(04) 2705 5556'],
                            ['Contact Email', generalContactEmail,  setGeneralContactEmail,  'anewton@nbeaustralia.com.au'],
                          ] as [string, string, (v: string) => void, string][]).map(([label, value, setter, placeholder]) => (
                            <div key={label}>
                              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</label>
                              <input type="text" value={value} placeholder={placeholder} onChange={e => setter(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Customer Details ── */}
                  <div className="px-6 pb-0 pt-5">
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Customer Details</span>
                        <span className="text-red-400 text-sm font-bold">*</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={custCanBeBlank} onChange={e => setCustCanBeBlank(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-xs text-slate-500">Customer details can be blank</span>
                      </label>
                    </div>
                    {custCanBeBlank && (
                      <div className="mx-5 mt-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                        <span className="material-symbols-outlined text-[14px] text-amber-500">warning</span>
                        <p className="text-xs text-amber-700">Quote will be generated without customer details. This is for internal/draft use only.</p>
                      </div>
                    )}
                    <div className="px-5 py-4">
                      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                        {([
                          ['Customer',  custName,     setCustName,     'Company or customer name', true],
                          ['Attention', custAttn,     setCustAttn,     'Contact person',            false],
                          ['Address',   custAddress,  setCustAddress,  'Street address',            true],
                          ['Postcode',  custPostcode, setCustPostcode, '3000',                      false],
                          ['Phone',     custPhone,    setCustPhone,    '(03) 9000 0000',            false],
                          ['Email',     custEmail,    setCustEmail,    'contact@company.com.au',    false],
                        ] as [string, string, (v: string) => void, string, boolean][]).map(([label, value, setter, placeholder, required]) => (
                          <div key={label}>
                            <label className={`mb-1.5 block text-xs font-semibold uppercase tracking-widest ${!custCanBeBlank && required && !value ? 'text-red-400' : 'text-slate-400'}`}>
                              {label}{required && !custCanBeBlank && <span className="ml-0.5 text-red-400">*</span>}
                            </label>
                            <input type="text" value={value} placeholder={placeholder} onChange={e => setter(e.target.value)}
                              className={`w-full rounded-xl border py-2.5 px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500/20 ${!custCanBeBlank && required && !value ? 'border-red-300 focus:border-red-400 bg-white' : 'border-slate-200 bg-white focus:border-indigo-400'}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  </div>

                  {/* ── Line Items ── */}
                  <div className="pt-4 pb-2">
                    {/* Column toggles — only real table columns */}
                    <div className="px-6 mb-3 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mr-1">Show columns:</span>
                      {([['width','Width'],['height','Height']] as [keyof typeof generalCols, string][]).map(([col, label]) => (
                        <button key={col} type="button" onClick={() => toggleGeneralCol(col)}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition ${generalCols[col] ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}`}>
                          <span className="material-symbols-outlined text-[12px]">{generalCols[col] ? 'check_circle' : 'add_circle'}</span>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white text-left text-[10px] font-semibold uppercase tracking-wider">
                            <th className="px-3 py-3 w-12 text-center">S.No</th>
                            <th className="px-3 py-3 w-32">Item</th>
                            <th className="px-3 py-3">Description</th>
                            {generalCols.width  && <th className="px-3 py-3 w-20 text-center">Width</th>}
                            {generalCols.height && <th className="px-3 py-3 w-20 text-center">Height</th>}
                            <th className="px-3 py-3 w-16 text-center">Qty</th>
                            <th className="px-3 py-3 w-28 text-right">Unit Price</th>
                            <th className="px-3 py-3 w-36 text-right">Total</th>
                            <th className="px-3 py-3 w-28 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generalItems.map((it, i) => {
                            const rt = rowTotal(it)
                            return (
                              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/60 align-top">
                                {/* S.No — editable */}
                                <td className="px-2 py-2.5 text-center">
                                  <input type="text" value={it.sno} onChange={e => updateGeneralItem(i, 'sno', e.target.value)}
                                    className="w-10 rounded border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-slate-500 text-center outline-none hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-500/20 transition" />
                                </td>
                                {/* Item */}
                                <td className="px-2 py-2.5">
                                  <input type="text" value={it.item} onChange={e => updateGeneralItem(i, 'item', e.target.value)}
                                    placeholder="Item name"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                </td>
                                {/* Description (resizable textarea) */}
                                <td className="px-2 py-2.5">
                                  <textarea value={it.description} onChange={e => updateGeneralItem(i, 'description', e.target.value)}
                                    placeholder="Description"
                                    rows={2}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition resize-y min-h-[2.5rem]" />
                                </td>
                                {/* Width */}
                                {generalCols.width && (
                                  <td className="px-2 py-2.5">
                                    <input type="text" value={it.width} onChange={e => updateGeneralItem(i, 'width', e.target.value)}
                                      placeholder="—"
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-center text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                  </td>
                                )}
                                {/* Height */}
                                {generalCols.height && (
                                  <td className="px-2 py-2.5">
                                    <input type="text" value={it.height} onChange={e => updateGeneralItem(i, 'height', e.target.value)}
                                      placeholder="—"
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-center text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                  </td>
                                )}
                                {/* Qty */}
                                <td className="px-2 py-2.5">
                                  <input type="number" min={1} value={it.qty} onChange={e => updateGeneralItem(i, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-center text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                </td>
                                {/* Unit Price */}
                                <td className="px-2 py-2.5">
                                  <input type="number" min={0} step={0.01} value={it.unitPrice || ''} onChange={e => updateGeneralItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-right text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                </td>
                                {/* Total + Override inline */}
                                <td className="px-2 py-2.5 text-right">
                                  <p className={`font-semibold tabular-nums ${rt > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                                    {rt > 0 ? fmtG(rt) : '$0.00'}
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Auto: qty × unit</p>
                                  <input type="number" min={0} step={0.01} value={it.overridePrice} onChange={e => updateGeneralItem(i, 'overridePrice', e.target.value)}
                                    placeholder="Override $"
                                    className={`mt-1 w-full rounded-lg border px-2 py-1 text-xs text-right outline-none focus:ring-1 transition ${it.overridePrice ? 'border-amber-400 bg-amber-50 text-amber-800 focus:border-amber-400 focus:ring-amber-500/20' : 'border-slate-200 bg-slate-50 text-slate-600 focus:border-indigo-400 focus:ring-indigo-500/20'}`} />
                                  {it.overridePrice && <p className="text-[10px] text-amber-500 mt-0.5">overridden</p>}
                                </td>
                                {/* Action: Remove + Add notes */}
                                <td className="px-2 py-2.5">
                                  <div className="flex flex-col gap-1.5">
                                    <button type="button" onClick={() => setGeneralItems(prev => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i))}
                                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition">
                                      Remove
                                    </button>
                                    <button type="button" onClick={() => setGeneralNotesOpen(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })}
                                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition">
                                      {generalNotesOpen.has(i) ? 'Hide notes' : (it.notes ? 'Edit notes' : 'Add notes')}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Notes expansion rows (below table, per item) */}
                    {generalNotesOpen.size > 0 && (
                      <div className="border-t border-slate-100 px-6 pt-3 space-y-2">
                        {generalItems.map((it, i) => generalNotesOpen.has(i) ? (
                          <div key={i} className="flex items-start gap-3">
                            <span className="text-[10px] font-semibold text-slate-400 w-10 text-center pt-1.5 shrink-0">#{it.sno}</span>
                            <span className="material-symbols-outlined text-[14px] text-slate-400 mt-1.5 shrink-0">sticky_note_2</span>
                            <textarea value={it.notes} onChange={e => updateGeneralItem(i, 'notes', e.target.value)}
                              placeholder="Add notes for this line item…"
                              rows={2}
                              className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 outline-none focus:border-indigo-300 focus:bg-white focus:ring-1 focus:ring-indigo-500/20 transition resize-y" />
                            <button type="button" onClick={() => { updateGeneralItem(i, 'notes', ''); setGeneralNotesOpen(prev => { const s = new Set(prev); s.delete(i); return s }) }}
                              className="mt-1 text-slate-300 hover:text-red-400 transition shrink-0">
                              <span className="material-symbols-outlined text-[15px]">close</span>
                            </button>
                          </div>
                        ) : null)}
                      </div>
                    )}

                    {/* Add Row */}
                    <div className="px-6 pt-3">
                      <button type="button" onClick={() => setGeneralItems(prev => [...prev, emptyGeneralItem(prev.length)])}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/40 transition">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Add Row
                      </button>
                    </div>

                    {/* Discount section — collapsible */}
                    <div className="px-6 pt-4">
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <button type="button" onClick={() => setShowGeneralDiscount(p => !p)}
                          className="flex w-full items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-slate-500">discount</span>
                            <span className="text-sm font-semibold text-slate-700">Discount</span>
                            {discPct > 0 && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">{discPct}% off</span>}
                          </div>
                          <span className="material-symbols-outlined text-[16px] text-slate-400">{showGeneralDiscount ? 'expand_less' : 'expand_more'}</span>
                        </button>
                        {showGeneralDiscount && (
                          <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-4 bg-white">
                            <label className="text-sm text-slate-600">Discount (%)</label>
                            <div className="relative w-32">
                              <input type="number" min={0} max={100} step={1} value={generalDiscountPct} onChange={e => setGeneralDiscountPct(e.target.value)}
                                placeholder="0"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">%</span>
                            </div>
                            {discPct > 0 && (
                              <span className="text-sm text-green-600 font-medium">
                                Saving {fmtG(generalSubtotal * discPct / 100)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="px-6 pt-4 flex justify-end">
                      <div className="w-72 rounded-xl overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                          <span className="text-sm text-slate-500">Subtotal</span>
                          <span className="tabular-nums font-semibold text-slate-800">{fmtG(generalSubtotal)}</span>
                        </div>
                        {discPct > 0 && (
                          <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 border-b border-green-100">
                            <span className="text-sm text-green-700">Discount ({discPct}%)</span>
                            <span className="tabular-nums text-green-700 font-medium">−{fmtG(generalSubtotal * discPct / 100)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                          <span className="text-sm text-slate-500">GST (10%)</span>
                          <span className="tabular-nums text-slate-600">{fmtG(generalAfterDiscount * 0.1)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 bg-indigo-600">
                          <span className="text-sm font-bold text-indigo-100 uppercase tracking-wide">Total inc. GST</span>
                          <span className="tabular-nums font-bold text-xl text-white">{fmtG(generalAfterDiscount * 1.1)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* End User T&C selector */}
                  <div className="px-6 pt-5">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                        End User <span className="normal-case font-normal text-slate-400">— selects which T&amp;C document is appended</span>
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {(['CUSTOMER', 'DISTRIBUTOR', 'TENDER'] as const).map(type => (
                          <button key={type} type="button"
                            onClick={() => setGeneralEndUser(prev => prev === type ? '' : type)}
                            className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition ${
                              generalEndUser === type
                                ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                            }`}>
                            <span className="material-symbols-outlined text-[18px]">
                              {type === 'CUSTOMER' ? 'person' : type === 'DISTRIBUTOR' ? 'local_shipping' : 'gavel'}
                            </span>
                            {type.charAt(0) + type.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                      {!generalEndUser && (
                        <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">info</span>
                          No T&amp;C will be appended if no end user is selected.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quote Disclaimer */}
                  <div className="px-6 pt-4 pb-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Quote Disclaimer</span>
                        {!editingGeneralTerms ? (
                          <button type="button" onClick={() => { setTempGeneralTerms(generalTerms || DEFAULT_GENERAL_TERMS); setEditingGeneralTerms(true) }}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition">
                            <span className="material-symbols-outlined text-[14px]">edit</span>Edit
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => { setGeneralTerms(tempGeneralTerms); setEditingGeneralTerms(false) }}
                              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 transition">
                              <span className="material-symbols-outlined text-[13px]">check</span>Save
                            </button>
                            <button type="button" onClick={() => setEditingGeneralTerms(false)}
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition">
                              Cancel
                            </button>
                            {generalTerms && (
                              <button type="button" onClick={() => { setGeneralTerms(''); setEditingGeneralTerms(false) }}
                                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-red-400 hover:bg-red-50 transition">
                                Reset
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {editingGeneralTerms ? (
                        <textarea rows={4} value={tempGeneralTerms} onChange={e => setTempGeneralTerms(e.target.value)}
                          className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-[12px] text-slate-700 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 resize-y" />
                      ) : (
                        <p className="text-[12px] text-slate-500 leading-relaxed whitespace-pre-wrap">
                          {generalTerms || DEFAULT_GENERAL_TERMS}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Generate button */}
                  <div className="px-6 pt-3 pb-6">
                  <button type="button"
                    disabled={generating || (!custCanBeBlank && !customerFilled)}
                    onClick={handleGenerateGeneral}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title={!custCanBeBlank && !customerFilled ? 'Customer name and address are required' : undefined}>
                    {generating
                      ? <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Generating…</>
                      : <><span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>{showPreview ? 'Regenerate Quote' : 'Generate Quote'}</>
                    }
                  </button>
                  </div>
                </div>
              )
          })()}

          {/* ── PVC Flex System ─────────────────────────────────────────── */}
          {isPvcFlex && (() => {
            // Inline price preview calculator (mirrors pvcNewQuoteCalculator.ts)
            const pvcCalcPreview = (w: number, h: number) => {
              if (!w || !h) return null
              const PVC_COST: Record<string, number> = { '100|2|Ambient':0.6552,'100|2|Freezer':0.6908,'150|2|Ambient':0.9828,'150|2|Freezer':1.0356,'200|2|Ambient':1.3104,'200|2|Freezer':1.3808,'200|3|Ambient':1.9656,'200|3|Freezer':2.0716,'300|3|Ambient':2.9484,'300|3|Freezer':3.1072,'400|3|Ambient':3.9312,'400|3|Freezer':4.142932 }
              const HANGER: Record<string, number> = { '150|Galvanised':1.1158,'150|Stainless Steel':1.5358,'200|Galvanised':1.3347,'200|Stainless Steel':1.87475,'300|Galvanised':2.51265,'300|Stainless Steel':2.73265 }
              const HEADRAIL: Record<string, number> = { 'Galvanised':7.4267,'Stainless Steel':16.08 }
              const SLIDING: Record<string, number> = { 'NA':0,'Single':372.63,'Dual':846.82 }
              const pitch = pvcStripW === 100 ? 150 : pvcStripW - 50
              const nStrips = Math.ceil((w + 50) / pitch)
              const cutLen = h + 40
              const pvcLen = nStrips * cutLen / 1000
              const coverage = (nStrips * pitch + 50) / 1000
              const inc = Math.ceil(coverage / 3)
              const pvcCost = pvcSupply !== 'Headrail Only' ? pvcLen * 1.05 * (PVC_COST[`${pvcStripW}|${pvcThick}|${pvcGrade}`] ?? 0) : 0
              const hW = pvcStripW === 100 ? 150 : pvcStripW === 400 ? 300 : pvcStripW
              const hangerCost = pvcSupply !== 'Headrail Only' ? nStrips * (HANGER[`${hW}|${pvcHanger}`] ?? 0) : 0
              const headrailCost = pvcSupply !== 'Strip Curtain Only' ? coverage * 1.20 * (HEADRAIL[pvcHanger] ?? 0) : 0
              const raisedCost = pvcRaisedHR ? (w >= 4500 ? 305.84 : 229.84) : 0
              const slidingCost = SLIDING[pvcSliding] ?? 0
              const pkg = inc * 6
              let labour = 15 / 60
              if (pvcSupply !== 'Headrail Only') labour += nStrips * 3 / 60
              if (pvcSupply !== 'Strip Curtain Only') labour += inc * 12.5 / 60
              if (pvcSliding !== 'NA') labour += inc * 12.5 / 60
              if (pvcRaisedHR) labour += w >= 4500 ? 6 : 3.5
              const disc = parseFloat(pvcDiscountPct) || 0
              const matSell = (pvcCost + hangerCost + headrailCost) * 3
              const nonMatSell = (raisedCost + slidingCost + pkg + labour * 75) * 3
              const unitPrice = matSell * (1 - disc / 100) + nonMatSell
              return { unitPrice: Math.round(unitPrice * 100) / 100, nStrips, coverage: Math.round(coverage * 100) / 100 }
            }
            const pvcCalcSaved = (d: PvcFlexDoorItem) => {
              const w = parseFloat(d.openingW) || 0; const h = parseFloat(d.openingH) || 0
              if (!w || !h) return null
              const PVC_COST: Record<string, number> = { '100|2|Ambient':0.6552,'100|2|Freezer':0.6908,'150|2|Ambient':0.9828,'150|2|Freezer':1.0356,'200|2|Ambient':1.3104,'200|2|Freezer':1.3808,'200|3|Ambient':1.9656,'200|3|Freezer':2.0716,'300|3|Ambient':2.9484,'300|3|Freezer':3.1072,'400|3|Ambient':3.9312,'400|3|Freezer':4.142932 }
              const HANGER: Record<string, number> = { '150|Galvanised':1.1158,'150|Stainless Steel':1.5358,'200|Galvanised':1.3347,'200|Stainless Steel':1.87475,'300|Galvanised':2.51265,'300|Stainless Steel':2.73265 }
              const HEADRAIL: Record<string, number> = { 'Galvanised':7.4267,'Stainless Steel':16.08 }
              const SLIDING: Record<string, number> = { 'NA':0,'Single':372.63,'Dual':846.82 }
              const pitch = d.stripWidth === 100 ? 150 : d.stripWidth - 50
              const nStrips = Math.ceil((w + 50) / pitch)
              const coverage = (nStrips * pitch + 50) / 1000
              const inc = Math.ceil(coverage / 3)
              const pvcCost = d.supplyType !== 'Headrail Only' ? (nStrips * (h + 40) / 1000) * 1.05 * (PVC_COST[`${d.stripWidth}|${d.thickness}|${d.grade}`] ?? 0) : 0
              const hW = d.stripWidth === 100 ? 150 : d.stripWidth === 400 ? 300 : d.stripWidth
              const hangerCost = d.supplyType !== 'Headrail Only' ? nStrips * (HANGER[`${hW}|${d.hanger}`] ?? 0) : 0
              const headrailCost = d.supplyType !== 'Strip Curtain Only' ? coverage * 1.20 * (HEADRAIL[d.hanger] ?? 0) : 0
              const raisedCost = d.raisedHeadrail ? (w >= 4500 ? 305.84 : 229.84) : 0
              const slidingCost = SLIDING[d.sliding] ?? 0; const pkg = inc * 6
              let labour = 15 / 60
              if (d.supplyType !== 'Headrail Only') labour += nStrips * 3 / 60
              if (d.supplyType !== 'Strip Curtain Only') labour += inc * 12.5 / 60
              if (d.sliding !== 'NA') labour += inc * 12.5 / 60
              if (d.raisedHeadrail) labour += w >= 4500 ? 6 : 3.5
              const disc = parseFloat(pvcDiscountPct) || 0
              const matSell = (pvcCost + hangerCost + headrailCost) * 3
              const nonMatSell = (raisedCost + slidingCost + pkg + labour * 75) * 3
              const unitPrice = matSell * (1 - disc / 100) + nonMatSell
              return Math.round(unitPrice * 100) / 100
            }
            const pvcDiscN = parseFloat(pvcDiscountPct) || 0
            const pvcDelivN = parseFloat(pvcDelivery) || 0
            const pvcInstN = parseFloat(pvcInstallation) || 0
            const activeWn = parseFloat(pvcW) || 0; const activeHn = parseFloat(pvcH) || 0
            const activePreview = pvcCalcPreview(activeWn, activeHn)
            const savedDoorsSubtotal = savedPvcDoors.reduce((s, d) => { const p = pvcCalcSaved(d); return s + (p ? p * d.qty : 0) }, 0)
            const activeSubtotal = activePreview && activeWn && activeHn ? activePreview.unitPrice * (parseInt(pvcQtyStr) || 1) : 0
            const pvcGrandTotal = savedDoorsSubtotal + activeSubtotal + pvcDelivN + pvcInstN
            const hasAnyDoor = savedPvcDoors.length > 0 || (!!pvcW && !!pvcH)
            const canGeneratePvc = !generating && hasAnyDoor && (custCanBeBlank || customerFilled)
            return (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

                {/* ── Sender Details ── */}
                <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Sender Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={LABEL_CLS}>Company Name</label><input type="text" value={pvcSenderName} onChange={e => setPvcSenderName(e.target.value)} className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Address</label><input type="text" value={pvcSenderAddress} onChange={e => setPvcSenderAddress(e.target.value)} className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Email</label><input type="text" value={pvcSenderEmail} onChange={e => setPvcSenderEmail(e.target.value)} className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Contact Name</label><input type="text" value={pvcContactName} onChange={e => setPvcContactName(e.target.value)} className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Contact Phone</label><input type="text" value={pvcContactPhone} onChange={e => setPvcContactPhone(e.target.value)} className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Contact Email</label><input type="text" value={pvcContactEmail} onChange={e => setPvcContactEmail(e.target.value)} className={INPUT_CLS} /></div>
                  </div>
                </div>

                {/* ── Customer Details ── */}
                <div className="px-6 py-4 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Customer Details</h3>
                    <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                      <input type="checkbox" checked={custCanBeBlank} onChange={e => setCustCanBeBlank(e.target.checked)} className="rounded" />
                      Can be blank
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className={custCanBeBlank ? LABEL_CLS : LABEL_REQ_CLS}>Customer / Company Name</label><input type="text" value={custName} onChange={e => setCustName(e.target.value)} className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Attention (Contact Person)</label><input type="text" value={custAttn} onChange={e => setCustAttn(e.target.value)} className={INPUT_CLS} /></div>
                    <div><label className={custCanBeBlank ? LABEL_CLS : LABEL_REQ_CLS}>Site / Postal Address</label><input type="text" value={custAddress} onChange={e => setCustAddress(e.target.value)} className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Postcode</label><input type="text" value={custPostcode} onChange={e => setCustPostcode(e.target.value)} className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Phone</label><input type="text" value={custPhone} onChange={e => setCustPhone(e.target.value)} className={INPUT_CLS} /></div>
                    <div><label className={LABEL_CLS}>Email</label><input type="text" value={custEmail} onChange={e => setCustEmail(e.target.value)} className={INPUT_CLS} /></div>
                  </div>
                </div>

                {/* ── Saved door chips ── */}
                {savedPvcDoors.length > 0 && (
                  <div className="px-6 pt-4 pb-2 flex flex-wrap gap-2 items-center border-b border-slate-100">
                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Doors in this quote:</span>
                    {savedPvcDoors.map((d, i) => {
                      const price = pvcCalcSaved(d)
                      return (
                        <div key={d.id} className="flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 pl-3 pr-2 py-1">
                          <span className="text-xs font-semibold text-teal-700">Door {i + 1}</span>
                          <span className="text-[10px] text-teal-600">{d.openingW}×{d.openingH}mm · {d.stripWidth}mm</span>
                          {price && <span className="text-[10px] text-teal-500 font-mono">${price.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>}
                          <button type="button" onClick={() => editSavedPvcDoor(d.id)} title="Edit" className="ml-0.5 text-teal-400 hover:text-teal-700 transition">
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                          <button type="button" onClick={() => removeSavedPvcDoor(d.id)} title="Remove" className="text-teal-300 hover:text-red-500 transition">
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ── Active door form (rapid-door style) ── */}
                <div className="px-6 py-5 border-b border-slate-100 space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {savedPvcDoors.length > 0 ? `Door ${savedPvcDoors.length + 1} Specification` : 'Door Specification'}
                    </h3>
                    <span className="text-[11px] text-slate-400">Price auto-calculated from dimensions &amp; specs</span>
                  </div>

                  {/* Opening dimensions + Qty */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={LABEL_REQ_CLS}>Opening Width <span className="normal-case font-normal after:content-none">(mm)</span></label>
                      <input type="number" min={0} placeholder="e.g. 2000" value={pvcW} onChange={e => setPvcW(e.target.value)} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_REQ_CLS}>Opening Height <span className="normal-case font-normal after:content-none">(mm)</span></label>
                      <input type="number" min={0} placeholder="e.g. 2500" value={pvcH} onChange={e => setPvcH(e.target.value)} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Qty</label>
                      <input type="number" min={1} value={pvcQtyStr} onChange={e => setPvcQtyStr(e.target.value)} className={INPUT_CLS} />
                    </div>
                  </div>

                  {/* Strip Width + Thickness */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL_REQ_CLS}>Strip Width</label>
                      <SelectWrapper>
                        <select value={pvcStripW} onChange={e => { const sw = Number(e.target.value); setPvcStripW(sw); if (sw >= 300) setPvcThick(3); else if (sw < 200) setPvcThick(2) }} className={SELECT_CLS}>
                          <option value={100}>100 mm</option>
                          <option value={150}>150 mm</option>
                          <option value={200}>200 mm</option>
                          <option value={300}>300 mm</option>
                          <option value={400}>400 mm</option>
                        </select>
                      </SelectWrapper>
                    </div>
                    <div>
                      <label className={LABEL_REQ_CLS}>Thickness</label>
                      <SelectWrapper>
                        <select value={pvcThick} onChange={e => setPvcThick(Number(e.target.value))} className={SELECT_CLS}>
                          {(pvcStripW === 200 ? [2, 3] : pvcStripW >= 300 ? [3] : [2]).map(t => (
                            <option key={t} value={t}>{t} mm</option>
                          ))}
                        </select>
                      </SelectWrapper>
                    </div>
                  </div>

                  {/* Grade + Profile */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL_REQ_CLS}>Grade</label>
                      <SelectWrapper>
                        <select value={pvcGrade} onChange={e => { const g = e.target.value as 'Ambient'|'Freezer'; setPvcGrade(g); if (g === 'Freezer') setPvcProfile('Ribbed') }} className={SELECT_CLS}>
                          <option value="Ambient">Ambient</option>
                          <option value="Freezer">Freezer</option>
                        </select>
                      </SelectWrapper>
                    </div>
                    <div>
                      <label className={LABEL_REQ_CLS}>Profile</label>
                      <SelectWrapper>
                        <select value={pvcProfile} onChange={e => setPvcProfile(e.target.value as 'Ribbed'|'Flat'|'Coloured')} className={SELECT_CLS}>
                          <option value="Ribbed">Ribbed</option>
                          {pvcGrade !== 'Freezer' && <option value="Flat">Flat</option>}
                          {pvcGrade !== 'Freezer' && (pvcStripW === 100 || pvcStripW === 200) && <option value="Coloured">Coloured</option>}
                        </select>
                      </SelectWrapper>
                    </div>
                  </div>

                  {/* Hanger Material + Supply Type */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL_REQ_CLS}>Hanger &amp; Headrail Material</label>
                      <SelectWrapper>
                        <select value={pvcHanger} onChange={e => setPvcHanger(e.target.value as 'Galvanised'|'Stainless Steel')} className={SELECT_CLS}>
                          <option value="Galvanised">Galvanised</option>
                          <option value="Stainless Steel">Stainless Steel</option>
                        </select>
                      </SelectWrapper>
                    </div>
                    <div>
                      <label className={LABEL_REQ_CLS}>Supply Type</label>
                      <SelectWrapper>
                        <select value={pvcSupply} onChange={e => setPvcSupply(e.target.value as 'Complete Door'|'Strip Curtain Only'|'Headrail Only')} className={SELECT_CLS}>
                          <option value="Complete Door">Complete Door (strips + headrail)</option>
                          <option value="Strip Curtain Only">Strip Curtain Only</option>
                          <option value="Headrail Only">Headrail Only</option>
                        </select>
                      </SelectWrapper>
                    </div>
                  </div>

                  {/* Mounting Type + Sliding System */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL_CLS}>Mounting Type</label>
                      <SelectWrapper>
                        <select value={pvcMount} onChange={e => setPvcMount(e.target.value as 'Face Fixed'|'Soffit Fixed')} className={SELECT_CLS}>
                          <option value="Face Fixed">Face Fixed</option>
                          <option value="Soffit Fixed">Soffit Fixed</option>
                        </select>
                      </SelectWrapper>
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Sliding System</label>
                      <SelectWrapper>
                        <select value={pvcSliding} onChange={e => setPvcSliding(e.target.value as 'NA'|'Single'|'Dual')} className={SELECT_CLS}>
                          <option value="NA">None</option>
                          <option value="Single">Single Sliding</option>
                          <option value="Dual">Dual Sliding</option>
                        </select>
                      </SelectWrapper>
                    </div>
                  </div>

                  {/* Raised Headrail */}
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input type="checkbox" checked={pvcRaisedHR} onChange={e => setPvcRaisedHR(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-medium text-slate-700">Raised Headrail Structure</span>
                    <span className="text-xs text-slate-400">(auto-selects M or L based on opening width)</span>
                  </label>

                  {/* Calculated unit price badge */}
                  {activePreview && (
                    <div className="flex items-center gap-4 rounded-xl border border-teal-200 bg-teal-50 px-5 py-3">
                      <span className="material-symbols-outlined text-teal-500 text-xl">calculate</span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-teal-600">Calculated Unit Price</p>
                        <p className="text-2xl font-bold text-teal-700">${activePreview.unitPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="ml-auto text-right text-xs text-teal-500">
                        <p>{activePreview.nStrips} strips · {activePreview.coverage}m rail</p>
                        {pvcDiscN > 0 && <p className="font-medium">{pvcDiscN}% material discount applied</p>}
                      </div>
                    </div>
                  )}

                  {/* Lock & Add Another button — always visible */}
                  <button type="button" onClick={lockAndAddPvcDoor} disabled={!pvcW || !pvcH}
                    className="inline-flex items-center gap-2 rounded-xl border border-dashed border-teal-400 px-5 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    Lock Door {savedPvcDoors.length + 1} &amp; Add Another Door
                  </button>
                </div>

                {/* ── Quote Settings ── */}
                <div className="px-6 py-5 border-b border-slate-100 space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Quote Settings</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={LABEL_CLS}>
                        Discount % on Material
                        <Tip text="Applies to PVC strip + hanger + headrail costs only. Does NOT apply to installation, delivery, sliding systems, raised headrail, packaging or labour." />
                      </label>
                      <div className="relative">
                        <input type="number" min="0" max="100" step="1" value={pvcDiscountPct} onChange={e => setPvcDiscountPct(e.target.value)} placeholder="0" className={INPUT_CLS + ' pr-8'} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">%</span>
                      </div>
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Installation Fee ($)</label>
                      <input type="number" min="0" value={pvcInstallation} onChange={e => setPvcInstallation(e.target.value)} placeholder="0.00" className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Delivery Fee ($)</label>
                      <input type="number" min="0" value={pvcDelivery} onChange={e => setPvcDelivery(e.target.value)} placeholder="0.00" className={INPUT_CLS} />
                    </div>
                  </div>
                </div>

                {/* ── Quote Total ── */}
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Quote Total</h3>
                  <div className="rounded-xl overflow-hidden border border-slate-200">
                    <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                      <span className="text-sm text-slate-500">Subtotal (ex GST)</span>
                      <span className="font-semibold text-slate-800 font-mono">${pvcGrandTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                      <span className="text-sm text-slate-500">GST (10%)</span>
                      <span className="text-slate-600 font-mono">${(pvcGrandTotal * 0.1).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-4 bg-indigo-600">
                      <span className="text-sm font-bold text-indigo-100 uppercase tracking-wide">Total inc. GST</span>
                      <span className="text-2xl font-bold text-white font-mono">${(pvcGrandTotal * 1.1).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* ── T&C End User ── */}
                <div className="px-6 py-4 border-b border-slate-100">
                  <label className={LABEL_CLS}>Terms & Conditions — End User Type</label>
                  <div className="flex gap-3 flex-wrap">
                    {(['CUSTOMER','DISTRIBUTOR','TENDER'] as const).map(eu => (
                      <button key={eu} type="button"
                        onClick={() => setPvcEndUser(prev => prev === eu ? '' : eu)}
                        className={`rounded-xl border px-4 py-2 text-xs font-semibold transition ${pvcEndUser === eu ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                        {eu}
                      </button>
                    ))}
                    {!pvcEndUser && (
                      <p className="flex items-center gap-1 text-[11px] text-slate-400 self-center">
                        <span className="material-symbols-outlined text-[13px]">info</span>
                        No T&amp;C will be appended if no end user is selected.
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Quote Disclaimer ── */}
                <div className="px-6 pt-4 pb-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Quote Disclaimer</span>
                      {!editingPvcTerms ? (
                        <button type="button" onClick={() => { setTempPvcTerms(pvcTerms || DEFAULT_PVC_TERMS); setEditingPvcTerms(true) }}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition">
                          <span className="material-symbols-outlined text-[13px]">edit</span>Edit
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setPvcTerms(tempPvcTerms); setEditingPvcTerms(false) }}
                            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 transition">
                            <span className="material-symbols-outlined text-[13px]">check</span>Save
                          </button>
                          <button type="button" onClick={() => setEditingPvcTerms(false)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition">
                            <span className="material-symbols-outlined text-[13px]">close</span>Cancel
                          </button>
                        </div>
                      )}
                    </div>
                    {editingPvcTerms ? (
                      <textarea rows={4} value={tempPvcTerms} onChange={e => setTempPvcTerms(e.target.value)}
                        className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-[12px] text-slate-700 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 resize-y" />
                    ) : (
                      <p className="text-[12px] text-slate-500 leading-relaxed whitespace-pre-wrap">
                        {pvcTerms || DEFAULT_PVC_TERMS}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Generate button ── */}
                <div className="px-6 pt-3 pb-6">
                  <button type="button"
                    disabled={!canGeneratePvc}
                    onClick={handleGeneratePvcFlex}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title={!hasAnyDoor ? 'Enter at least one door opening size' : (!custCanBeBlank && !customerFilled) ? 'Customer name and address are required' : undefined}>
                    {generating
                      ? <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Generating…</>
                      : <><span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>{showPreview ? 'Regenerate Quote' : 'Generate Quote'}</>
                    }
                  </button>
                </div>
              </div>
            )
          })()}

          {/* ── Rapid door / other type fields — back inside px-6 padding ── */}
          {!isMaintenance && !isGeneral && !isParts && !isPvcFlex && (
          <div className="px-6 pb-6 space-y-5">

            {/* Door Type + Door Model — two columns */}
            {isRapidDoor && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_REQ_CLS}>Door Type<Tip text={tooltips['doorType']} /></label>
                  <SelectWrapper>
                    <select value={doorType} onChange={e => setDoorType(e.target.value)} className={SELECT_CLS}>
                      <option value="" disabled>— Select door type —</option>
                      {RAPID_DOOR_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                    </select>
                  </SelectWrapper>
                </div>
                <div>
                  <label className={LABEL_REQ_CLS}>Door Model<Tip text={tooltips['doorModel']} /></label>
                  <SelectWrapper>
                    <select value={doorModel} onChange={e => setDoorModel(e.target.value)} className={SELECT_CLS} disabled={!doorType}>
                      <option value="" disabled>— Select model —</option>
                      {getDoorModelOptions(doorType).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </SelectWrapper>
                </div>
              </div>
            )}

            {/* Fields shown once door type chosen */}
            {isRapidDoor && doorType && (
              <>

                {/* Opening dimensions + derived externals */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_REQ_CLS}>Clear Width <span className="normal-case font-normal after:content-none">(mm)</span><Tip text={tooltips['clearWidth']} /></label>
                    <input type="number" min={0} placeholder="e.g. 2500" value={openingW} onChange={e => setOpeningW(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_REQ_CLS}>Clear Height <span className="normal-case font-normal after:content-none">(mm)</span><Tip text={tooltips['clearHeight']} /></label>
                    <input type="number" min={0} placeholder="e.g. 3000" value={openingH} onChange={e => setOpeningH(e.target.value)} className={INPUT_CLS} />
                  </div>
                </div>

                {/* Derived external dimensions */}
                {doorModel && openingW && openingH && extW && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL_CLS}>External Width <span className="normal-case font-normal text-slate-400">(calculated)</span></label>
                      <div className="flex items-center rounded-xl border border-indigo-100 bg-indigo-50 py-3 px-4">
                        <span className="text-sm font-semibold text-indigo-700">{extW} mm</span>
                        <span className="ml-2 text-xs text-indigo-400">CW + ({doorModel.split(' ')[1]}×2) + 158</span>
                      </div>
                    </div>
                    <div>
                      <label className={LABEL_CLS}>External Height <span className="normal-case font-normal text-slate-400">(calculated)</span></label>
                      <div className="flex items-center rounded-xl border border-indigo-100 bg-indigo-50 py-3 px-4">
                        <span className="text-sm font-semibold text-indigo-700">{extH} mm</span>
                        <span className="ml-2 text-xs text-indigo-400">CH + {EH_OFFSET[doorType] ?? 400}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Frame + Curtain — two columns */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_REQ_CLS}>Frame<Tip text={tooltips['frame']} /></label>
                    <SelectWrapper>
                      <select value={frame} onChange={e => setFrame(e.target.value)} className={SELECT_CLS}>
                        <option value="" disabled>— Select frame —</option>
                        {optCodes('frame').map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </SelectWrapper>
                  </div>
                  <div>
                    <label className={LABEL_REQ_CLS}>Curtain<Tip text={tooltips['curtain']} /></label>
                    <SelectWrapper>
                      <select value={curtain} onChange={e => setCurtain(e.target.value)} className={SELECT_CLS}>
                        <option value="" disabled>— Select curtain —</option>
                        {optCodes('curtain').map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </SelectWrapper>
                  </div>
                </div>

                <div>
                  <label className={LABEL_REQ_CLS}>Colour<Tip text={tooltips['colour']} /></label>
                  <div className="relative" ref={colourRef}>
                    <button type="button" onClick={() => setColourOpen(o => !o)}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                      {colour ? (
                        <>
                          <span className="h-6 w-10 shrink-0 rounded-md border border-slate-200"
                            style={{ backgroundColor: opts('colour').find(c => c.code === colour)?.hexColour ?? undefined }} />
                          {colour}
                        </>
                      ) : <span className="text-slate-400">— Select colour —</span>}
                      <span className="material-symbols-outlined ml-auto text-slate-400 text-lg">expand_more</span>
                    </button>
                    {colourOpen && (
                      <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                        {opts('colour').map(c => (
                          <button key={c.code} type="button"
                            onClick={() => { setColour(c.code); setColourOpen(false) }}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition hover:bg-slate-50 ${colour === c.code ? 'bg-indigo-50 text-indigo-700' : 'text-slate-800'}`}>
                            <span className="h-6 w-10 shrink-0 rounded-md border border-slate-200" style={{ backgroundColor: c.hexColour ?? undefined }} />
                            {c.code}
                            {colour === c.code && <span className="material-symbols-outlined ml-auto text-indigo-500 text-base">check</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Safety Features ── */}
                <div className="mt-3">
                  <button type="button" onClick={() => setShowSafety(v => !v)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2 rounded-t-xl transition"
                    style={{ backgroundColor: '#92D050' }}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-white">verified_user</span>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white">Safety Features</p>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-white">{showSafety ? 'expand_less' : 'expand_more'}</span>
                  </button>
                  {showSafety && <div className="rounded-b-xl border border-t-0 border-slate-200 p-4 grid grid-cols-2 gap-3">
                    {SAFETY_FEATURES_KEYS.map(field => (
                      <div key={field.key}>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">{field.label}<Tip text={tooltips[field.key]} /></label>
                        {field.key === 'safetyOther' ? (
                          <textarea value={safetyValues[field.key] ?? ''} onChange={e => { setSafetyField(field.key, e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                            placeholder="Describe other safety feature…" rows={1}
                            className="w-full resize-none overflow-hidden rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
                        ) : (
                          <div className="relative">
                            <select value={safetyValues[field.key] ?? ''} onChange={e => setSafetyField(field.key, e.target.value)}
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                              <option value="">— None —</option>
                              {optCodes(field.key).map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">expand_more</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Safety Edge Colour — colour swatch picker */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Safety Edge Colour<Tip text={tooltips['safetyEdgeColour']} /></label>
                      <div className="relative" ref={safetyEdgeColourRef}>
                        <button type="button" onClick={() => setSafetyEdgeColourOpen(o => !o)}
                          className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                          {safetyEdgeColour ? (
                            <>
                              <span className="h-5 w-8 shrink-0 rounded border border-slate-200"
                                style={{ backgroundColor: opts('safetyEdgeColour').find(c => c.code === safetyEdgeColour)?.hexColour ?? '#e5e7eb' }} />
                              <span className="truncate">{safetyEdgeColour}</span>
                            </>
                          ) : <span className="text-slate-400 text-sm">— None —</span>}
                          <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">expand_more</span>
                        </button>
                        {safetyEdgeColourOpen && (
                          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                            <button key="" type="button"
                              onClick={() => { setSafetyEdgeColour(''); setSafetyEdgeColourOpen(false) }}
                              className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium transition hover:bg-slate-50 ${!safetyEdgeColour ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400'}`}>
                              — None —
                            </button>
                            {opts('safetyEdgeColour').map(c => (
                              <button key={c.code} type="button"
                                onClick={() => { setSafetyEdgeColour(c.code); setSafetyEdgeColourOpen(false) }}
                                className={`flex w-full items-center gap-3 px-3 py-2 text-sm font-medium transition hover:bg-slate-50 ${safetyEdgeColour === c.code ? 'bg-indigo-50 text-indigo-700' : 'text-slate-800'}`}>
                                <span className="h-5 w-8 shrink-0 rounded border border-slate-200" style={{ backgroundColor: c.hexColour ?? '#e5e7eb' }} />
                                {c.code}
                                {safetyEdgeColour === c.code && <span className="material-symbols-outlined ml-auto text-indigo-500 text-base">check</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>}
                </div>

              </>
            )}

            {/* Continue button — non-rapid-door */}
            {selected && !isRapidDoor && (
              <div className="pt-2">
                <button type="button" disabled={!selected}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  Continue
                </button>
              </div>
            )}
          </div>
          )}{/* end !isMaintenance && !isGeneral && !isParts wrapper */}
        </div>

        {/* ── RIGHT: door preview + pricing ─────────────────────────────────── */}
        {showRightPanel && (
          <div className="w-[420px] shrink-0">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">

              {/* Door preview header */}
              <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Door Preview</p>
                {colour && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <span className="inline-block h-3 w-3 rounded-full border border-slate-200"
                      style={{ backgroundColor: opts('colour').find(c => c.code === colour)?.hexColour ?? undefined }} />
                    {colour}
                  </span>
                )}
              </div>

              {/* Door image */}
              {(customDoorImage || (colour && getDoorImageUrl(doorType, colour))) ? (
                <div className="relative bg-slate-100 shrink-0 group">
                  <img
                    key={customDoorImage ?? colour}
                    src={customDoorImage ?? getDoorImageUrl(doorType, colour)!}
                    alt={customDoorImageName ?? `${doorType} in ${colour}`}
                    className="w-full object-contain max-h-[200px]" />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent px-4 py-3">
                    <p className="text-xs font-semibold text-white">{doorType} — {doorTypeName(doorType)}</p>
                    {curtain && <p className="text-[11px] text-white/70 mt-0.5">{curtain} · {colour}</p>}
                  </div>
                  {/* Upload overlay — visible on hover */}
                  <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => customImageInputRef.current?.click()}
                      className="flex items-center gap-1 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow hover:bg-white transition">
                      <span className="material-symbols-outlined text-[14px]">upload</span>
                      {customDoorImage ? 'Replace' : 'Custom image'}
                    </button>
                    {customDoorImage && (
                      <button type="button" onClick={() => { setCustomDoorImage(null); setCustomDoorImageName(null) }}
                        className="flex items-center gap-1 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 shadow hover:bg-white transition">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 h-24 text-slate-400 shrink-0 bg-slate-50 relative group">
                  <span className="material-symbols-outlined text-5xl text-slate-300">garage</span>
                  <p className="text-sm">{colour ? 'No image for this colour' : 'Select a colour to preview'}</p>
                  <button type="button" onClick={() => customImageInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm hover:border-indigo-400 hover:text-indigo-600 transition">
                    <span className="material-symbols-outlined text-[14px]">upload</span>
                    Upload custom image
                  </button>
                </div>
              )}
              {/* Hidden file input */}
              <input ref={customImageInputRef} type="file" accept="image/*" className="hidden"
                onChange={handleCustomImageUpload} />

              {/* ── Quotation Description ── */}
              <div className="border-t border-slate-100">
                <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white">Quotation Description</p>
                  {!editingDesc ? (
                    <button type="button"
                      onClick={() => { setTempDesc(displayDesc); setEditingDesc(true) }}
                      className="flex items-center gap-1 text-slate-300 hover:text-white transition text-[11px]">
                      <span className="material-symbols-outlined text-[15px]">edit</span>
                      Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => { setCustomDesc(tempDesc); setEditingDesc(false) }}
                        className="text-green-400 hover:text-green-300 text-[11px] font-semibold">Save</button>
                      <button type="button"
                        onClick={() => setEditingDesc(false)}
                        className="text-slate-400 hover:text-slate-200 text-[11px]">Cancel</button>
                      {customDesc !== null && (
                        <button type="button"
                          onClick={() => { setCustomDesc(null); setEditingDesc(false) }}
                          className="text-amber-400 hover:text-amber-300 text-[11px]">Reset</button>
                      )}
                    </div>
                  )}
                </div>
                {editingDesc ? (
                  <textarea
                    value={tempDesc}
                    onChange={e => setTempDesc(e.target.value)}
                    rows={5}
                    className="w-full bg-amber-50 px-4 py-3 font-mono text-sm text-slate-800 leading-relaxed resize-none outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400"
                  />
                ) : (
                  <div className="bg-amber-50 px-4 py-3 font-mono text-sm text-slate-800 leading-relaxed whitespace-pre-wrap min-h-[60px]">
                    {displayDesc || <span className="text-slate-400 text-xs not-italic font-sans">Fill in the form to generate description…</span>}
                    {customDesc !== null && (
                      <span className="ml-2 inline-block rounded bg-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 uppercase tracking-wide not-italic font-sans">edited</span>
                    )}
                  </div>
                )}
              </div>{/* end Quotation Description */}

              {/* ── Activation sub-card ── */}
              <div className="border-t border-slate-100 px-4 py-4">
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <button type="button" onClick={() => setShowActivation(v => !v)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2.5 transition"
                    style={{ backgroundColor: '#FF0000' }}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-white">sensors</span>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white">Activation</p>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-white">{showActivation ? 'expand_less' : 'expand_more'}</span>
                  </button>
                  {showActivation && (
                    <div className="p-4 grid grid-cols-2 gap-3">
                      {ACTIVATION_KEYS.map(field => (
                        <div key={field.key}>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">{field.label}<Tip text={tooltips[field.key]} /></label>
                          <div className="relative">
                            <select value={safetyValues[field.key] ?? ''} onChange={e => setSafetyField(field.key, e.target.value)}
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                              <option value="">— None —</option>
                              {optCodes(field.key).map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">expand_more</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Motor & Control Box sub-card ── */}
              <div className="border-t border-slate-100 px-4 pb-4">
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <button type="button" onClick={() => setShowMotor(v => !v)}
                    className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest transition ${motorEnabled ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">settings</span>
                      <span>Motor &amp; Control Box</span>
                    </div>
                    <span className="material-symbols-outlined text-[18px]">{showMotor ? 'expand_less' : 'expand_more'}</span>
                  </button>
                  {showMotor && (
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Motor (kW)<Tip text={tooltips['motorKw']} /></label>
                          <div className="relative">
                            <select value={motorKw} onChange={e => setMotorKw(e.target.value)}
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                              <option value="">—</option>
                              {opts('motorKw').map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">expand_more</span>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Motor Side<Tip text={tooltips['motorSide']} /></label>
                          <div className="relative">
                            <select value={motorSide} onChange={e => setMotorSide(e.target.value)}
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                              <option value="">—</option>
                              {optCodes('motorSide').map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">expand_more</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Control Box Side<Tip text={tooltips['controlBoxSide']} /></label>
                          <div className="relative">
                            <select value={cbSide} onChange={e => setCbSide(e.target.value)}
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                              <option value="">—</option>
                              {optCodes('controlBoxSide').map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">expand_more</span>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Door Control<Tip text={tooltips['doorControl']} /></label>
                          <div className="relative">
                            <select value={doorControl} onChange={e => setDoorControl(e.target.value)}
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                              <option value="">—</option>
                              {optCodes('doorControl').map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">expand_more</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ── Customer Details — separate card ───────────────────────────────── */}
      {showRightPanel && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Customer Details</h2>
              <span className="text-red-400 text-sm font-bold">*</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={custCanBeBlank} onChange={e => setCustCanBeBlank(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              <span className="text-xs text-slate-500">Customer details can be blank</span>
            </label>
          </div>
          {custCanBeBlank && (
            <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <span className="material-symbols-outlined text-[14px] text-amber-500">warning</span>
              <p className="text-xs text-amber-700">Quote will be generated without customer details. This is for internal/draft use only.</p>
            </div>
          )}
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div className="space-y-4">
                {([
                  ['Customer',  custName,  setCustName,  'Company or customer name', true],
                  ['Attention', custAttn,  setCustAttn,  'Contact person',           false],
                  ['Phone',     custPhone, setCustPhone, '(03) 9000 0000',           false],
                ] as [string, string, (v: string) => void, string, boolean][]).map(([label, value, setter, placeholder, required]) => (
                  <div key={label}>
                    <label className={`mb-1.5 block text-xs font-semibold uppercase tracking-widest ${!custCanBeBlank && required && !value ? 'text-red-400' : 'text-slate-400'}`}>
                      {label}{required && !custCanBeBlank && <span className="ml-0.5 text-red-400">*</span>}
                    </label>
                    <input type="text" value={value} placeholder={placeholder} onChange={e => setter(e.target.value)}
                      className={`w-full rounded-xl border py-2.5 px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500/20 ${!custCanBeBlank && required && !value ? 'border-red-300 focus:border-red-400' : 'border-slate-200 bg-white focus:border-indigo-400'}`} />
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                {([
                  ['Address',  custAddress,  setCustAddress,  'Street address',             true],
                  ['Postcode', custPostcode, setCustPostcode, '3000',                        false],
                  ['Email',    custEmail,    setCustEmail,    'contact@company.com.au',      false],
                ] as [string, string, (v: string) => void, string, boolean][]).map(([label, value, setter, placeholder, required]) => (
                  <div key={label}>
                    <label className={`mb-1.5 block text-xs font-semibold uppercase tracking-widest ${!custCanBeBlank && required && !value ? 'text-red-400' : 'text-slate-400'}`}>
                      {label}{required && !custCanBeBlank && <span className="ml-0.5 text-red-400">*</span>}
                    </label>
                    <input type="text" value={value} placeholder={placeholder} onChange={e => setter(e.target.value)}
                      className={`w-full rounded-xl border py-2.5 px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500/20 ${!custCanBeBlank && required && !value ? 'border-red-300 focus:border-red-400' : 'border-slate-200 bg-white focus:border-indigo-400'}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      {showRightPanel && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Pricing & Generate Quote</h2>
          </div>
          <div className="px-6 py-5 space-y-5">

            {/* QTY / Unit Price / Line Total */}
            <div className="grid grid-cols-3 gap-4 items-end">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">QTY</label>
                <input type="number" min={1} placeholder="1" value={qty} onChange={e => setQty(e.target.value)}
                  className={INPUT_CLS} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400 after:content-['*'] after:ml-0.5 after:text-red-400">
                  Unit Price <span className="normal-case font-normal after:content-none">(ex GST)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                  <input type="text" inputMode="decimal" placeholder="0.00" value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-7 pr-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Line Total <span className="normal-case font-normal">(ex GST)</span>
                </label>
                <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 gap-0.5">
                  <span className="text-sm text-slate-400">$</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {lineTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Demolition — door-specific */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Demolition</p>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button type="button"
                  onClick={() => {
                    if (demolitionEnabled) {
                      setDemolitionEnabled(false); setDemolition(''); setDemolitionScope('')
                    } else {
                      setDemolitionEnabled(true)
                      if (!demolitionScope) setDemolitionScope('Remove the existing Door.')
                    }
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold transition ${demolitionEnabled ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">construction</span>
                    <span>Include Demolition</span>
                  </div>
                  <span className="material-symbols-outlined text-[20px]">
                    {demolitionEnabled ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                </button>
                {demolitionEnabled && (
                  <div className="p-4 space-y-3 border-t border-slate-100">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">Demolition Cost<Tip text={tooltips['demolition']} /></label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                        <input type="text" inputMode="decimal" placeholder="0.00" value={demolition} onChange={e => setDemolition(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-6 pr-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">Demolition Scope of Work</label>
                      <textarea
                        value={demolitionScope}
                        onChange={e => setDemolitionScope(e.target.value)}
                        placeholder="Describe the demolition work — e.g. remove existing roller door, dispose of old frame and curtain…"
                        rows={3}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Project Costs (quote-level, not per-door) ─────────────────────── */}
      {showRightPanel && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Project Costs</h2>
            <span className="text-[11px] text-slate-400 normal-case font-normal">applies to whole quote, not per door</span>
          </div>
          <div className="px-6 py-5 space-y-4">
            {!installation && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <span className="material-symbols-outlined text-[14px] text-amber-500">info</span>
                <p className="text-[11px] text-amber-700">Installation not entered — add a cost if this quote includes installation.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Delivery',               tipKey: 'delivery',     value: delivery,     set: setDelivery },
                { label: 'Installation',           tipKey: 'installation', value: installation, set: setInstallation },
                { label: 'Equipment Hire',         tipKey: 'equipHire',    value: equipHire,    set: setEquipHire },
                { label: 'Accommodation & Travel', tipKey: 'accTravel',    value: accTravel,    set: setAccTravel },
              ].map(({ label, tipKey, value, set }) => (
                <div key={label}>
                  <label className="mb-1 block text-xs font-medium text-slate-500">{label}<Tip text={tooltips[tipKey]} /></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                    <input type="text" inputMode="decimal" placeholder="0.00" value={value} onChange={e => set(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-6 pr-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Quote Options ──────────────────────────────────────────────────── */}
      {showRightPanel && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Quote Options</h2>
          </div>
          <div className="px-6 py-5 space-y-5">

            {/* Quote number + grand total */}
            <div className="flex items-center gap-3">
              {quoteNumber && (
                <div className="flex items-center rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2">
                  <span className="text-xs font-medium text-indigo-700">Quote: <span className="font-bold">{quoteNumber}</span></span>
                  {savedDoors.length > 0 && <span className="ml-2 text-[10px] text-indigo-500">({savedDoors.length + 1} doors)</span>}
                </div>
              )}
              {savedDoors.length > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-2 flex-1">
                  <span className="text-xs font-semibold text-white">Combined Total (ex GST)</span>
                  <span className="text-sm font-bold text-white">${grandTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            {/* Include Summary Page toggle */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Include Summary Page</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {includeSummary
                    ? 'summary will be appended to the quote.'
                    : 'No summary page — Installation, Demolition, Equipment Hire & Travel shown on page 1 with updated total.'}
                </p>
              </div>
              <button type="button" onClick={() => setIncludeSummary(v => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${includeSummary ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${includeSummary ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* End User — T&C selector */}
            <div>
              <label className={LABEL_CLS}>
                End User <span className="normal-case font-normal text-slate-400">— selects which T&amp;C document is appended to the quote</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['CUSTOMER', 'DISTRIBUTOR', 'TENDER'] as const).map(type => (
                  <button key={type} type="button"
                    onClick={() => setEndUser(prev => prev === type ? '' : type)}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition ${
                      endUser === type
                        ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}>
                    <span className="material-symbols-outlined text-[18px]">
                      {type === 'CUSTOMER' ? 'person' : type === 'DISTRIBUTOR' ? 'local_shipping' : 'gavel'}
                    </span>
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              {!endUser && (
                <p className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">info</span>
                  No T&amp;C will be appended if no end user is selected.
                </p>
              )}
            </div>

            {/* Editable notes / disclaimers */}
            <div className="space-y-3">
              {/* Page 2 Summary Note — only shown when summary page is enabled */}
              {includeSummary && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Summary Note</span>
                  {!editingPage2Note ? (
                    <button type="button" onClick={() => { setTempPage2Note(page2SummaryNote || DEFAULT_PAGE2_SUMMARY_NOTE); setEditingPage2Note(true) }}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition">
                      <span className="material-symbols-outlined text-[14px]">edit</span>Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setEditingPage2Note(false)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-200 transition">
                        <span className="material-symbols-outlined text-[14px]">close</span>Cancel
                      </button>
                      <button type="button" onClick={() => { saveNote2(quoteNumber, tempPage2Note); setEditingPage2Note(false) }}
                        className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 transition">
                        <span className="material-symbols-outlined text-[14px]">check</span>Save
                      </button>
                    </div>
                  )}
                </div>
                {editingPage2Note ? (
                  <textarea rows={3} value={tempPage2Note} onChange={e => setTempPage2Note(e.target.value)}
                    className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-[12px] text-slate-700 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 resize-y" />
                ) : (
                  <p className="text-[12px] text-slate-500 leading-relaxed whitespace-pre-wrap">
                    {page2SummaryNote || DEFAULT_PAGE2_SUMMARY_NOTE}
                  </p>
                )}
              </div>}

            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button type="button" disabled={!canGenerate} onClick={handleAddAnotherDoor}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40">
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Another Door
              </button>
              <button type="button" disabled={!canGenerate} onClick={handleGenerateQuote}
                className="inline-flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
                {generating
                  ? <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Generating…</>
                  : <><span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>{showPreview ? 'Regenerate Quote' : 'Generate Quote'}</>
                }
              </button>
            </div>

            {/* Save draft */}
            <div className="flex items-center gap-3">
              <button type="button" disabled={saving || generating} onClick={handleSaveQuote}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
                {saving
                  ? <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Saving…</>
                  : <><span className="material-symbols-outlined text-[16px]">save</span>Save Quote</>
                }
              </button>
            </div>
            {saveMsg && (
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${saveMsg.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                <span className="material-symbols-outlined text-[14px]">{saveMsg.ok ? 'check_circle' : 'error'}</span>
                {saveMsg.text}
              </div>
            )}

            {/* Missing fields warning — shown when button is disabled */}
            {!canGenerate && !generating && missingFields.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1">
                <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">warning</span>
                  Required fields missing — complete these to generate:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {missingFields.map(f => (
                    <span key={f} className="inline-flex items-center rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      <span className="mr-1 text-red-400">*</span>{f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Quotation Preview ──────────────────────────────────────────────── */}
      {showPreview && previewUrl && (
        <div ref={previewRef} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Preview header */}
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-indigo-600 text-xl">picture_as_pdf</span>
              <div>
                <h2 className="text-base font-semibold text-slate-800">Quotation Preview</h2>
                {quoteNumber && <p className="text-xs text-slate-400">{quoteNumber}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleEditQuote}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Edit Quote
              </button>
              <button type="button" onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-100">
                <span className="material-symbols-outlined text-[16px]">download</span>
                Download PDF
              </button>
              <button type="button" onClick={openEmailModal}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                <span className="material-symbols-outlined text-[16px]">send</span>
                Send Email
              </button>
            </div>
          </div>
          {/* PDF iframe */}
          <iframe
            src={previewUrl}
            className="w-full border-0"
            style={{ height: '900px' }}
            title="Quote Preview"
          />
        </div>
      )}

      {/* ── Email Modal ────────────────────────────────────────────────────── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-6">
          <div className="w-full sm:max-w-[680px] rounded-t-xl sm:rounded-xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.18)] flex flex-col max-h-[96vh] sm:max-h-[88vh] overflow-hidden border border-slate-300">

            {/* ── Outlook-style title bar ── */}
            <div className="bg-[#0f3d8c] flex items-center justify-between px-4 py-2 shrink-0 select-none">
              <span className="text-white text-[13px] font-medium tracking-wide">New Message</span>
              <div className="flex items-center gap-1">
                <button type="button" title="Discard" onClick={() => setShowEmailModal(false)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/20 transition text-white/80 hover:text-white">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>

            {/* ── From bar (read-only, Outlook style) ── */}
            {loggedInEmail && (
              <div className="flex items-center gap-0 border-b border-slate-200 bg-white px-4 py-2">
                <span className="text-[12px] text-slate-500 w-14 shrink-0 font-medium">From</span>
                <span className="text-[13px] text-slate-700 truncate">{loggedInEmail}</span>
              </div>
            )}

            {/* ── To ── */}
            <div className={`flex items-center border-b px-4 py-2 bg-white ${emailTo.trim() && !toAllValid ? 'border-red-300' : 'border-slate-200'}`}>
              <span className="text-[12px] text-slate-500 w-14 shrink-0 font-medium">To</span>
              <textarea rows={1} value={emailTo}
                onChange={e => { setEmailTo(e.target.value); setEmailResult(null) }}
                placeholder="Recipients"
                className="flex-1 text-[13px] text-slate-800 bg-transparent outline-none resize-none leading-5 placeholder:text-slate-300" />
              {emailTo.trim() && !toAllValid && (
                <span className="material-symbols-outlined text-[14px] text-red-400 shrink-0 ml-1">error</span>
              )}
            </div>

            {/* ── CC ── */}
            <div className={`flex items-start border-b px-4 py-2 bg-white ${emailCc.trim() && !ccAllValid ? 'border-red-300' : 'border-slate-200'}`}>
              <span className="text-[12px] text-slate-500 w-14 shrink-0 font-medium mt-0.5">Cc</span>
              <div className="flex-1">
                <textarea rows={1} value={emailCc}
                  onChange={e => { setEmailCc(e.target.value); setCcSelf(false) }}
                  placeholder="Carbon copy"
                  className="w-full text-[13px] text-slate-800 bg-transparent outline-none resize-none leading-5 placeholder:text-slate-300" />
                {loggedInEmail && (
                  <label className="mt-1 flex items-center gap-1.5 cursor-pointer w-fit">
                    <input type="checkbox" checked={ccSelf}
                      onChange={e => {
                        setCcSelf(e.target.checked)
                        if (e.target.checked) {
                          const existing = emailCc.split(/[,;\n]/).map(x => x.trim()).filter(Boolean)
                          if (!existing.includes(loggedInEmail)) {
                            setEmailCc(existing.length ? existing.join(', ') + ', ' + loggedInEmail : loggedInEmail)
                          }
                        }
                      }}
                      className="rounded-sm border-slate-400 text-[#0f3d8c] focus:ring-blue-500 h-3 w-3" />
                    <span className="text-[11px] text-slate-400">CC myself</span>
                  </label>
                )}
              </div>
            </div>

            {/* ── Subject ── */}
            <div className="flex items-center border-b border-slate-200 bg-white px-4 py-2">
              <span className="text-[12px] text-slate-500 w-14 shrink-0 font-medium">Subject</span>
              <input type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 text-[13px] text-slate-800 bg-transparent outline-none placeholder:text-slate-300" />
            </div>

            {/* ── Attachment chip ── */}
            {quoteNumber && (
              <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white pl-2 pr-2.5 py-1 shadow-sm">
                  <span className="material-symbols-outlined text-[14px] text-red-500">picture_as_pdf</span>
                  <span className="text-[11px] text-slate-700 font-medium truncate max-w-[220px]">
                    {quoteNumber}_{(custName && custName !== quoteNumber ? custName : 'CUSTOMER').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 28)}.pdf
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer ml-1">
                  <input type="checkbox" checked={attachPdf} onChange={e => setAttachPdf(e.target.checked)}
                    className="rounded-sm border-slate-400 text-[#0f3d8c] focus:ring-blue-500 h-3 w-3" />
                  <span className="text-[11px] text-slate-500">Attach PDF</span>
                </label>
              </div>
            )}

            {/* ── Compose area ── */}
            <div className="flex-1 overflow-y-auto bg-white">
              <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
                className="w-full h-full min-h-[200px] text-[13.5px] text-slate-800 bg-transparent outline-none resize-none leading-relaxed font-[inherit] px-4 py-3 placeholder:text-slate-300"
                placeholder="Compose your message…" />

              {/* ── Signature (inline, below message — Outlook style) ── */}
              {includeSig && (
                <div className="border-t border-slate-200 mx-4 pt-3 pb-4">
                  {showSigEditor ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Signature</span>
                        <div className="flex items-center gap-2">
                          {/* Insert image at cursor */}
                          <button type="button"
                            onMouseDown={e => { e.preventDefault(); saveSelectionBeforeUpload(); sigFileRef.current?.click() }}
                            className="flex items-center gap-1 border border-slate-300 rounded px-2 py-1 text-[11px] text-slate-600 hover:border-[#0f3d8c] hover:text-[#0f3d8c] transition bg-white">
                            <span className="material-symbols-outlined text-[13px]">add_photo_alternate</span>
                            Insert image at cursor
                          </button>
                          <input ref={sigFileRef} type="file" accept="image/png,image/jpeg,image/gif" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleSigImageUpload(f); e.target.value = '' }} />
                        </div>
                      </div>
                      {/* Single contenteditable editor — type text, paste/insert images anywhere */}
                      <div
                        ref={sigEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={e => {
                          const html = (e.currentTarget as HTMLDivElement).innerHTML
                          setSigHtml(html)
                          saveSigHtml(html, includeSig)
                        }}
                        onPaste={e => {
                          const items = Array.from(e.clipboardData.items)
                          const imgItem = items.find(i => i.type.startsWith('image/'))
                          if (imgItem) {
                            e.preventDefault()
                            const file = imgItem.getAsFile()
                            if (file) handleSigImageUpload(file)
                          }
                          // Text paste: let browser handle it naturally
                        }}
                        dangerouslySetInnerHTML={{ __html: sigHtml }}
                        className="min-h-[80px] w-full border border-slate-200 rounded px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-[#0f3d8c] bg-white leading-relaxed font-[inherit]"
                        style={{ whiteSpace: 'pre-wrap' }}
                        data-placeholder="Type your signature here, or paste directly from Outlook…"
                      />
                      <p className="text-[10px] text-slate-400">Tip: position your cursor then click &quot;Insert image&quot; to place a logo anywhere in the signature.</p>
                    </div>
                  ) : sigHtml ? (
                    /* Preview — render the stored HTML as-is */
                    <div
                      className="text-[13px] text-slate-700 leading-relaxed [&_img]:inline-block [&_img]:max-h-12 [&_img]:align-middle"
                      dangerouslySetInnerHTML={{ __html: sigHtml }}
                    />
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">No signature — click &quot;Edit sig&quot; to add one.</p>
                  )}
                </div>
              )}
            </div>

            {/* ── Result banner ── */}
            {emailResult && (
              <div className={`flex items-start gap-2 px-4 py-2.5 text-[13px] font-medium border-t ${
                emailResult.ok
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0">
                  {emailResult.ok ? 'check_circle' : 'error'}
                </span>
                {emailResult.msg}
              </div>
            )}

            {/* ── Outlook-style toolbar footer ── */}
            <div className="border-t border-slate-200 bg-[#f3f2f1] px-4 py-2.5 flex items-center gap-2 shrink-0">
              {/* Send button — left, Outlook style */}
              <button type="button" disabled={!canSendEmail}
                onClick={async () => {
                  if (!previewUrl) { setEmailResult({ ok: false, msg: 'Generate the quote PDF first before sending.' }); return }
                  setEmailSending(true); setEmailResult(null)
                  try {
                    const blobRes = await fetch(previewUrl)
                    const blob = await blobRes.blob()
                    const pdfBase64 = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader()
                      reader.onload = () => resolve((reader.result as string).split(',')[1])
                      reader.onerror = reject
                      reader.readAsDataURL(blob)
                    })
                    const safeCust = (custName && custName !== quoteNumber ? custName : 'CUSTOMER').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 50)
                    const fileName = `${quoteNumber}_${safeCust}${endUser ? `_${endUser}` : ''}.pdf`
                    const res = await fetch('/api/quotes/rapid-door/email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        to: emailTo, cc: emailCc || undefined,
                        subject: emailSubject, emailBody,
                        pdfBase64: attachPdf ? pdfBase64 : undefined,
                        fileName: attachPdf ? fileName : undefined,
                        attachPdf, quoteNumber,
                        customerName: custName && custName !== quoteNumber ? custName : undefined,
                        sigHtml: includeSig && sigHtml ? sigHtml : undefined,
                      }),
                    })
                    const json = await res.json()
                    if (!res.ok) throw new Error(json.error || 'Send failed')
                    const sentCount = (json.sent_to as string[]).length
                    setEmailResult({ ok: true, msg: `Sent to ${sentCount} recipient${sentCount > 1 ? 's' : ''} successfully.` })
                    setTimeout(() => setShowEmailModal(false), 2000)
                  } catch (e) {
                    setEmailResult({ ok: false, msg: e instanceof Error ? e.message : 'Failed to send. Please try again.' })
                  } finally {
                    setEmailSending(false)
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded bg-[#0f3d8c] hover:bg-[#1e40af] px-4 py-1.5 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 shadow-sm">
                {emailSending
                  ? <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>Sending…</>
                  : <><span className="material-symbols-outlined text-[14px]">send</span>Send</>
                }
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-slate-300 mx-1" />

              {/* Signature toggle */}
              <button type="button" title={includeSig ? 'Signature included' : 'Signature excluded'}
                onClick={() => { setIncludeSig(v => { saveSigHtml(sigHtml, !v); return !v }) }}
                className={`flex items-center gap-1 rounded px-2 py-1.5 text-[12px] transition font-medium ${
                  includeSig ? 'bg-white text-[#0f3d8c] border border-slate-300 shadow-sm' : 'text-slate-500 hover:bg-white hover:border hover:border-slate-300'
                }`}>
                <span className="material-symbols-outlined text-[15px]">draw</span>
                Sig
              </button>

              {/* Edit signature */}
              <button type="button"
                onClick={() => setShowSigEditor(v => !v)}
                className={`flex items-center gap-1 rounded px-2 py-1.5 text-[12px] transition font-medium ${
                  showSigEditor ? 'bg-white text-[#0f3d8c] border border-slate-300 shadow-sm' : 'text-slate-500 hover:bg-white hover:border hover:border-slate-300'
                }`}>
                <span className="material-symbols-outlined text-[15px]">edit</span>
                {showSigEditor ? 'Done' : 'Edit sig'}
              </button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Discard */}
              <button type="button" onClick={() => setShowEmailModal(false)}
                title="Discard"
                className="flex items-center gap-1 rounded px-2 py-1.5 text-[12px] text-slate-500 hover:bg-white hover:border hover:border-slate-300 transition font-medium">
                <span className="material-symbols-outlined text-[15px]">delete</span>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
