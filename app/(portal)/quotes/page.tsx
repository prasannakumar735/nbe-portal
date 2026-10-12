'use client'
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { loadDoorImageStyle } from '@/app/(portal)/admin/settings/QuoteSettingsClient'
import { createSupabaseClient } from '@/lib/supabase/client'
import type { DoorLineItem } from '@/lib/pdf/generateRapidDoorQuotePdf'
import type { DoorOptionsMap, DoorOption } from '@/app/api/quotes/rapid-door/options/route'
import { ServiceQuoteWorkflowPanel, type ServiceQuoteWorkflowState } from '@/components/quotes/ServiceQuoteWorkflowPanel'

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
/** Convert DD/MM/YYYY display date to ISO YYYY-MM-DD for Supabase date columns */
function displayToISO(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split('/')
  return `${yyyy}-${mm}-${dd}`
}
function todayISO(): string { return displayToISO(todayDisplay()) }

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
  const modelNum = parseInt(doorModel) || 0
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
  { key: 'safetyEdge',    label: 'Safety Edge'    },
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

// ── Rich description textarea with formatting toolbar ─────────────────────────
function RichDescTextarea({
  value, onChange, placeholder = 'Description', rows = 2, className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function applyFormat(type: 'bold' | 'italic' | 'bullet') {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const sel   = value.slice(start, end)
    let next = value
    let newStart = start, newEnd = end

    if (type === 'bold') {
      const wrapped = `**${sel}**`
      next = value.slice(0, start) + wrapped + value.slice(end)
      newStart = start + 2; newEnd = start + 2 + sel.length
    } else if (type === 'italic') {
      const wrapped = `_${sel}_`
      next = value.slice(0, start) + wrapped + value.slice(end)
      newStart = start + 1; newEnd = start + 1 + sel.length
    } else if (type === 'bullet') {
      // Find start of current line
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const lineEnd   = value.indexOf('\n', start)
      const lineText  = value.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
      if (lineText.startsWith('• ') || lineText.startsWith('- ')) {
        // remove bullet prefix
        const prefix = lineText.slice(0, 2)
        next = value.slice(0, lineStart) + lineText.slice(2) + (lineEnd === -1 ? '' : value.slice(lineEnd))
        newStart = Math.max(lineStart, start - prefix.length)
        newEnd   = newStart
      } else {
        next = value.slice(0, lineStart) + '• ' + lineText + (lineEnd === -1 ? '' : value.slice(lineEnd))
        newStart = start + 2; newEnd = end + 2
      }
    }

    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(newStart, newEnd)
    })
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex gap-0.5">
        <button type="button" onMouseDown={e => { e.preventDefault(); applyFormat('bold') }}
          title="Bold (**text**)"
          className="px-2 py-0.5 text-xs font-bold border border-slate-200 rounded bg-white hover:bg-slate-100 text-slate-700 leading-tight">B</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); applyFormat('italic') }}
          title="Italic (_text_)"
          className="px-2 py-0.5 text-xs italic border border-slate-200 rounded bg-white hover:bg-slate-100 text-slate-700 leading-tight">I</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); applyFormat('bullet') }}
          title="Bullet point"
          className="px-2 py-0.5 text-xs border border-slate-200 rounded bg-white hover:bg-slate-100 text-slate-700 leading-tight">•</button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={className ?? 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition resize-y min-h-[2.5rem]'}
      />
    </div>
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
  const [safetyEdgeColour,  setSafetyEdgeColour] = useState('YL 119')
const [qty,           setQty]          = useState('1')
  const [unitPrice,     setUnitPrice]    = useState('')
  const [safetyValues,  setSafetyValues] = useState<Record<string, string>>({})
  const [motorEnabled,  setMotorEnabled] = useState(true)
  const [showSafety,    setShowSafety]   = useState(true)
  const [showActivation, setShowActivation] = useState(true)
  const [swipeManual,    setSwipeManual]    = useState(false)
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
  const [generalTcType,       setGeneralTcType]       = useState<'INDUSTRIAL_RAPID_DOOR' | 'PVC_FLEX_SYSTEM'>('INDUSTRIAL_RAPID_DOOR')

  // General quote — save state
  const generalQuoteIdRef     = useRef<string | null>(null)
  const generalQuoteNumberRef = useRef<string | null>(null)
  const [generalSaveMsg,       setGeneralSaveMsg]       = useState<{ ok: boolean; text: string } | null>(null)
  type GeneralRecentRow = {
    id: string; quote_number: string; customer_name: string | null
    site_address: string | null; service_date: string; total: number
    workflow_status: string; form_snapshot: Record<string, unknown> | null; updated_at: string
  }
  const [recentGeneralQuotes,  setRecentGeneralQuotes]  = useState<GeneralRecentRow[]>([])
  const [recentGeneralLoading, setRecentGeneralLoading] = useState(false)

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
  const [partsTcType,       setPartsTcType]       = useState<'INDUSTRIAL_RAPID_DOOR' | 'PVC_FLEX_SYSTEM'>('INDUSTRIAL_RAPID_DOOR')

  // Parts quote — editable sender / company info
  const [partsSenderName,    setPartsSenderName]    = useState('NBE AUSTRALIA')
  const [partsSenderAddress, setPartsSenderAddress] = useState('22A Humeside Dr, Campbellfield VIC 3061, Australia')
  const [partsSenderEmail,   setPartsSenderEmail]   = useState('accountsreceivable@nbeaustralia.com.au')
  const [partsContactName,   setPartsContactName]   = useState('Andrew Newton')
  const [partsContactPhone,  setPartsContactPhone]  = useState('(04) 2705 5556')
  const [partsContactEmail,  setPartsContactEmail]  = useState('anewton@nbeaustralia.com.au')

  // Shared type for saved quote rows (maintenance & parts)
  type SavedQuoteRow = {
    id: string; quote_number: string; customer_name: string | null
    site_address: string | null; service_date: string; total: number
    workflow_status: string; form_snapshot: Record<string, unknown> | null; updated_at: string
  }

  // Maintenance quote — save state
  const maintQuoteIdRef     = useRef<string | null>(null)
  const maintQuoteNumberRef = useRef<string | null>(null)
  const [maintSaveMsg,       setMaintSaveMsg]       = useState<{ ok: boolean; text: string } | null>(null)
  const [recentMaintQuotes,  setRecentMaintQuotes]  = useState<SavedQuoteRow[]>([])
  const [recentMaintLoading, setRecentMaintLoading] = useState(false)

  // Parts quote — save state
  const partsQuoteIdRef     = useRef<string | null>(null)
  const partsQuoteNumberRef = useRef<string | null>(null)
  const [partsSaveMsg,       setPartsSaveMsg]       = useState<{ ok: boolean; text: string } | null>(null)
  const [recentPartsQuotes,  setRecentPartsQuotes]  = useState<SavedQuoteRow[]>([])
  const [recentPartsLoading, setRecentPartsLoading] = useState(false)

  // PVC Flex quote — save state
  const pvcFlexQuoteIdRef     = useRef<string | null>(null)
  const pvcFlexQuoteNumberRef = useRef<string | null>(null)
  const [pvcFlexSaveMsg,       setPvcFlexSaveMsg]       = useState<{ ok: boolean; text: string } | null>(null)
  const [recentPvcFlexQuotes,  setRecentPvcFlexQuotes]  = useState<SavedQuoteRow[]>([])
  const [recentPvcFlexLoading, setRecentPvcFlexLoading] = useState(false)

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
  const [isSafari, setIsSafari] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    setIsSafari(/Safari/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|EdgiOS|OPR|FxiOS|Firefox/i.test(ua))
  }, [])

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
  type AllQuoteRow = {
    id: string; quote_number: string; quote_kind: string
    customer_name: string | null; site_address: string | null
    service_date: string; total: number; workflow_status: string
    updated_at: string; form_snapshot: Record<string, unknown> | null
  }
  const [recentQuotes, setRecentQuotes]     = useState<AllQuoteRow[]>([])
  const [recentLoading, setRecentLoading]   = useState(true)

  // ── Shared workflow panel (reuses the existing Quote approval workflow) ──────
  const [isWorkflowManager, setIsWorkflowManager] = useState(false)
  const [workflowQuoteId,   setWorkflowQuoteId]   = useState<string | null>(null)
  const [workflowState,     setWorkflowState]     = useState<ServiceQuoteWorkflowState | null>(null)
  const [workflowLoading,   setWorkflowLoading]   = useState(false)
  // ID of the saved quote currently loaded in the form (null = fresh/unsaved)
  const [editingId,            setEditingId]            = useState<string | null>(null)
  const [isReadOnly,           setIsReadOnly]           = useState(false)
  const [pendingAutoGenerate,  setPendingAutoGenerate]  = useState<string | null>(null)

  // ── Delete confirmation modal ────────────────────────────────────────────────
  const [deleteConfirmRow,  setDeleteConfirmRow]  = useState<AllQuoteRow | null>(null)
  const [deleteInProgress,  setDeleteInProgress]  = useState(false)
  const [deleteError,       setDeleteError]        = useState<string | null>(null)

  // true when a saved quote is open but the user hasn't clicked "Edit" yet
  const formLocked = isReadOnly && !!editingId

  // Keep the URL in sync with the open quote (e.g. /quotes?q=QGEN261005001)
  useEffect(() => {
    if (quoteNumber) {
      window.history.replaceState(null, '', `/quotes?q=${encodeURIComponent(quoteNumber)}`)
    } else {
      window.history.replaceState(null, '', '/quotes')
    }
  }, [quoteNumber])

  // Warn the user before an accidental browser refresh while a quote is open
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (quoteNumber) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [quoteNumber])

  // On mount: if the URL contains ?q=<quoteNumber>, auto-load that quote
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (!q) return
    void (async () => {
      try {
        const { data } = await createSupabaseClient()
          .from('quotes').select('*').eq('quote_number', q).maybeSingle()
        if (!data) return
        const qt = String((data as Record<string, unknown>).quote_type ?? '')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if      (qt === 'GENERAL')         { loadGeneralQuote(data as any);  setView('form') }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else if (qt === 'MAINTENANCE')     { loadMaintQuote(data as any);    setView('form') }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else if (qt === 'PARTS')           { loadPartsQuote(data as any);    setView('form') }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else if (qt === 'PVC_FLEX_SYSTEM') { loadPvcFlexQuote(data as any);  setView('form') }
      } catch { /* ignore */ }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate the PDF preview when a saved quote is first loaded (read-only mode)
  useEffect(() => {
    if (!pendingAutoGenerate) return
    const type = pendingAutoGenerate
    setPendingAutoGenerate(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fns: Record<string, () => void> = { general: handleGenerateGeneral as any, maint: handleGenerateMaintenance as any, parts: handleGenerateParts as any, pvcflex: handleGeneratePvcFlex as any }
    fns[type]?.()
  }, [pendingAutoGenerate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/api/pvc/quotes/meta')
      .then(r => r.json())
      .then(data => { if (data.isManager) setIsWorkflowManager(true) })
      .catch(() => {})
  }, [])

  function loadWorkflowState(quoteId: string) {
    setWorkflowLoading(true)
    fetch(`/api/quotes/service/${quoteId}/workflow`)
      .then(r => r.json())
      .then(j => { if (j.ok) setWorkflowState(j.workflow as ServiceQuoteWorkflowState | null) })
      .catch(() => {})
      .finally(() => setWorkflowLoading(false))
  }

  function openWorkflowModal(quoteId: string) {
    setWorkflowQuoteId(quoteId)
    setWorkflowState(null)
    loadWorkflowState(quoteId)
  }

  function closeWorkflowModal() {
    setWorkflowQuoteId(null)
    setWorkflowState(null)
  }

  function loadRecentQuotes() {
    setRecentLoading(true)
    fetch('/api/quotes/list?limit=50')
      .then(r => r.json())
      .then(j => { if (j.ok) setRecentQuotes(j.data ?? []) })
      .catch(() => {/* non-fatal */})
      .finally(() => setRecentLoading(false))
  }

  useEffect(() => { loadRecentQuotes() }, [])
  useEffect(() => {
    if (selected === 'GENERAL') loadRecentGeneralQuotes()
    if (selected === 'MAINTENANCE_SERVICE_REPAIR') loadRecentMaintQuotes()
    if (selected === 'PARTS') loadRecentPartsQuotes()
  }, [selected])

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
    setColour(''); setMotorKw(''); setMotorSide(''); setCbSide(''); setDoorControl(''); setSafetyEdgeColour('YL 119'); setQty('1')
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
    setEditingId(null)
    setIsReadOnly(false)
    setPendingAutoGenerate(null)
    generalQuoteIdRef.current = null; generalQuoteNumberRef.current = null
    maintQuoteIdRef.current   = null; maintQuoteNumberRef.current   = null
    partsQuoteIdRef.current   = null; partsQuoteNumberRef.current   = null
    pvcFlexQuoteIdRef.current = null; pvcFlexQuoteNumberRef.current = null
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
          date: todayISO(), validUntil: displayToISO(validUntil),
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
    setEditingId(q.id)
    setIsReadOnly(true)
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

  // ── Unified open from list ─────────────────────────────────────────────────
  const [groupsOpen, setGroupsOpen] = useState<Record<string, boolean>>({
    rapid_door: true, general: true, maintenance: true, parts: true, pvc_flex: true,
  })
  function toggleGroup(kind: string) {
    setGroupsOpen(prev => {
      const willClose = prev[kind] !== false
      if (willClose) setFilterMenuOpen(null)
      return { ...prev, [kind]: !prev[kind] }
    })
  }
  const [groupFilters, setGroupFilters] = useState<Record<string, string>>({})
  const [filterMenuOpen, setFilterMenuOpen] = useState<string | null>(null)
  function setGroupFilter(kind: string, value: string, e: React.MouseEvent) {
    e.stopPropagation()
    setGroupFilters(prev => ({ ...prev, [kind]: value }))
    setFilterMenuOpen(null)
  }
  function toggleFilterMenu(kind: string, e: React.MouseEvent) {
    e.stopPropagation()
    setFilterMenuOpen(prev => prev === kind ? null : kind)
  }
  const STATUS_ORDER: Record<string, number> = { draft: 0, draft_review: 1, approved: 2, completed: 3 }
  function sortAndFilterRows(rows: AllQuoteRow[], kind: string) {
    const filter = groupFilters[kind] ?? 'all'
    const filtered = filter === 'active'
      ? rows.filter(q => !['completed'].includes(q.workflow_status ?? ''))
      : filter === 'completed'
      ? rows.filter(q => (q.workflow_status ?? '') === 'completed')
      : rows
    return [...filtered].sort((a, b) =>
      (STATUS_ORDER[a.workflow_status ?? ''] ?? 0) - (STATUS_ORDER[b.workflow_status ?? ''] ?? 0)
    )
  }
  function openQuoteFromList(q: AllQuoteRow) {
    if (q.quote_kind === 'rapid_door') {
      // Re-fetch the full rapid-door row (has rapid_door_quote_details)
      fetch(`/api/quotes/rapid-door/list?limit=200`)
        .then(r => r.json())
        .then(j => {
          const full = (j.data ?? []).find((r: RecentQuoteRow) => r.id === q.id)
          if (full) { loadQuoteFromRow(full); setView('form') }
        })
      return
    }
    if (!q.form_snapshot) return
    const row = { id: q.id, quote_number: q.quote_number, customer_name: q.customer_name, site_address: q.site_address, service_date: q.service_date, total: q.total, workflow_status: q.workflow_status, form_snapshot: q.form_snapshot }
    if (q.quote_kind === 'general')     { loadGeneralQuote(row as GeneralRecentRow); setSelected('GENERAL'); setView('form') }
    if (q.quote_kind === 'maintenance') { loadMaintQuote(row as SavedQuoteRow);      setSelected('MAINTENANCE_SERVICE_REPAIR'); setView('form') }
    if (q.quote_kind === 'parts')       { loadPartsQuote(row as SavedQuoteRow);       setSelected('PARTS'); setView('form') }
    if (q.quote_kind === 'pvc_flex')    { loadPvcFlexQuote(row as SavedQuoteRow);      setSelected('PVC_FLEX_SYSTEM'); setView('form') }
  }

  // Open a quote AND immediately auto-generate its PDF
  function openPdfFromList(q: AllQuoteRow) {
    const kindMap: Record<string, string> = {
      general: 'general', maintenance: 'maint', parts: 'parts', pvc_flex: 'pvcflex',
    }
    const autoKey = kindMap[q.quote_kind]
    if (!autoKey) { openQuoteFromList(q); return }
    openQuoteFromList(q)
    setPendingAutoGenerate(autoKey)
  }

  async function handleDeleteQuote(id: string) {
    setDeleteInProgress(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'Delete failed.')
      setDeleteConfirmRow(null)
      setRecentQuotes(prev => prev.filter(q => q.id !== id))
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed.')
    } finally {
      setDeleteInProgress(false)
    }
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colourRef.current          && !colourRef.current.contains(e.target as Node))          setColourOpen(false)
      if (safetyEdgeColourRef.current && !safetyEdgeColourRef.current.contains(e.target as Node)) setSafetyEdgeColourOpen(false)
      setFilterMenuOpen(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Cleanup blob URL on unmount
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  type GeneralNoteStyle = { bold: boolean; italic: boolean; color: string; bgColor: string; fontSize: string }
  const defaultNoteStyle = (): GeneralNoteStyle => ({ bold: false, italic: false, color: '#374151', bgColor: '#eff6ff', fontSize: '12' })

  // ── Maintenance / Repair state ───────────────────────────────────────────────
  type MaintItem = { sno: string; item: string; description: string; width: string; height: string; qty: number; unitPrice: number; notes: string; noteStyle: GeneralNoteStyle; overridePrice: string; discount: string; extras: Record<string, string> }
  const emptyMaintItem = (i = 0): MaintItem => ({ sno: String(i + 1), item: '', description: '', width: '', height: '', qty: 1, unitPrice: 0, notes: '', noteStyle: defaultNoteStyle(), overridePrice: '', discount: '', extras: {} })
  const [maintItems, setMaintItems] = useState<MaintItem[]>(() => Array.from({ length: 5 }, (_, i) => emptyMaintItem(i)))

  type GeneralItem = { sno: string; item: string; description: string; width: string; height: string; qty: number; unitPrice: number; notes: string; noteStyle: GeneralNoteStyle; overridePrice: string; discount: string; extras: Record<string, string> }
  const emptyGeneralItem = (i = 0): GeneralItem => ({ sno: String(i + 1), item: '', description: '', width: '', height: '', qty: 1, unitPrice: 0, notes: '', noteStyle: defaultNoteStyle(), overridePrice: '', discount: '', extras: {} })
  const [generalItems, setGeneralItems] = useState<GeneralItem[]>(() => Array.from({ length: 5 }, (_, i) => emptyGeneralItem(i)))

  type GeneralColDef = { key: string; label: string; visible: boolean; width: number }
  const [generalColDefs, setGeneralColDefs] = useState<GeneralColDef[]>([
    { key: 'sno',         label: 'S.No',       visible: true, width: 52  },
    { key: 'item',        label: 'Item',        visible: true, width: 110 },
    { key: 'description', label: 'Description', visible: true, width: 220 },
    { key: 'width',       label: 'Width',       visible: true, width: 75  },
    { key: 'height',      label: 'Height',      visible: true, width: 75  },
    { key: 'qty',         label: 'Qty',         visible: true, width: 65  },
    { key: 'unitPrice',   label: 'Unit Price',  visible: true, width: 110 },
    { key: 'total',       label: 'Total',       visible: true, width: 100 },
  ])
  const [generalNotesOpen, setGeneralNotesOpen] = useState<Set<number>>(new Set())
  const [generalDragColKey, setGeneralDragColKey] = useState<string | null>(null)
  const [generalEditingColKey, setGeneralEditingColKey] = useState<string | null>(null)
  const [showGeneralDiscount, setShowGeneralDiscount] = useState(true)
  const [generalDiscountPct, setGeneralDiscountPct] = useState('')
  const [generalDiscountColor, setGeneralDiscountColor] = useState('#1a7a30')
  const [addingGeneralCol, setAddingGeneralCol] = useState(false)
  const [newGeneralColName, setNewGeneralColName] = useState('')

  function updateGeneralItem<K extends keyof GeneralItem>(i: number, key: K, val: GeneralItem[K]) {
    setGeneralItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it))
  }
  function toggleGeneralCol(key: string) {
    setGeneralColDefs(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c))
  }
  function renameGeneralCol(key: string, label: string) {
    setGeneralColDefs(prev => prev.map(c => c.key === key ? { ...c, label } : c))
  }
  function reorderGeneralCols(fromKey: string, toKey: string) {
    if (fromKey === toKey) return
    setGeneralColDefs(prev => {
      const arr = [...prev]
      const fi = arr.findIndex(c => c.key === fromKey)
      const ti = arr.findIndex(c => c.key === toKey)
      const [moved] = arr.splice(fi, 1)
      arr.splice(ti, 0, moved)
      return arr
    })
  }
  function addGeneralCol(label: string) {
    const key = `extra_${Date.now()}`
    setGeneralColDefs(prev => {
      const insertBefore = prev.findIndex(c => c.key === 'total')
      const arr = [...prev]
      arr.splice(insertBefore, 0, { key, label, visible: true, width: 100 })
      return arr
    })
  }
  function removeGeneralCol(key: string) {
    setGeneralColDefs(prev => prev.filter(c => c.key !== key))
  }

  type PartsItem = { sno: string; item: string; description: string; width: string; height: string; qty: number; unitPrice: number; notes: string; noteStyle: GeneralNoteStyle; overridePrice: string; discount: string; extras: Record<string, string> }
  const emptyPartsItem = (i = 0): PartsItem => ({ sno: String(i + 1), item: '', description: '', width: '', height: '', qty: 1, unitPrice: 0, notes: '', noteStyle: defaultNoteStyle(), overridePrice: '', discount: '', extras: {} })
  const [partsItems, setPartsItems] = useState<PartsItem[]>(() => Array.from({ length: 5 }, (_, i) => emptyPartsItem(i)))

  function updatePartsItem<K extends keyof PartsItem>(i: number, key: K, val: PartsItem[K]) {
    setPartsItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it))
  }

  function updateMaintItem<K extends keyof MaintItem>(i: number, key: K, val: MaintItem[K]) {
    setMaintItems(prev => prev.map((it, idx) => idx === i ? { ...it, [key]: val } : it))
  }

  // Maintenance discount
  const [showMaintDiscount, setShowMaintDiscount] = useState(true)
  const [maintDiscountPct, setMaintDiscountPct] = useState('')
  const [maintDiscountColor, setMaintDiscountColor] = useState('#1a7a30')

  // Parts discount
  const [showPartsDiscount, setShowPartsDiscount] = useState(true)
  const [partsDiscountPct, setPartsDiscountPct] = useState('')
  const [partsDiscountColor, setPartsDiscountColor] = useState('#1a7a30')

  // Maintenance — column defs
  type QuoteColDef = GeneralColDef
  const [maintColDefs, setMaintColDefs] = useState<QuoteColDef[]>([
    { key: 'sno',         label: 'S.No',       visible: true, width: 52  },
    { key: 'item',        label: 'Item',        visible: true, width: 110 },
    { key: 'description', label: 'Description', visible: true, width: 220 },
    { key: 'width',       label: 'Width',       visible: true, width: 75  },
    { key: 'height',      label: 'Height',      visible: true, width: 75  },
    { key: 'qty',         label: 'Qty',         visible: true, width: 65  },
    { key: 'unitPrice',   label: 'Unit Price',  visible: true, width: 110 },
    { key: 'total',       label: 'Total',       visible: true, width: 100 },
  ])
  const [maintNotesOpen, setMaintNotesOpen] = useState<Set<number>>(new Set())
  const [maintDragColKey, setMaintDragColKey] = useState<string | null>(null)
  const [maintEditingColKey, setMaintEditingColKey] = useState<string | null>(null)
  const [addingMaintCol, setAddingMaintCol] = useState(false)
  const [newMaintColName, setNewMaintColName] = useState('')

  function toggleMaintCol(key: string) { setMaintColDefs(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c)) }
  function renameMaintCol(key: string, label: string) { setMaintColDefs(prev => prev.map(c => c.key === key ? { ...c, label } : c)) }
  function reorderMaintCols(fromKey: string, toKey: string) {
    if (fromKey === toKey) return
    setMaintColDefs(prev => { const a = [...prev]; const fi = a.findIndex(c => c.key === fromKey); const ti = a.findIndex(c => c.key === toKey); const [m] = a.splice(fi, 1); a.splice(ti, 0, m); return a })
  }
  function addMaintCol(label: string) {
    const key = `extra_${Date.now()}`
    setMaintColDefs(prev => { const a = [...prev]; a.splice(a.findIndex(c => c.key === 'total'), 0, { key, label, visible: true, width: 100 }); return a })
  }
  function removeMaintCol(key: string) { setMaintColDefs(prev => prev.filter(c => c.key !== key)) }

  // Parts — column defs
  const [partsColDefs, setPartsColDefs] = useState<QuoteColDef[]>([
    { key: 'sno',         label: 'S.No',       visible: true, width: 52  },
    { key: 'item',        label: 'Item',        visible: true, width: 110 },
    { key: 'description', label: 'Description', visible: true, width: 220 },
    { key: 'width',       label: 'Width',       visible: true, width: 75  },
    { key: 'height',      label: 'Height',      visible: true, width: 75  },
    { key: 'qty',         label: 'Qty',         visible: true, width: 65  },
    { key: 'unitPrice',   label: 'Unit Price',  visible: true, width: 110 },
    { key: 'total',       label: 'Total',       visible: true, width: 100 },
  ])
  const [partsNotesOpen, setPartsNotesOpen] = useState<Set<number>>(new Set())
  const [partsDragColKey, setPartsDragColKey] = useState<string | null>(null)
  const [partsEditingColKey, setPartsEditingColKey] = useState<string | null>(null)
  const [addingPartsCol, setAddingPartsCol] = useState(false)
  const [newPartsColName, setNewPartsColName] = useState('')

  function togglePartsCol(key: string) { setPartsColDefs(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c)) }
  function renamePartsCol(key: string, label: string) { setPartsColDefs(prev => prev.map(c => c.key === key ? { ...c, label } : c)) }
  function reorderPartsCols(fromKey: string, toKey: string) {
    if (fromKey === toKey) return
    setPartsColDefs(prev => { const a = [...prev]; const fi = a.findIndex(c => c.key === fromKey); const ti = a.findIndex(c => c.key === toKey); const [m] = a.splice(fi, 1); a.splice(ti, 0, m); return a })
  }
  function addPartsCol(label: string) {
    const key = `extra_${Date.now()}`
    setPartsColDefs(prev => { const a = [...prev]; a.splice(a.findIndex(c => c.key === 'total'), 0, { key, label, visible: true, width: 100 }); return a })
  }
  function removePartsCol(key: string) { setPartsColDefs(prev => prev.filter(c => c.key !== key)) }

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
        maintQuoteNumberRef.current = qn
        setQuoteNumber(qn)
      } else {
        maintQuoteNumberRef.current = quoteNumberRef.current
      }
      const filled = maintItems.filter(it => it.item.trim() || it.unitPrice > 0)
      const maintVisCols = maintColDefs.filter(c => c.visible).map(c => ({ key: c.key, label: c.label, width: c.width }))
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
          lineItems: filled.map(it => ({ ...it, extras: it.extras ?? {} })),
          visibleColumns: maintVisCols,
          discountPct: showMaintDiscount ? (parseFloat(maintDiscountPct) || undefined) : undefined,
          discountColor: (showMaintDiscount && parseFloat(maintDiscountPct) > 0) ? maintDiscountColor : undefined,
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
        partsQuoteNumberRef.current = qn
        setQuoteNumber(qn)
      } else {
        partsQuoteNumberRef.current = quoteNumberRef.current
      }
      const filled = partsItems.filter(it => it.item.trim() || it.unitPrice > 0)
      const partsVisCols = partsColDefs.filter(c => c.visible).map(c => ({ key: c.key, label: c.label, width: c.width }))
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
          lineItems: filled.map(it => ({ ...it, extras: it.extras ?? {} })),
          visibleColumns: partsVisCols,
          discountPct: showPartsDiscount ? (parseFloat(partsDiscountPct) || undefined) : undefined,
          discountColor: (showPartsDiscount && parseFloat(partsDiscountPct) > 0) ? partsDiscountColor : undefined,
          terms: partsTerms || DEFAULT_PARTS_TERMS,
          endUser: partsEndUser || undefined,
          tcType: partsTcType,
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

  // ── Maintenance save/load ─────────────────────────────────────────────────

  function buildMaintSnapshot() {
    return {
      maintItems, maintTerms, maintEndUser,
      maintSenderName, maintSenderAddress, maintSenderEmail,
      maintContactName, maintContactPhone, maintContactEmail,
      custName, custAttn, custAddress, custPostcode, custPhone, custEmail, custCanBeBlank,
    }
  }

  async function handleSaveMaintenance() {
    setMaintSaveMsg(null)
    try {
      if (!maintQuoteNumberRef.current) {
        const r = await fetch('/api/quotes/next-number?prefix=QREP')
        if (!r.ok) throw new Error('Failed to allocate quote number')
        const { quoteNumber: qn } = await r.json() as { quoteNumber: string }
        maintQuoteNumberRef.current = qn
        quoteNumberRef.current = qn
        setQuoteNumber(qn)
      }
      const qn = maintQuoteNumberRef.current!
      const subtotal = maintItems.reduce((s, it) => s + it.unitPrice * it.qty, 0)
      const validDate = new Date(); validDate.setDate(validDate.getDate() + 30)
      const validUntil = `${String(validDate.getDate()).padStart(2,'0')}/${String(validDate.getMonth()+1).padStart(2,'0')}/${validDate.getFullYear()}`

      const res = await fetch('/api/quotes/maintenance/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: maintQuoteIdRef.current ?? undefined,
          quoteNumber: qn, date: todayISO(), validUntil: displayToISO(validUntil),
          customerName: custName, customerAddress: custAddress,
          subtotal, endUser: maintEndUser || undefined,
          formSnapshot: buildMaintSnapshot(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      if (json.quoteId && !maintQuoteIdRef.current) maintQuoteIdRef.current = json.quoteId
      setMaintSaveMsg({ ok: true, text: `Saved as ${qn}` })
      loadRecentMaintQuotes()
    } catch (e) {
      setMaintSaveMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' })
    }
  }

  function loadRecentMaintQuotes() {
    setRecentMaintLoading(true)
    fetch('/api/quotes/maintenance/list?limit=10')
      .then(r => r.json())
      .then(j => { if (j.ok) setRecentMaintQuotes(j.data) })
      .catch(() => {})
      .finally(() => setRecentMaintLoading(false))
  }

  function loadMaintQuote(row: SavedQuoteRow) {
    const snap = row.form_snapshot
    if (!snap) return
    maintQuoteIdRef.current     = row.id
    maintQuoteNumberRef.current = row.quote_number
    quoteNumberRef.current      = row.quote_number
    setEditingId(row.id)
    setIsReadOnly(true)
    setPendingAutoGenerate('maint')
    setQuoteNumber(row.quote_number)
    setShowPreview(false); setPreviewUrl(null); setMaintSaveMsg(null)
    if (snap.maintItems)          setMaintItems(snap.maintItems as typeof maintItems)
    if (snap.maintTerms !== undefined) setMaintTerms(snap.maintTerms as string)
    if (snap.maintEndUser)        setMaintEndUser(snap.maintEndUser as typeof maintEndUser)
    if (snap.maintSenderName)     setMaintSenderName(snap.maintSenderName as string)
    if (snap.maintSenderAddress)  setMaintSenderAddress(snap.maintSenderAddress as string)
    if (snap.maintSenderEmail)    setMaintSenderEmail(snap.maintSenderEmail as string)
    if (snap.maintContactName)    setMaintContactName(snap.maintContactName as string)
    if (snap.maintContactPhone)   setMaintContactPhone(snap.maintContactPhone as string)
    if (snap.maintContactEmail)   setMaintContactEmail(snap.maintContactEmail as string)
    if (snap.custName !== undefined)     setCustName(snap.custName as string)
    if (snap.custAttn !== undefined)     setCustAttn(snap.custAttn as string)
    if (snap.custAddress !== undefined)  setCustAddress(snap.custAddress as string)
    if (snap.custPostcode !== undefined) setCustPostcode(snap.custPostcode as string)
    if (snap.custPhone !== undefined)    setCustPhone(snap.custPhone as string)
    if (snap.custEmail !== undefined)    setCustEmail(snap.custEmail as string)
    if (snap.custCanBeBlank !== undefined) setCustCanBeBlank(snap.custCanBeBlank as boolean)
    setSelected('MAINTENANCE_SERVICE_REPAIR')
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
  }

  // ── Parts save/load ───────────────────────────────────────────────────────

  function buildPartsSnapshot() {
    return {
      partsItems, partsTerms, partsEndUser, partsTcType,
      partsSenderName, partsSenderAddress, partsSenderEmail,
      partsContactName, partsContactPhone, partsContactEmail,
      custName, custAttn, custAddress, custPostcode, custPhone, custEmail, custCanBeBlank,
    }
  }

  async function handleSaveParts() {
    setPartsSaveMsg(null)
    try {
      if (!partsQuoteNumberRef.current) {
        const r = await fetch('/api/quotes/next-number?prefix=QPTS')
        if (!r.ok) throw new Error('Failed to allocate quote number')
        const { quoteNumber: qn } = await r.json() as { quoteNumber: string }
        partsQuoteNumberRef.current = qn
        quoteNumberRef.current = qn
        setQuoteNumber(qn)
      }
      const qn = partsQuoteNumberRef.current!
      const subtotal = partsItems.reduce((s, it) => s + it.unitPrice * it.qty, 0)
      const validDate = new Date(); validDate.setDate(validDate.getDate() + 30)
      const validUntil = `${String(validDate.getDate()).padStart(2,'0')}/${String(validDate.getMonth()+1).padStart(2,'0')}/${validDate.getFullYear()}`

      const res = await fetch('/api/quotes/parts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: partsQuoteIdRef.current ?? undefined,
          quoteNumber: qn, date: todayISO(), validUntil: displayToISO(validUntil),
          customerName: custName, customerAddress: custAddress,
          subtotal, endUser: partsEndUser || undefined,
          formSnapshot: buildPartsSnapshot(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      if (json.quoteId && !partsQuoteIdRef.current) partsQuoteIdRef.current = json.quoteId
      setPartsSaveMsg({ ok: true, text: `Saved as ${qn}` })
      loadRecentPartsQuotes()
    } catch (e) {
      setPartsSaveMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' })
    }
  }

  function loadRecentPartsQuotes() {
    setRecentPartsLoading(true)
    fetch('/api/quotes/parts/list?limit=10')
      .then(r => r.json())
      .then(j => { if (j.ok) setRecentPartsQuotes(j.data) })
      .catch(() => {})
      .finally(() => setRecentPartsLoading(false))
  }

  function loadPartsQuote(row: SavedQuoteRow) {
    const snap = row.form_snapshot
    if (!snap) return
    partsQuoteIdRef.current     = row.id
    partsQuoteNumberRef.current = row.quote_number
    quoteNumberRef.current      = row.quote_number
    setEditingId(row.id)
    setIsReadOnly(true)
    setPendingAutoGenerate('parts')
    setQuoteNumber(row.quote_number)
    setShowPreview(false); setPreviewUrl(null); setPartsSaveMsg(null)
    if (snap.partsItems)          setPartsItems(snap.partsItems as typeof partsItems)
    if (snap.partsTerms !== undefined) setPartsTerms(snap.partsTerms as string)
    if (snap.partsEndUser)        setPartsEndUser(snap.partsEndUser as typeof partsEndUser)
    if (snap.partsTcType)         setPartsTcType(snap.partsTcType as typeof partsTcType)
    if (snap.partsSenderName)     setPartsSenderName(snap.partsSenderName as string)
    if (snap.partsSenderAddress)  setPartsSenderAddress(snap.partsSenderAddress as string)
    if (snap.partsSenderEmail)    setPartsSenderEmail(snap.partsSenderEmail as string)
    if (snap.partsContactName)    setPartsContactName(snap.partsContactName as string)
    if (snap.partsContactPhone)   setPartsContactPhone(snap.partsContactPhone as string)
    if (snap.partsContactEmail)   setPartsContactEmail(snap.partsContactEmail as string)
    if (snap.custName !== undefined)     setCustName(snap.custName as string)
    if (snap.custAttn !== undefined)     setCustAttn(snap.custAttn as string)
    if (snap.custAddress !== undefined)  setCustAddress(snap.custAddress as string)
    if (snap.custPostcode !== undefined) setCustPostcode(snap.custPostcode as string)
    if (snap.custPhone !== undefined)    setCustPhone(snap.custPhone as string)
    if (snap.custEmail !== undefined)    setCustEmail(snap.custEmail as string)
    if (snap.custCanBeBlank !== undefined) setCustCanBeBlank(snap.custCanBeBlank as boolean)
    setSelected('PARTS')
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
  }

  async function handleGenerateGeneral() {
    setGenerating(true)
    try {
      if (!quoteNumberRef.current) {
        const res = await fetch('/api/quotes/next-number?prefix=QGEN')
        if (!res.ok) throw new Error('Failed to allocate quote number')
        const { quoteNumber: qn } = await res.json() as { quoteNumber: string }
        quoteNumberRef.current = qn
        generalQuoteNumberRef.current = qn
        setQuoteNumber(qn)
      } else {
        generalQuoteNumberRef.current = quoteNumberRef.current
      }
      const filled = generalItems.filter(it => it.item.trim() || it.unitPrice > 0)
      const validDate = new Date(); validDate.setDate(validDate.getDate() + 30)
      const validUntil = `${String(validDate.getDate()).padStart(2,'0')}/${String(validDate.getMonth()+1).padStart(2,'0')}/${validDate.getFullYear()}`
      const visCols = generalColDefs.filter(c => c.visible).map(c => ({ key: c.key, label: c.label, width: c.width }))
      const res = await fetch('/api/quotes/general/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteNumber: quoteNumberRef.current,
          date: todayDisplay(), validUntil,
          customerName: custName, customerAttn: custAttn,
          customerAddress: custAddress, customerPostcode: custPostcode,
          customerPhone: custPhone, customerEmail: custEmail,
          lineItems: filled.map(it => ({ ...it, extras: it.extras ?? {} })),
          visibleColumns: visCols,
          discountPct: showGeneralDiscount ? (parseFloat(generalDiscountPct) || undefined) : undefined,
          discountColor: (showGeneralDiscount && parseFloat(generalDiscountPct) > 0) ? generalDiscountColor : undefined,
          terms: generalTerms || DEFAULT_GENERAL_TERMS,
          endUser: generalEndUser || undefined,
          tcType: generalTcType,
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

  // ── General quote save/load ────────────────────────────────────────────────

  function buildGeneralSnapshot() {
    return {
      generalItems, generalColDefs,
      showGeneralDiscount, generalDiscountPct, generalDiscountColor,
      generalTerms, generalEndUser, generalTcType,
      generalSenderName, generalSenderAddress, generalSenderEmail,
      generalContactName, generalContactPhone, generalContactEmail,
      custName, custAttn, custAddress, custPostcode, custPhone, custEmail, custCanBeBlank,
    }
  }

  async function handleSaveGeneral() {
    setGeneralSaveMsg(null)
    try {
      if (!generalQuoteNumberRef.current) {
        // Allocate a quote number if not yet generated
        const r = await fetch('/api/quotes/next-number?prefix=QGEN')
        if (!r.ok) throw new Error('Failed to allocate quote number')
        const { quoteNumber: qn } = await r.json() as { quoteNumber: string }
        generalQuoteNumberRef.current = qn
        setQuoteNumber(qn)
      }
      const qn = generalQuoteNumberRef.current!
      const subtotal = generalItems.reduce((s, it) => {
        const price = it.overridePrice ? parseFloat(it.overridePrice) || 0 : it.unitPrice
        const disc  = parseFloat(it.discount ?? '') || 0
        return s + price * (1 - disc / 100) * it.qty
      }, 0)
      const discPct = showGeneralDiscount ? (parseFloat(generalDiscountPct) || 0) : 0
      const validDate = new Date(); validDate.setDate(validDate.getDate() + 30)
      const validUntil = `${String(validDate.getDate()).padStart(2,'0')}/${String(validDate.getMonth()+1).padStart(2,'0')}/${validDate.getFullYear()}`

      const res = await fetch('/api/quotes/general/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId:         generalQuoteIdRef.current ?? undefined,
          quoteNumber:     qn,
          date:            todayISO(),
          validUntil:      displayToISO(validUntil),
          customerName:    custName,
          customerAttn:    custAttn,
          customerAddress: custAddress,
          customerPostcode:custPostcode,
          customerPhone:   custPhone,
          customerEmail:   custEmail,
          subtotal,
          discountPct:     discPct,
          endUser:         generalEndUser || undefined,
          formSnapshot:    buildGeneralSnapshot(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      if (json.quoteId && !generalQuoteIdRef.current) generalQuoteIdRef.current = json.quoteId
      setGeneralSaveMsg({ ok: true, text: `Saved as ${qn}` })
      // Refresh recent list
      loadRecentGeneralQuotes()
    } catch (e) {
      setGeneralSaveMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' })
    }
  }

  function loadRecentGeneralQuotes() {
    setRecentGeneralLoading(true)
    fetch('/api/quotes/general/list?limit=10')
      .then(r => r.json())
      .then(j => { if (j.ok) setRecentGeneralQuotes(j.data) })
      .catch(() => {})
      .finally(() => setRecentGeneralLoading(false))
  }

  function loadGeneralQuote(row: GeneralRecentRow) {
    const snap = row.form_snapshot
    if (!snap) return
    // Restore quote identifiers
    generalQuoteIdRef.current     = row.id
    generalQuoteNumberRef.current = row.quote_number
    quoteNumberRef.current        = row.quote_number
    setEditingId(row.id)
    setIsReadOnly(true)
    setPendingAutoGenerate('general')
    setQuoteNumber(row.quote_number)
    setShowPreview(false)
    setPreviewUrl(null)
    setGeneralSaveMsg(null)
    // Restore full form state from snapshot
    if (snap.generalItems)           setGeneralItems(snap.generalItems as typeof generalItems)
    if (snap.generalColDefs)         setGeneralColDefs(snap.generalColDefs as typeof generalColDefs)
    if (snap.showGeneralDiscount !== undefined) setShowGeneralDiscount(snap.showGeneralDiscount as boolean)
    if (snap.generalDiscountPct)     setGeneralDiscountPct(snap.generalDiscountPct as string)
    if (snap.generalDiscountColor)   setGeneralDiscountColor(snap.generalDiscountColor as string)
    if (snap.generalTerms !== undefined) setGeneralTerms(snap.generalTerms as string)
    if (snap.generalEndUser)         setGeneralEndUser(snap.generalEndUser as typeof generalEndUser)
    if (snap.generalTcType)          setGeneralTcType(snap.generalTcType as typeof generalTcType)
    if (snap.generalSenderName)      setGeneralSenderName(snap.generalSenderName as string)
    if (snap.generalSenderAddress)   setGeneralSenderAddress(snap.generalSenderAddress as string)
    if (snap.generalSenderEmail)     setGeneralSenderEmail(snap.generalSenderEmail as string)
    if (snap.generalContactName)     setGeneralContactName(snap.generalContactName as string)
    if (snap.generalContactPhone)    setGeneralContactPhone(snap.generalContactPhone as string)
    if (snap.generalContactEmail)    setGeneralContactEmail(snap.generalContactEmail as string)
    // Customer fields
    if (snap.custName !== undefined) setCustName(snap.custName as string)
    if (snap.custAttn !== undefined) setCustAttn(snap.custAttn as string)
    if (snap.custAddress !== undefined) setCustAddress(snap.custAddress as string)
    if (snap.custPostcode !== undefined) setCustPostcode(snap.custPostcode as string)
    if (snap.custPhone !== undefined) setCustPhone(snap.custPhone as string)
    if (snap.custEmail !== undefined) setCustEmail(snap.custEmail as string)
    if (snap.custCanBeBlank !== undefined) setCustCanBeBlank(snap.custCanBeBlank as boolean)
    // Switch to General tab and scroll to top
    setSelected('GENERAL')
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
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

  // ── PVC Flex save/load ───────────────────────────────────────────────────────

  function buildPvcFlexSnapshot() {
    return {
      savedPvcDoors,
      pvcW, pvcH, pvcStripW, pvcThick, pvcGrade, pvcProfile, pvcHanger,
      pvcSupply, pvcMount, pvcSliding, pvcRaisedHR, pvcQtyStr,
      pvcDiscountPct, pvcDelivery, pvcInstallation, pvcTerms, pvcEndUser,
      pvcSenderName, pvcSenderAddress, pvcSenderEmail,
      pvcContactName, pvcContactPhone, pvcContactEmail,
      custName, custAttn, custAddress, custPostcode, custPhone, custEmail, custCanBeBlank,
    }
  }

  async function handleSavePvcFlex() {
    setPvcFlexSaveMsg(null)
    try {
      if (!pvcFlexQuoteNumberRef.current) {
        const r = await fetch('/api/quotes/next-number?prefix=QPVC')
        if (!r.ok) throw new Error('Failed to allocate quote number')
        const { quoteNumber: qn } = await r.json() as { quoteNumber: string }
        pvcFlexQuoteNumberRef.current = qn
        quoteNumberRef.current = qn
        setQuoteNumber(qn)
      }
      const qn = pvcFlexQuoteNumberRef.current!

      const { calcPvcNewQuote, discountedSellPrice, autoRaisedHeadrailSize } = await import('@/lib/pvc/pvcNewQuoteCalculator')
      const discPct = parseFloat(pvcDiscountPct) || 0
      const activeDoor: PvcFlexDoorItem | null = pvcW && pvcH ? {
        id: 'active', openingW: pvcW, openingH: pvcH,
        stripWidth: pvcStripW, thickness: pvcThick, grade: pvcGrade, profile: pvcProfile,
        hanger: pvcHanger, supplyType: pvcSupply, mountingType: pvcMount,
        sliding: pvcSliding, raisedHeadrail: pvcRaisedHR, qty: parseInt(pvcQtyStr) || 1,
      } : null
      const allPvcDoors = [...savedPvcDoors, ...(activeDoor ? [activeDoor] : [])]
      const filledDoors = allPvcDoors.filter(d => d.openingW && d.openingH)
      const subtotal = filledDoors.reduce((sum, d) => {
        const raisedHR = d.raisedHeadrail
          ? autoRaisedHeadrailSize(parseFloat(d.openingW) || 0)
          : 'NA' as const
        const spec = {
          openingW: parseFloat(d.openingW) || 0, openingH: parseFloat(d.openingH) || 0,
          stripWidth: d.stripWidth, thickness: d.thickness, grade: d.grade, profile: d.profile,
          hanger: d.hanger, supplyType: d.supplyType, mountingType: d.mountingType,
          sliding: d.sliding, raisedHeadrail: raisedHR,
        }
        const calc = calcPvcNewQuote(spec)
        const unitPrice = discountedSellPrice(spec, calc, discPct)
        return sum + unitPrice * d.qty
      }, (parseFloat(pvcDelivery) || 0) + (parseFloat(pvcInstallation) || 0))

      const validDate = new Date(); validDate.setDate(validDate.getDate() + 30)
      const validUntil = `${String(validDate.getDate()).padStart(2,'0')}/${String(validDate.getMonth()+1).padStart(2,'0')}/${validDate.getFullYear()}`

      const res = await fetch('/api/quotes/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: pvcFlexQuoteIdRef.current ?? undefined,
          quoteNumber: qn, date: todayISO(), validUntil: displayToISO(validUntil),
          customerName: custName, customerAddress: custAddress,
          subtotal, endUser: pvcEndUser || undefined,
          formSnapshot: buildPvcFlexSnapshot(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      if (json.quoteId && !pvcFlexQuoteIdRef.current) pvcFlexQuoteIdRef.current = json.quoteId
      setPvcFlexSaveMsg({ ok: true, text: `Saved as ${qn}` })
      loadRecentPvcFlexQuotes()
    } catch (e) {
      setPvcFlexSaveMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' })
    }
  }

  function loadRecentPvcFlexQuotes() {
    setRecentPvcFlexLoading(true)
    fetch('/api/quotes/list?kind=pvc_flex&limit=10')
      .then(r => r.json())
      .then(j => { if (j.ok) setRecentPvcFlexQuotes(j.data) })
      .catch(() => {})
      .finally(() => setRecentPvcFlexLoading(false))
  }

  function loadPvcFlexQuote(row: SavedQuoteRow) {
    const snap = row.form_snapshot
    if (!snap) return
    pvcFlexQuoteIdRef.current     = row.id
    pvcFlexQuoteNumberRef.current = row.quote_number
    quoteNumberRef.current        = row.quote_number
    setEditingId(row.id)
    setIsReadOnly(true)
    setPendingAutoGenerate('pvcflex')
    setQuoteNumber(row.quote_number)
    setShowPreview(false); setPreviewUrl(null); setPvcFlexSaveMsg(null)
    if (snap.savedPvcDoors)      setSavedPvcDoors(snap.savedPvcDoors as typeof savedPvcDoors)
    if (snap.pvcW !== undefined) setPvcW(snap.pvcW as string)
    if (snap.pvcH !== undefined) setPvcH(snap.pvcH as string)
    if (snap.pvcStripW)          setPvcStripW(snap.pvcStripW as number)
    if (snap.pvcThick)           setPvcThick(snap.pvcThick as number)
    if (snap.pvcGrade)           setPvcGrade(snap.pvcGrade as typeof pvcGrade)
    if (snap.pvcProfile)         setPvcProfile(snap.pvcProfile as typeof pvcProfile)
    if (snap.pvcHanger)          setPvcHanger(snap.pvcHanger as typeof pvcHanger)
    if (snap.pvcSupply)          setPvcSupply(snap.pvcSupply as typeof pvcSupply)
    if (snap.pvcMount)           setPvcMount(snap.pvcMount as typeof pvcMount)
    if (snap.pvcSliding)         setPvcSliding(snap.pvcSliding as typeof pvcSliding)
    if (snap.pvcRaisedHR !== undefined) setPvcRaisedHR(snap.pvcRaisedHR as boolean)
    if (snap.pvcQtyStr)          setPvcQtyStr(snap.pvcQtyStr as string)
    if (snap.pvcDiscountPct !== undefined) setPvcDiscountPct(snap.pvcDiscountPct as string)
    if (snap.pvcDelivery !== undefined)    setPvcDelivery(snap.pvcDelivery as string)
    if (snap.pvcInstallation !== undefined) setPvcInstallation(snap.pvcInstallation as string)
    if (snap.pvcTerms !== undefined)       setPvcTerms(snap.pvcTerms as string)
    if (snap.pvcEndUser)                   setPvcEndUser(snap.pvcEndUser as typeof pvcEndUser)
    if (snap.pvcSenderName)      setPvcSenderName(snap.pvcSenderName as string)
    if (snap.pvcSenderAddress)   setPvcSenderAddress(snap.pvcSenderAddress as string)
    if (snap.pvcSenderEmail)     setPvcSenderEmail(snap.pvcSenderEmail as string)
    if (snap.pvcContactName)     setPvcContactName(snap.pvcContactName as string)
    if (snap.pvcContactPhone)    setPvcContactPhone(snap.pvcContactPhone as string)
    if (snap.pvcContactEmail)    setPvcContactEmail(snap.pvcContactEmail as string)
    if (snap.custName !== undefined)     setCustName(snap.custName as string)
    if (snap.custAttn !== undefined)     setCustAttn(snap.custAttn as string)
    if (snap.custAddress !== undefined)  setCustAddress(snap.custAddress as string)
    if (snap.custPostcode !== undefined) setCustPostcode(snap.custPostcode as string)
    if (snap.custPhone !== undefined)    setCustPhone(snap.custPhone as string)
    if (snap.custEmail !== undefined)    setCustEmail(snap.custEmail as string)
    if (snap.custCanBeBlank !== undefined) setCustCanBeBlank(snap.custCanBeBlank as boolean)
    setSelected('PVC_FLEX_SYSTEM')
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
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
            date: todayISO(), validUntil: displayToISO(validUntil),
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
    a.download = `${quoteNumber}_${safeCust}.pdf`
    a.click()
  }

  function handleEditQuote() {
    setIsReadOnly(false)
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

        {/* Grouped quote sections */}
        {recentLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
            <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
            <span className="text-sm">Loading quotes…</span>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
            <span className="material-symbols-outlined text-5xl text-slate-300">receipt_long</span>
            <p className="text-sm font-medium">
              {search.trim() ? 'No quotes match your search' : 'No quotes yet'}
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
          <div className="space-y-3">
            {([
              { kind: 'rapid_door',  label: 'Rapid Roller Door',       icon: 'garage',        accent: 'indigo' },
              { kind: 'general',     label: 'General',                  icon: 'description',   accent: 'violet' },
              { kind: 'maintenance', label: 'Maintenance Service/Repair',icon: 'build',         accent: 'orange' },
              { kind: 'parts',       label: 'Parts',                    icon: 'inventory_2',   accent: 'emerald' },
              { kind: 'pvc_flex',    label: 'PVC Flex System',          icon: 'view_column',   accent: 'sky' },
            ] as { kind: string; label: string; icon: string; accent: string }[]).map(({ kind, label, icon, accent }) => {
              const allRows = filteredQuotes.filter(q => q.quote_kind === kind)
              if (allRows.length === 0 && search.trim()) return null
              const open = groupsOpen[kind] !== false
              const activeFilter = groupFilters[kind] ?? 'all'
              const rows = sortAndFilterRows(allRows, kind)
              const accentMap: Record<string, string> = {
                indigo:  'bg-indigo-50 border-indigo-200 text-indigo-700',
                violet:  'bg-violet-50 border-violet-200 text-violet-700',
                orange:  'bg-orange-50 border-orange-200 text-orange-700',
                emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                sky:     'bg-sky-50 border-sky-200 text-sky-700',
              }
              const headerMap: Record<string, string> = {
                indigo:  'bg-indigo-600',
                violet:  'bg-violet-600',
                orange:  'bg-orange-500',
                emerald: 'bg-emerald-600',
                sky:     'bg-sky-600',
              }
              return (
                <div key={kind} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  {/* Group header */}
                  <button type="button" onClick={() => toggleGroup(kind)}
                    className={`w-full flex items-center justify-between px-5 py-3.5 ${headerMap[accent]} text-white transition hover:opacity-90`}>
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px]">{icon}</span>
                      <span className="text-sm font-semibold">{label}</span>
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{allRows.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={e => { if (open) toggleFilterMenu(kind, e) }} disabled={!open}
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${open ? 'bg-white/15 hover:bg-white/25' : 'opacity-40 cursor-not-allowed'}`}>
                          <span className="material-symbols-outlined text-[11px]">filter_list</span>
                          {activeFilter === 'all' ? 'All' : activeFilter === 'active' ? 'Active' : 'Completed'}
                          {activeFilter !== 'all' && <span className="ml-0.5 opacity-70">({rows.length})</span>}
                          <span className="material-symbols-outlined text-[11px]">expand_more</span>
                        </button>
                        {filterMenuOpen === kind && (
                          <div className="absolute right-0 top-full mt-1 z-30 min-w-[130px] rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                            {([
                              { value: 'all',       label: 'All',       icon: 'list' },
                              { value: 'active',    label: 'Active',    icon: 'pending' },
                              { value: 'completed', label: 'Completed', icon: 'check_circle' },
                            ]).map(opt => (
                              <button key={opt.value} type="button" onClick={e => setGroupFilter(kind, opt.value, e)}
                                className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition hover:bg-slate-50 ${activeFilter === opt.value ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}>
                                <span className="material-symbols-outlined text-[14px]">{opt.icon}</span>
                                {opt.label}
                                {activeFilter === opt.value && <span className="material-symbols-outlined ml-auto text-[13px] text-indigo-500">check</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="material-symbols-outlined text-[20px]">{open ? 'expand_less' : 'expand_more'}</span>
                    </div>
                  </button>

                  {/* Rows */}
                  {open && (
                    rows.length === 0 ? (
                      <div className="px-5 py-6 text-center text-sm text-slate-400">
                        {activeFilter !== 'all' ? `No ${activeFilter} ${label.toLowerCase()} quotes` : `No ${label.toLowerCase()} quotes yet`}
                      </div>
                    ) : (
                      <>
                        {/* Desktop */}
                        <div className="hidden overflow-x-auto xl:block">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                                <th className="px-6 py-2.5">Quote #</th>
                                <th className="px-4 py-2.5">Customer</th>
                                <th className="px-4 py-2.5">Address</th>
                                <th className="px-4 py-2.5">Date</th>
                                <th className="px-4 py-2.5">Total (inc. GST)</th>
                                <th className="px-4 py-2.5">Status</th>
                                <th className="px-4 py-2.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(q => {
                                const [y, m, d] = (q.service_date ?? '').split('-')
                                const dateStr = y ? `${d}/${m}/${y}` : '—'
                                return (
                                  <tr key={q.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition">
                                    <td className="px-6 py-3 font-mono text-xs font-semibold text-indigo-700">{q.quote_number}</td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{q.customer_name || <span className="text-slate-400 italic font-normal">No customer</span>}</td>
                                    <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate">{q.site_address || '—'}</td>
                                    <td className="px-4 py-3 text-slate-500">{dateStr}</td>
                                    <td className="px-4 py-3 font-semibold text-slate-800">${Number(q.total ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3">
                                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${accentMap[accent]}`}>
                                        {(q.workflow_status ?? 'draft').replace(/_/g, ' ')}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-end gap-1.5">
                                        {kind !== 'rapid_door' && (
                                          <button type="button" onClick={() => openWorkflowModal(q.id)}
                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition">
                                            <span className="material-symbols-outlined text-[13px]">timeline</span>Workflow
                                          </button>
                                        )}
                                        {kind !== 'rapid_door' && (
                                          <button type="button" onClick={() => openPdfFromList(q)}
                                            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 transition">
                                            <span className="material-symbols-outlined text-[13px]">picture_as_pdf</span>PDF
                                          </button>
                                        )}
                                        <button type="button" onClick={() => openQuoteFromList(q)}
                                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition">
                                          <span className="material-symbols-outlined text-[13px]">edit</span>Open
                                        </button>
                                        {(() => {
                                          const isDraft = ['draft', 'draft_review'].includes(q.workflow_status ?? '')
                                          return (
                                            <button
                                              type="button"
                                              disabled={!isDraft}
                                              onClick={() => { setDeleteConfirmRow(q); setDeleteError(null) }}
                                              title={isDraft ? 'Delete this draft' : `Cannot delete — status is "${q.workflow_status}"`}
                                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${isDraft ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'}`}>
                                              <span className="material-symbols-outlined text-[13px]">delete</span>Delete
                                            </button>
                                          )
                                        })()}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        {/* Mobile */}
                        <ul className="divide-y divide-slate-100 xl:hidden">
                          {rows.map(q => {
                            const [y, m, d] = (q.service_date ?? '').split('-')
                            const dateStr = y ? `${d}/${m}/${y}` : '—'
                            return (
                              <li key={q.id} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition">
                                <div className="min-w-0 flex-1">
                                  <p className="font-mono text-xs font-semibold text-indigo-700">{q.quote_number}</p>
                                  <p className="mt-0.5 text-sm font-medium text-slate-800">{q.customer_name || <span className="text-slate-400 italic font-normal">No customer</span>}</p>
                                  <p className="mt-0.5 text-xs text-slate-500">{dateStr}</p>
                                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                    {kind !== 'rapid_door' && (
                                      <button type="button" onClick={() => openWorkflowModal(q.id)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition">
                                        <span className="material-symbols-outlined text-[13px]">timeline</span>Workflow
                                      </button>
                                    )}
                                    {kind !== 'rapid_door' && (
                                      <button type="button" onClick={() => openPdfFromList(q)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 transition">
                                        <span className="material-symbols-outlined text-[13px]">picture_as_pdf</span>PDF
                                      </button>
                                    )}
                                    <button type="button" onClick={() => openQuoteFromList(q)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition">
                                      <span className="material-symbols-outlined text-[13px]">edit</span>Open
                                    </button>
                                    {(() => {
                                      const isDraft = ['draft', 'draft_review'].includes(q.workflow_status ?? '')
                                      return (
                                        <button
                                          type="button"
                                          disabled={!isDraft}
                                          onClick={() => { setDeleteConfirmRow(q); setDeleteError(null) }}
                                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${isDraft ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'}`}>
                                          <span className="material-symbols-outlined text-[13px]">delete</span>Delete
                                        </button>
                                      )
                                    })()}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-semibold text-slate-800">${Number(q.total ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
                                  <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${accentMap[accent]}`}>
                                    {(q.workflow_status ?? 'draft').replace(/_/g, ' ')}
                                  </span>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </>
                    )
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteConfirmRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => { if (!deleteInProgress) { setDeleteConfirmRow(null); setDeleteError(null) } }}>
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-4 p-6">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <span className="material-symbols-outlined text-[20px] text-red-600">warning</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-slate-900">Delete Quote?</h2>
                  <p className="mt-1.5 text-sm text-slate-600">
                    You are about to permanently delete quote{' '}
                    <span className="font-mono font-semibold text-indigo-700">{deleteConfirmRow.quote_number}</span>
                    {deleteConfirmRow.customer_name ? ` for ${deleteConfirmRow.customer_name}` : ''}.
                    This action cannot be undone.
                  </p>
                  {deleteError && (
                    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{deleteError}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-6 py-4">
                <button type="button" disabled={deleteInProgress}
                  onClick={() => { setDeleteConfirmRow(null); setDeleteError(null) }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition">
                  Cancel
                </button>
                <button type="button" disabled={deleteInProgress}
                  onClick={() => handleDeleteQuote(deleteConfirmRow.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition">
                  {deleteInProgress
                    ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Deleting…</>
                    : <><span className="material-symbols-outlined text-[14px]">delete</span>Yes, Delete</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workflow modal — reuses the existing Quote approval workflow */}
        {workflowQuoteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeWorkflowModal}>
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-800">Quote Workflow</h2>
                <button type="button" onClick={closeWorkflowModal}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <div className="p-5">
                {workflowLoading && !workflowState ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                    <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                    <span className="text-sm">Loading workflow…</span>
                  </div>
                ) : (
                  <ServiceQuoteWorkflowPanel
                    quoteId={workflowQuoteId}
                    workflow={workflowState}
                    isManager={isWorkflowManager}
                    onUpdated={() => { loadWorkflowState(workflowQuoteId); loadRecentQuotes() }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Form header with back button */}
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => { loadRecentQuotes(); closeWorkflowModal(); setView('list') }}
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
      <div className={`${showRightPanel ? 'flex gap-3 items-stretch' : (isMaintenance || isGeneral || isParts || isPvcFlex) ? 'block w-full' : 'max-w-2xl'}`}>

        {/* ── LEFT: form card ─────────────────────────────────────────────── */}
        <div className={`${showRightPanel ? 'flex-1 min-w-0' : 'w-full'} rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col`}>
          <div className="border-b border-slate-100 px-6 py-3">
            <h2 className="text-base font-semibold text-slate-800">
              {savedDoors.length > 0 ? `Add Door ${savedDoors.length + 1}` : 'Start a New Quote'}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">Select the type of quotation you want to create</p>
          </div>

          <div className="px-6 py-3 space-y-3">

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
              const maintRowTotalFn = (it: MaintItem) => { const base = it.overridePrice ? parseFloat(it.overridePrice) || 0 : it.qty * it.unitPrice; const disc = it.discount ? parseFloat(it.discount) || 0 : 0; return disc > 0 ? base * (1 - disc / 100) : base }
              const maintSubtotal = maintItems.reduce((s, it) => s + maintRowTotalFn(it), 0)
              const discPctM = showMaintDiscount ? (parseFloat(maintDiscountPct) || 0) : 0
              const maintAfterDiscount = maintSubtotal * (1 - discPctM / 100)
              const fmtM = (n: number) => n === 0 ? '$0.00' : `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              return (
                <div className={`space-y-0 divide-y divide-slate-100${formLocked ? ' pointer-events-none opacity-75 select-none' : ''}`}>
                  {formLocked && (
                    <div className="pointer-events-auto flex items-center justify-between gap-3 bg-amber-50 px-6 py-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                        <span className="material-symbols-outlined text-[15px]">lock</span>
                        Read-only — viewing saved quote
                      </div>
                      <button type="button" onClick={() => { setIsReadOnly(false); setShowPreview(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 transition">
                        <span className="material-symbols-outlined text-[15px]">edit</span>Edit Quote
                      </button>
                    </div>
                  )}

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

                  {/* ── Line Items (dynamic columns) ── */}
                  {(() => {
                    const maintRowTotal = (it: MaintItem) => {
                      const base = it.overridePrice ? parseFloat(it.overridePrice) || 0 : it.qty * it.unitPrice
                      const disc = it.discount ? parseFloat(it.discount) || 0 : 0
                      return disc > 0 ? base * (1 - disc / 100) : base
                    }
                    return (
                  <div className="pt-4 pb-2">
                    {/* Column visibility toggles + Add Column */}
                    <div className="px-6 mb-3 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mr-1">Columns:</span>
                      {maintColDefs.map(col => (
                        <span key={col.key} className="inline-flex items-center gap-0.5">
                          <button type="button" onClick={() => toggleMaintCol(col.key)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${col.visible ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}`}>
                            <span className="material-symbols-outlined text-[11px]">{col.visible ? 'visibility' : 'visibility_off'}</span>
                            {col.label}
                          </button>
                          {col.key.startsWith('extra_') && (
                            <button type="button" onClick={() => removeMaintCol(col.key)}
                              title="Remove column"
                              className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-red-400 hover:bg-red-200 transition text-[10px] font-bold">×</button>
                          )}
                        </span>
                      ))}
                      {addingMaintCol ? (
                        <span className="inline-flex items-center gap-1">
                          <input autoFocus value={newMaintColName} onChange={e => setNewMaintColName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && newMaintColName.trim()) { addMaintCol(newMaintColName.trim()); setNewMaintColName(''); setAddingMaintCol(false) } else if (e.key === 'Escape') { setNewMaintColName(''); setAddingMaintCol(false) } }}
                            placeholder="Column name…"
                            className="rounded-lg border border-indigo-300 bg-white px-2 py-0.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-400 w-28" />
                          <button type="button" onClick={() => { if (newMaintColName.trim()) { addMaintCol(newMaintColName.trim()); setNewMaintColName('') } setAddingMaintCol(false) }}
                            className="rounded-lg bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-indigo-700 transition">Add</button>
                          <button type="button" onClick={() => { setNewMaintColName(''); setAddingMaintCol(false) }}
                            className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50 transition">Cancel</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setAddingMaintCol(true)}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-indigo-300 px-2.5 py-0.5 text-xs font-medium text-indigo-500 hover:bg-indigo-50 transition">
                          <span className="material-symbols-outlined text-[11px]">add</span>
                          Add Column
                        </button>
                      )}
                      <span className="ml-1 text-[10px] text-slate-400">Drag headers to reorder · Double-click to rename</span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="text-sm border-collapse" style={{ tableLayout: 'fixed', width: `${maintColDefs.filter(c => c.visible).reduce((s, c) => s + c.width, 0) + 112}px`, minWidth: '100%' }}>
                        <thead>
                          <tr className="bg-slate-900 text-white text-left text-[10px] font-semibold uppercase tracking-wider select-none">
                            {maintColDefs.filter(c => c.visible).map(col => (
                              <th key={col.key}
                                style={{ width: col.width, minWidth: col.width, position: 'relative' }}
                                draggable
                                onDragStart={() => setMaintDragColKey(col.key)}
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => { if (maintDragColKey) reorderMaintCols(maintDragColKey, col.key); setMaintDragColKey(null) }}
                                className={`px-3 py-3 cursor-grab active:cursor-grabbing transition ${maintDragColKey === col.key ? 'opacity-50' : ''} ${col.key === 'sno' || col.key === 'qty' || col.key === 'width' || col.key === 'height' ? 'text-center' : col.key === 'unitPrice' || col.key === 'total' ? 'text-right' : ''}`}>
                                <span className="inline-flex items-center gap-1 truncate">
                                  <span className="material-symbols-outlined text-[10px] text-white/40 shrink-0">drag_indicator</span>
                                  {maintEditingColKey === col.key ? (
                                    <input autoFocus defaultValue={col.label}
                                      onBlur={e => { renameMaintCol(col.key, e.target.value || col.label); setMaintEditingColKey(null) }}
                                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                      onClick={e => e.stopPropagation()}
                                      className="bg-white/10 border-b border-white/40 text-white text-[10px] font-semibold uppercase tracking-wider outline-none w-20 px-0.5" />
                                  ) : (
                                    <span onDoubleClick={e => { e.stopPropagation(); setMaintEditingColKey(col.key) }} title="Double-click to rename" className="truncate">{col.label}</span>
                                  )}
                                </span>
                                <div draggable={false} title="Drag to resize"
                                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-white/20 transition"
                                  onMouseDown={e => {
                                    e.preventDefault(); e.stopPropagation()
                                    const startX = e.clientX; const startW = col.width
                                    const onMove = (me: MouseEvent) => {
                                      const newW = Math.max(40, startW + me.clientX - startX)
                                      setMaintColDefs(prev => prev.map(c => c.key === col.key ? { ...c, width: newW } : c))
                                    }
                                    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                                    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
                                  }} />
                              </th>
                            ))}
                            <th className="px-3 py-3 text-center" style={{ width: 112, minWidth: 112 }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {maintItems.map((it, i) => {
                            const rt = maintRowTotal(it)
                            const notesOpen = maintNotesOpen.has(i)
                            return (
                              <Fragment key={i}>
                                {notesOpen && (
                                  <tr className="border-b border-indigo-100">
                                    <td colSpan={maintColDefs.filter(c => c.visible).length + 1} className="p-0">
                                      <div className="overflow-hidden border-l-4 border-indigo-400" style={{ backgroundColor: it.noteStyle.bgColor }}>
                                        <div className="flex items-center gap-1 px-3 py-1.5 bg-white/70 border-b border-indigo-100 flex-wrap">
                                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mr-2">Note style</span>
                                          <button type="button" title="Bold"
                                            onClick={() => updateMaintItem(i, 'noteStyle', { ...it.noteStyle, bold: !it.noteStyle.bold })}
                                            className={`w-6 h-6 rounded text-xs font-bold transition ${it.noteStyle.bold ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'text-slate-500 hover:bg-slate-100'}`}>B</button>
                                          <button type="button" title="Italic"
                                            onClick={() => updateMaintItem(i, 'noteStyle', { ...it.noteStyle, italic: !it.noteStyle.italic })}
                                            className={`w-6 h-6 rounded text-xs italic transition ${it.noteStyle.italic ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'text-slate-500 hover:bg-slate-100'}`}>I</button>
                                          <div className="flex items-center gap-1 ml-1">
                                            <span className="text-[10px] text-slate-400">Text</span>
                                            <input type="color" value={it.noteStyle.color} title="Font color"
                                              onChange={e => updateMaintItem(i, 'noteStyle', { ...it.noteStyle, color: e.target.value })}
                                              className="w-6 h-6 rounded cursor-pointer border border-slate-200 p-0.5" />
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-slate-400">BG</span>
                                            <input type="color" value={it.noteStyle.bgColor} title="Background color"
                                              onChange={e => updateMaintItem(i, 'noteStyle', { ...it.noteStyle, bgColor: e.target.value })}
                                              className="w-6 h-6 rounded cursor-pointer border border-slate-200 p-0.5" />
                                          </div>
                                          <select value={it.noteStyle.fontSize} title="Font size"
                                            onChange={e => updateMaintItem(i, 'noteStyle', { ...it.noteStyle, fontSize: e.target.value })}
                                            className="ml-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-600 outline-none focus:border-indigo-400">
                                            {['10','11','12','13','14','16','18'].map(s => <option key={s} value={s}>{s}px</option>)}
                                          </select>
                                          <button type="button" onClick={() => { updateMaintItem(i, 'notes', ''); updateMaintItem(i, 'noteStyle', defaultNoteStyle()); setMaintNotesOpen(prev => { const s = new Set(prev); s.delete(i); return s }) }}
                                            className="ml-auto text-slate-300 hover:text-red-400 transition">
                                            <span className="material-symbols-outlined text-[15px]">close</span>
                                          </button>
                                        </div>
                                        <textarea value={it.notes} onChange={e => updateMaintItem(i, 'notes', e.target.value)}
                                          placeholder="Add notes for this line item…" rows={2}
                                          style={{ fontWeight: it.noteStyle.bold ? 'bold' : 'normal', fontStyle: it.noteStyle.italic ? 'italic' : 'normal', color: it.noteStyle.color, fontSize: it.noteStyle.fontSize + 'px', backgroundColor: 'transparent' }}
                                          className="w-full px-4 py-2.5 outline-none resize-y placeholder-slate-400/60" />
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/40 align-top">
                                  {maintColDefs.filter(c => c.visible).map(col => (
                                    <td key={col.key} className="px-2 py-2.5">
                                      {col.key === 'sno' && (
                                        <input type="text" value={it.sno} onChange={e => updateMaintItem(i, 'sno', e.target.value)}
                                          className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-slate-500 text-center outline-none hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'item' && (
                                        <input type="text" value={it.item} onChange={e => updateMaintItem(i, 'item', e.target.value)}
                                          placeholder="Item name" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'description' && (
                                        <RichDescTextarea value={it.description} onChange={v => updateMaintItem(i, 'description', v)} />
                                      )}
                                      {col.key === 'width' && (
                                        <input type="text" value={it.width} onChange={e => updateMaintItem(i, 'width', e.target.value)}
                                          placeholder="—" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-center text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'height' && (
                                        <input type="text" value={it.height} onChange={e => updateMaintItem(i, 'height', e.target.value)}
                                          placeholder="—" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-center text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'qty' && (
                                        <input type="number" min={1} value={it.qty} onChange={e => updateMaintItem(i, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-center text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'unitPrice' && (
                                        <input type="number" min={0} step={0.01} value={it.unitPrice || ''} onChange={e => updateMaintItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                                          placeholder="0.00" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-right text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                      )}
                                      {col.key === 'total' && (
                                        <div className="text-right">
                                          <p className={`font-semibold tabular-nums ${rt > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{rt > 0 ? fmtM(rt) : '$0.00'}</p>
                                          <p className="text-[10px] text-slate-400 mt-0.5">Auto: qty × unit</p>
                                          <input type="number" min={0} step={0.01} value={it.overridePrice} onChange={e => updateMaintItem(i, 'overridePrice', e.target.value)}
                                            placeholder="Override $"
                                            className={`mt-1 w-full rounded-lg border px-2 py-1 text-xs text-right outline-none focus:ring-1 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${it.overridePrice ? 'border-amber-400 bg-amber-50 text-amber-800 focus:border-amber-400 focus:ring-amber-500/20' : 'border-slate-200 bg-slate-50 text-slate-600 focus:border-indigo-400 focus:ring-indigo-500/20'}`} />
                                          {it.overridePrice && <p className="text-[10px] text-amber-500 mt-0.5">overridden</p>}
                                        </div>
                                      )}
                                      {col.key.startsWith('extra_') && (
                                        <input type="text" value={it.extras[col.key] ?? ''} onChange={e => updateMaintItem(i, 'extras', { ...it.extras, [col.key]: e.target.value })}
                                          placeholder="—" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                    </td>
                                  ))}
                                  <td className="px-2 py-2.5">
                                    <div className="flex flex-col gap-1.5">
                                      <button type="button" onClick={() => setMaintItems(prev => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i))}
                                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition">
                                        Remove
                                      </button>
                                      <button type="button"
                                        onClick={() => setMaintNotesOpen(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })}
                                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${notesOpen ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                        {notesOpen ? 'Hide notes' : (it.notes ? 'Edit notes' : 'Add notes')}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Add Row */}
                    <div className="px-6 pt-3">
                      <button type="button" onClick={() => setMaintItems(prev => [...prev, emptyMaintItem(prev.length)])}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/40 transition">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Add Row
                      </button>
                    </div>

                    {/* Discount */}
                    <div className="px-6 pt-4">
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700">Discount</span>
                            {discPctM > 0 && showMaintDiscount && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">{discPctM}% off</span>
                            )}
                          </div>
                          <button type="button" role="switch" aria-checked={showMaintDiscount}
                            onClick={() => setShowMaintDiscount(p => !p)}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${showMaintDiscount ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${showMaintDiscount ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        {showMaintDiscount && (
                          <div className="px-4 py-3 border-t border-slate-100 bg-white flex flex-wrap items-center gap-4">
                            <label className="text-sm text-slate-600">Discount (%)</label>
                            <div className="relative w-28">
                              <input type="number" min={0} max={100} step={1} value={maintDiscountPct} onChange={e => setMaintDiscountPct(e.target.value)}
                                placeholder="0"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 pr-7 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">%</span>
                            </div>
                            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                              <span className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">PDF colour</span>
                              <input type="color" value={maintDiscountColor} onChange={e => setMaintDiscountColor(e.target.value)} title="Discount text colour in PDF"
                                className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0.5" />
                              <span className="text-[11px] text-slate-400 font-mono">{maintDiscountColor}</span>
                            </div>
                            {discPctM > 0 && (
                              <span className="text-sm font-medium" style={{ color: maintDiscountColor }}>
                                Saving {fmtM(maintSubtotal * discPctM / 100)}
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
                          <span className="tabular-nums font-semibold text-slate-800">{fmtM(maintSubtotal)}</span>
                        </div>
                        {discPctM > 0 && (
                          <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 border-b border-green-100">
                            <span className="text-sm text-green-700">Discount ({discPctM}%)</span>
                            <span className="tabular-nums text-green-700 font-medium">−{fmtM(maintSubtotal * discPctM / 100)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                          <span className="text-sm text-slate-500">GST (10%)</span>
                          <span className="tabular-nums text-slate-600">{fmtM(maintAfterDiscount * 0.1)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 bg-indigo-500">
                          <span className="text-sm font-bold text-indigo-100 uppercase tracking-wide">Total inc. GST</span>
                          <span className="tabular-nums font-bold text-xl text-white">{fmtM(maintAfterDiscount * 1.1)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                    )
                  })()}

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
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
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
              const partsRowTotalFn = (it: PartsItem) => { const base = it.overridePrice ? parseFloat(it.overridePrice) || 0 : it.qty * it.unitPrice; const disc = it.discount ? parseFloat(it.discount) || 0 : 0; return disc > 0 ? base * (1 - disc / 100) : base }
              const partsSubtotal = partsItems.reduce((s, it) => s + partsRowTotalFn(it), 0)
              const discPctP = showPartsDiscount ? (parseFloat(partsDiscountPct) || 0) : 0
              const partsAfterDiscount = partsSubtotal * (1 - discPctP / 100)
              const fmtP = (n: number) => n === 0 ? '$0.00' : `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              return (
                <div className={`space-y-0 divide-y divide-slate-100${formLocked ? ' pointer-events-none opacity-75 select-none' : ''}`}>
                  {formLocked && (
                    <div className="pointer-events-auto flex items-center justify-between gap-3 bg-amber-50 px-6 py-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                        <span className="material-symbols-outlined text-[15px]">lock</span>
                        Read-only — viewing saved quote
                      </div>
                      <button type="button" onClick={() => { setIsReadOnly(false); setShowPreview(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 transition">
                        <span className="material-symbols-outlined text-[15px]">edit</span>Edit Quote
                      </button>
                    </div>
                  )}

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

                  {/* ── Line Items (dynamic columns) ── */}
                  {(() => {
                    const partsRowTotal = (it: PartsItem) => {
                      const base = it.overridePrice ? parseFloat(it.overridePrice) || 0 : it.qty * it.unitPrice
                      const disc = it.discount ? parseFloat(it.discount) || 0 : 0
                      return disc > 0 ? base * (1 - disc / 100) : base
                    }
                    return (
                  <div className="pt-4 pb-2">
                    {/* Column visibility toggles + Add Column */}
                    <div className="px-6 mb-3 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mr-1">Columns:</span>
                      {partsColDefs.map(col => (
                        <span key={col.key} className="inline-flex items-center gap-0.5">
                          <button type="button" onClick={() => togglePartsCol(col.key)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${col.visible ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}`}>
                            <span className="material-symbols-outlined text-[11px]">{col.visible ? 'visibility' : 'visibility_off'}</span>
                            {col.label}
                          </button>
                          {col.key.startsWith('extra_') && (
                            <button type="button" onClick={() => removePartsCol(col.key)}
                              title="Remove column"
                              className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-red-400 hover:bg-red-200 transition text-[10px] font-bold">×</button>
                          )}
                        </span>
                      ))}
                      {addingPartsCol ? (
                        <span className="inline-flex items-center gap-1">
                          <input autoFocus value={newPartsColName} onChange={e => setNewPartsColName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && newPartsColName.trim()) { addPartsCol(newPartsColName.trim()); setNewPartsColName(''); setAddingPartsCol(false) } else if (e.key === 'Escape') { setNewPartsColName(''); setAddingPartsCol(false) } }}
                            placeholder="Column name…"
                            className="rounded-lg border border-indigo-300 bg-white px-2 py-0.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-400 w-28" />
                          <button type="button" onClick={() => { if (newPartsColName.trim()) { addPartsCol(newPartsColName.trim()); setNewPartsColName('') } setAddingPartsCol(false) }}
                            className="rounded-lg bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-indigo-700 transition">Add</button>
                          <button type="button" onClick={() => { setNewPartsColName(''); setAddingPartsCol(false) }}
                            className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50 transition">Cancel</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setAddingPartsCol(true)}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-indigo-300 px-2.5 py-0.5 text-xs font-medium text-indigo-500 hover:bg-indigo-50 transition">
                          <span className="material-symbols-outlined text-[11px]">add</span>
                          Add Column
                        </button>
                      )}
                      <span className="ml-1 text-[10px] text-slate-400">Drag headers to reorder · Double-click to rename</span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="text-sm border-collapse" style={{ tableLayout: 'fixed', width: `${partsColDefs.filter(c => c.visible).reduce((s, c) => s + c.width, 0) + 112}px`, minWidth: '100%' }}>
                        <thead>
                          <tr className="bg-slate-900 text-white text-left text-[10px] font-semibold uppercase tracking-wider select-none">
                            {partsColDefs.filter(c => c.visible).map(col => (
                              <th key={col.key}
                                style={{ width: col.width, minWidth: col.width, position: 'relative' }}
                                draggable
                                onDragStart={() => setPartsDragColKey(col.key)}
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => { if (partsDragColKey) reorderPartsCols(partsDragColKey, col.key); setPartsDragColKey(null) }}
                                className={`px-3 py-3 cursor-grab active:cursor-grabbing transition ${partsDragColKey === col.key ? 'opacity-50' : ''} ${col.key === 'sno' || col.key === 'qty' || col.key === 'width' || col.key === 'height' ? 'text-center' : col.key === 'unitPrice' || col.key === 'total' ? 'text-right' : ''}`}>
                                <span className="inline-flex items-center gap-1 truncate">
                                  <span className="material-symbols-outlined text-[10px] text-white/40 shrink-0">drag_indicator</span>
                                  {partsEditingColKey === col.key ? (
                                    <input autoFocus defaultValue={col.label}
                                      onBlur={e => { renamePartsCol(col.key, e.target.value || col.label); setPartsEditingColKey(null) }}
                                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                      onClick={e => e.stopPropagation()}
                                      className="bg-white/10 border-b border-white/40 text-white text-[10px] font-semibold uppercase tracking-wider outline-none w-20 px-0.5" />
                                  ) : (
                                    <span onDoubleClick={e => { e.stopPropagation(); setPartsEditingColKey(col.key) }} title="Double-click to rename" className="truncate">{col.label}</span>
                                  )}
                                </span>
                                <div draggable={false} title="Drag to resize"
                                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-white/20 transition"
                                  onMouseDown={e => {
                                    e.preventDefault(); e.stopPropagation()
                                    const startX = e.clientX; const startW = col.width
                                    const onMove = (me: MouseEvent) => {
                                      const newW = Math.max(40, startW + me.clientX - startX)
                                      setPartsColDefs(prev => prev.map(c => c.key === col.key ? { ...c, width: newW } : c))
                                    }
                                    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                                    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
                                  }} />
                              </th>
                            ))}
                            <th className="px-3 py-3 text-center" style={{ width: 112, minWidth: 112 }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partsItems.map((it, i) => {
                            const rt = partsRowTotal(it)
                            const notesOpen = partsNotesOpen.has(i)
                            return (
                              <Fragment key={i}>
                                {notesOpen && (
                                  <tr className="border-b border-indigo-100">
                                    <td colSpan={partsColDefs.filter(c => c.visible).length + 1} className="p-0">
                                      <div className="overflow-hidden border-l-4 border-indigo-400" style={{ backgroundColor: it.noteStyle.bgColor }}>
                                        <div className="flex items-center gap-1 px-3 py-1.5 bg-white/70 border-b border-indigo-100 flex-wrap">
                                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mr-2">Note style</span>
                                          <button type="button" title="Bold"
                                            onClick={() => updatePartsItem(i, 'noteStyle', { ...it.noteStyle, bold: !it.noteStyle.bold })}
                                            className={`w-6 h-6 rounded text-xs font-bold transition ${it.noteStyle.bold ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'text-slate-500 hover:bg-slate-100'}`}>B</button>
                                          <button type="button" title="Italic"
                                            onClick={() => updatePartsItem(i, 'noteStyle', { ...it.noteStyle, italic: !it.noteStyle.italic })}
                                            className={`w-6 h-6 rounded text-xs italic transition ${it.noteStyle.italic ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'text-slate-500 hover:bg-slate-100'}`}>I</button>
                                          <div className="flex items-center gap-1 ml-1">
                                            <span className="text-[10px] text-slate-400">Text</span>
                                            <input type="color" value={it.noteStyle.color} title="Font color"
                                              onChange={e => updatePartsItem(i, 'noteStyle', { ...it.noteStyle, color: e.target.value })}
                                              className="w-6 h-6 rounded cursor-pointer border border-slate-200 p-0.5" />
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-slate-400">BG</span>
                                            <input type="color" value={it.noteStyle.bgColor} title="Background color"
                                              onChange={e => updatePartsItem(i, 'noteStyle', { ...it.noteStyle, bgColor: e.target.value })}
                                              className="w-6 h-6 rounded cursor-pointer border border-slate-200 p-0.5" />
                                          </div>
                                          <select value={it.noteStyle.fontSize} title="Font size"
                                            onChange={e => updatePartsItem(i, 'noteStyle', { ...it.noteStyle, fontSize: e.target.value })}
                                            className="ml-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-600 outline-none focus:border-indigo-400">
                                            {['10','11','12','13','14','16','18'].map(s => <option key={s} value={s}>{s}px</option>)}
                                          </select>
                                          <button type="button" onClick={() => { updatePartsItem(i, 'notes', ''); updatePartsItem(i, 'noteStyle', defaultNoteStyle()); setPartsNotesOpen(prev => { const s = new Set(prev); s.delete(i); return s }) }}
                                            className="ml-auto text-slate-300 hover:text-red-400 transition">
                                            <span className="material-symbols-outlined text-[15px]">close</span>
                                          </button>
                                        </div>
                                        <textarea value={it.notes} onChange={e => updatePartsItem(i, 'notes', e.target.value)}
                                          placeholder="Add notes for this line item…" rows={2}
                                          style={{ fontWeight: it.noteStyle.bold ? 'bold' : 'normal', fontStyle: it.noteStyle.italic ? 'italic' : 'normal', color: it.noteStyle.color, fontSize: it.noteStyle.fontSize + 'px', backgroundColor: 'transparent' }}
                                          className="w-full px-4 py-2.5 outline-none resize-y placeholder-slate-400/60" />
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/40 align-top">
                                  {partsColDefs.filter(c => c.visible).map(col => (
                                    <td key={col.key} className="px-2 py-2.5">
                                      {col.key === 'sno' && (
                                        <input type="text" value={it.sno} onChange={e => updatePartsItem(i, 'sno', e.target.value)}
                                          className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-slate-500 text-center outline-none hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'item' && (
                                        <input type="text" value={it.item} onChange={e => updatePartsItem(i, 'item', e.target.value)}
                                          placeholder="Item name" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'description' && (
                                        <RichDescTextarea value={it.description} onChange={v => updatePartsItem(i, 'description', v)} />
                                      )}
                                      {col.key === 'width' && (
                                        <input type="text" value={it.width} onChange={e => updatePartsItem(i, 'width', e.target.value)}
                                          placeholder="—" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-center text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'height' && (
                                        <input type="text" value={it.height} onChange={e => updatePartsItem(i, 'height', e.target.value)}
                                          placeholder="—" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-center text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'qty' && (
                                        <input type="number" min={1} value={it.qty} onChange={e => updatePartsItem(i, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-center text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'unitPrice' && (
                                        <input type="number" min={0} step={0.01} value={it.unitPrice || ''} onChange={e => updatePartsItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                                          placeholder="0.00" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-right text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                      )}
                                      {col.key === 'total' && (
                                        <div className="text-right">
                                          <p className={`font-semibold tabular-nums ${rt > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{rt > 0 ? fmtP(rt) : '$0.00'}</p>
                                          <p className="text-[10px] text-slate-400 mt-0.5">Auto: qty × unit</p>
                                          <input type="number" min={0} step={0.01} value={it.overridePrice} onChange={e => updatePartsItem(i, 'overridePrice', e.target.value)}
                                            placeholder="Override $"
                                            className={`mt-1 w-full rounded-lg border px-2 py-1 text-xs text-right outline-none focus:ring-1 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${it.overridePrice ? 'border-amber-400 bg-amber-50 text-amber-800 focus:border-amber-400 focus:ring-amber-500/20' : 'border-slate-200 bg-slate-50 text-slate-600 focus:border-indigo-400 focus:ring-indigo-500/20'}`} />
                                          {it.overridePrice && <p className="text-[10px] text-amber-500 mt-0.5">overridden</p>}
                                        </div>
                                      )}
                                      {col.key.startsWith('extra_') && (
                                        <input type="text" value={it.extras[col.key] ?? ''} onChange={e => updatePartsItem(i, 'extras', { ...it.extras, [col.key]: e.target.value })}
                                          placeholder="—" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                    </td>
                                  ))}
                                  <td className="px-2 py-2.5">
                                    <div className="flex flex-col gap-1.5">
                                      <button type="button" onClick={() => setPartsItems(prev => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i))}
                                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition">
                                        Remove
                                      </button>
                                      <button type="button"
                                        onClick={() => setPartsNotesOpen(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })}
                                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${notesOpen ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                        {notesOpen ? 'Hide notes' : (it.notes ? 'Edit notes' : 'Add notes')}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Add Row */}
                    <div className="px-6 pt-3">
                      <button type="button" onClick={() => setPartsItems(prev => [...prev, emptyPartsItem(prev.length)])}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/40 transition">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Add Row
                      </button>
                    </div>

                    {/* Discount */}
                    <div className="px-6 pt-4">
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700">Discount</span>
                            {discPctP > 0 && showPartsDiscount && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">{discPctP}% off</span>
                            )}
                          </div>
                          <button type="button" role="switch" aria-checked={showPartsDiscount}
                            onClick={() => setShowPartsDiscount(p => !p)}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${showPartsDiscount ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${showPartsDiscount ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        {showPartsDiscount && (
                          <div className="px-4 py-3 border-t border-slate-100 bg-white flex flex-wrap items-center gap-4">
                            <label className="text-sm text-slate-600">Discount (%)</label>
                            <div className="relative w-28">
                              <input type="number" min={0} max={100} step={1} value={partsDiscountPct} onChange={e => setPartsDiscountPct(e.target.value)}
                                placeholder="0"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 pr-7 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">%</span>
                            </div>
                            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                              <span className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">PDF colour</span>
                              <input type="color" value={partsDiscountColor} onChange={e => setPartsDiscountColor(e.target.value)} title="Discount text colour in PDF"
                                className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0.5" />
                              <span className="text-[11px] text-slate-400 font-mono">{partsDiscountColor}</span>
                            </div>
                            {discPctP > 0 && (
                              <span className="text-sm font-medium" style={{ color: partsDiscountColor }}>
                                Saving {fmtP(partsSubtotal * discPctP / 100)}
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
                          <span className="tabular-nums font-semibold text-slate-800">{fmtP(partsSubtotal)}</span>
                        </div>
                        {discPctP > 0 && (
                          <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 border-b border-green-100">
                            <span className="text-sm text-green-700">Discount ({discPctP}%)</span>
                            <span className="tabular-nums text-green-700 font-medium">−{fmtP(partsSubtotal * discPctP / 100)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                          <span className="text-sm text-slate-500">GST (10%)</span>
                          <span className="tabular-nums text-slate-600">{fmtP(partsAfterDiscount * 0.1)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 bg-indigo-500">
                          <span className="text-sm font-bold text-indigo-100 uppercase tracking-wide">Total inc. GST</span>
                          <span className="tabular-nums font-bold text-xl text-white">{fmtP(partsAfterDiscount * 1.1)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                    )
                  })()}

                  {/* T&C product type selector */}
                  <div className="px-6 pt-5">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Terms &amp; Conditions <span className="normal-case font-normal text-slate-400">— which product line&apos;s T&amp;C applies to this quote</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { key: 'PVC_FLEX_SYSTEM' as const,     label: 'PVC Flex System', icon: 'view_column' },
                          { key: 'INDUSTRIAL_RAPID_DOOR' as const, label: 'Rapid Door',     icon: 'garage' },
                        ]).map(opt => (
                          <button key={opt.key} type="button"
                            onClick={() => { setPartsTcType(opt.key); if (opt.key === 'PVC_FLEX_SYSTEM') setPartsEndUser(prev => prev === 'DISTRIBUTOR' ? '' : prev) }}
                            className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition ${
                              partsTcType === opt.key
                                ? 'border-indigo-400 bg-indigo-500 text-white shadow-sm'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                            }`}>
                            <span className="material-symbols-outlined text-[18px]">{opt.icon}</span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* End User T&C selector */}
                  <div className="px-6 pt-5">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                        End User <span className="normal-case font-normal text-slate-400">— selects which T&amp;C document is appended</span>
                      </label>
                      <div className={`grid gap-3 ${partsTcType === 'PVC_FLEX_SYSTEM' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {(partsTcType === 'PVC_FLEX_SYSTEM' ? (['CUSTOMER', 'TENDER'] as const) : (['CUSTOMER', 'DISTRIBUTOR', 'TENDER'] as const)).map(type => (
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
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
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
              const discPct = showGeneralDiscount ? (parseFloat(generalDiscountPct) || 0) : 0
              const generalAfterDiscount = generalSubtotal * (1 - discPct / 100)
              return (
                <div className={`space-y-0 divide-y divide-slate-100${formLocked ? ' pointer-events-none opacity-75 select-none' : ''}`}>
                  {formLocked && (
                    <div className="pointer-events-auto flex items-center justify-between gap-3 bg-amber-50 px-6 py-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                        <span className="material-symbols-outlined text-[15px]">lock</span>
                        Read-only — viewing saved quote
                      </div>
                      <button type="button" onClick={() => { setIsReadOnly(false); setShowPreview(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 transition">
                        <span className="material-symbols-outlined text-[15px]">edit</span>Edit Quote
                      </button>
                    </div>
                  )}

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
                    {/* Column visibility toggles + Add Column */}
                    <div className="px-6 mb-3 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mr-1">Columns:</span>
                      {generalColDefs.map(col => (
                        <span key={col.key} className="inline-flex items-center gap-0.5">
                          <button type="button" onClick={() => toggleGeneralCol(col.key)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${col.visible ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}`}>
                            <span className="material-symbols-outlined text-[11px]">{col.visible ? 'visibility' : 'visibility_off'}</span>
                            {col.label}
                          </button>
                          {col.key.startsWith('extra_') && (
                            <button type="button" onClick={() => removeGeneralCol(col.key)}
                              title="Remove column"
                              className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-red-400 hover:bg-red-200 transition text-[10px] font-bold">×</button>
                          )}
                        </span>
                      ))}
                      {/* Add Column */}
                      {addingGeneralCol ? (
                        <span className="inline-flex items-center gap-1">
                          <input autoFocus value={newGeneralColName} onChange={e => setNewGeneralColName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && newGeneralColName.trim()) { addGeneralCol(newGeneralColName.trim()); setNewGeneralColName(''); setAddingGeneralCol(false) } else if (e.key === 'Escape') { setNewGeneralColName(''); setAddingGeneralCol(false) } }}
                            placeholder="Column name…"
                            className="rounded-lg border border-indigo-300 bg-white px-2 py-0.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-400 w-28" />
                          <button type="button" onClick={() => { if (newGeneralColName.trim()) { addGeneralCol(newGeneralColName.trim()); setNewGeneralColName(''); } setAddingGeneralCol(false) }}
                            className="rounded-lg bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-indigo-700 transition">Add</button>
                          <button type="button" onClick={() => { setNewGeneralColName(''); setAddingGeneralCol(false) }}
                            className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50 transition">Cancel</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setAddingGeneralCol(true)}
                          className="inline-flex items-center gap-1 rounded-full border border-dashed border-indigo-300 px-2.5 py-0.5 text-xs font-medium text-indigo-500 hover:bg-indigo-50 transition">
                          <span className="material-symbols-outlined text-[11px]">add</span>
                          Add Column
                        </button>
                      )}
                      <span className="ml-1 text-[10px] text-slate-400">Drag headers to reorder · Double-click to rename</span>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="text-sm border-collapse" style={{ tableLayout: 'fixed', width: `${generalColDefs.filter(c => c.visible).reduce((s, c) => s + c.width, 0) + 112}px`, minWidth: '100%' }}>
                        <thead>
                          <tr className="bg-slate-900 text-white text-left text-[10px] font-semibold uppercase tracking-wider select-none">
                            {generalColDefs.filter(c => c.visible).map(col => (
                              <th key={col.key}
                                style={{ width: col.width, minWidth: col.width, position: 'relative' }}
                                draggable
                                onDragStart={() => setGeneralDragColKey(col.key)}
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => { if (generalDragColKey) reorderGeneralCols(generalDragColKey, col.key); setGeneralDragColKey(null) }}
                                className={`px-3 py-3 cursor-grab active:cursor-grabbing transition ${generalDragColKey === col.key ? 'opacity-50' : ''} ${col.key === 'sno' || col.key === 'qty' || col.key === 'width' || col.key === 'height' ? 'text-center' : col.key === 'unitPrice' || col.key === 'total' ? 'text-right' : ''}`}>
                                <span className="inline-flex items-center gap-1 truncate">
                                  <span className="material-symbols-outlined text-[10px] text-white/40 shrink-0">drag_indicator</span>
                                  {generalEditingColKey === col.key ? (
                                    <input
                                      autoFocus
                                      defaultValue={col.label}
                                      onBlur={e => { renameGeneralCol(col.key, e.target.value || col.label); setGeneralEditingColKey(null) }}
                                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                      onClick={e => e.stopPropagation()}
                                      className="bg-white/10 border-b border-white/40 text-white text-[10px] font-semibold uppercase tracking-wider outline-none w-20 px-0.5"
                                    />
                                  ) : (
                                    <span onDoubleClick={e => { e.stopPropagation(); setGeneralEditingColKey(col.key) }} title="Double-click to rename" className="truncate">{col.label}</span>
                                  )}
                                </span>
                                {/* Resize handle */}
                                <div
                                  draggable={false}
                                  title="Drag to resize"
                                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-white/20 transition"
                                  onMouseDown={e => {
                                    e.preventDefault(); e.stopPropagation()
                                    const startX = e.clientX
                                    const startW = col.width
                                    const onMove = (me: MouseEvent) => {
                                      const newW = Math.max(40, startW + me.clientX - startX)
                                      setGeneralColDefs(prev => prev.map(c => c.key === col.key ? { ...c, width: newW } : c))
                                    }
                                    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                                    window.addEventListener('mousemove', onMove)
                                    window.addEventListener('mouseup', onUp)
                                  }}
                                />
                              </th>
                            ))}
                            <th className="px-3 py-3 text-center" style={{ width: 112, minWidth: 112 }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generalItems.map((it, i) => {
                            const rt = rowTotal(it)
                            const notesOpen = generalNotesOpen.has(i)
                            return (
                              <Fragment key={i}>
                                {/* Notes row — ABOVE the data row */}
                                {notesOpen && (
                                  <tr className="border-b border-indigo-100">
                                    <td colSpan={generalColDefs.filter(c => c.visible).length + 1} className="p-0">
                                      <div className="overflow-hidden border-l-4 border-indigo-400" style={{ backgroundColor: it.noteStyle.bgColor }}>
                                        {/* Formatting toolbar */}
                                        <div className="flex items-center gap-1 px-3 py-1.5 bg-white/70 border-b border-indigo-100 flex-wrap">
                                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mr-2">Note style</span>
                                          <button type="button" title="Bold"
                                            onClick={() => updateGeneralItem(i, 'noteStyle', { ...it.noteStyle, bold: !it.noteStyle.bold })}
                                            className={`w-6 h-6 rounded text-xs font-bold transition ${it.noteStyle.bold ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'text-slate-500 hover:bg-slate-100'}`}>B</button>
                                          <button type="button" title="Italic"
                                            onClick={() => updateGeneralItem(i, 'noteStyle', { ...it.noteStyle, italic: !it.noteStyle.italic })}
                                            className={`w-6 h-6 rounded text-xs italic transition ${it.noteStyle.italic ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'text-slate-500 hover:bg-slate-100'}`}>I</button>
                                          <div className="flex items-center gap-1 ml-1">
                                            <span className="text-[10px] text-slate-400">Text</span>
                                            <input type="color" value={it.noteStyle.color} title="Font color"
                                              onChange={e => updateGeneralItem(i, 'noteStyle', { ...it.noteStyle, color: e.target.value })}
                                              className="w-6 h-6 rounded cursor-pointer border border-slate-200 p-0.5" />
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className="text-[10px] text-slate-400">BG</span>
                                            <input type="color" value={it.noteStyle.bgColor} title="Background color"
                                              onChange={e => updateGeneralItem(i, 'noteStyle', { ...it.noteStyle, bgColor: e.target.value })}
                                              className="w-6 h-6 rounded cursor-pointer border border-slate-200 p-0.5" />
                                          </div>
                                          <select value={it.noteStyle.fontSize} title="Font size"
                                            onChange={e => updateGeneralItem(i, 'noteStyle', { ...it.noteStyle, fontSize: e.target.value })}
                                            className="ml-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-600 outline-none focus:border-indigo-400">
                                            {['10','11','12','13','14','16','18'].map(s => <option key={s} value={s}>{s}px</option>)}
                                          </select>
                                          <button type="button" onClick={() => { updateGeneralItem(i, 'notes', ''); updateGeneralItem(i, 'noteStyle', defaultNoteStyle()); setGeneralNotesOpen(prev => { const s = new Set(prev); s.delete(i); return s }) }}
                                            className="ml-auto text-slate-300 hover:text-red-400 transition">
                                            <span className="material-symbols-outlined text-[15px]">close</span>
                                          </button>
                                        </div>
                                        {/* Note textarea */}
                                        <textarea value={it.notes} onChange={e => updateGeneralItem(i, 'notes', e.target.value)}
                                          placeholder="Add notes for this line item…"
                                          rows={2}
                                          style={{ fontWeight: it.noteStyle.bold ? 'bold' : 'normal', fontStyle: it.noteStyle.italic ? 'italic' : 'normal', color: it.noteStyle.color, fontSize: it.noteStyle.fontSize + 'px', backgroundColor: 'transparent' }}
                                          className="w-full px-4 py-2.5 outline-none resize-y placeholder-slate-400/60" />
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/40 align-top">
                                  {generalColDefs.filter(c => c.visible).map(col => (
                                    <td key={col.key} className="px-2 py-2.5">
                                      {col.key === 'sno' && (
                                        <input type="text" value={it.sno} onChange={e => updateGeneralItem(i, 'sno', e.target.value)}
                                          className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-slate-500 text-center outline-none hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'item' && (
                                        <input type="text" value={it.item} onChange={e => updateGeneralItem(i, 'item', e.target.value)}
                                          placeholder="Item name" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'description' && (
                                        <RichDescTextarea value={it.description} onChange={v => updateGeneralItem(i, 'description', v)} />
                                      )}
                                      {col.key === 'width' && (
                                        <input type="text" value={it.width} onChange={e => updateGeneralItem(i, 'width', e.target.value)}
                                          placeholder="—" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-center text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'height' && (
                                        <input type="text" value={it.height} onChange={e => updateGeneralItem(i, 'height', e.target.value)}
                                          placeholder="—" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-center text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'qty' && (
                                        <input type="number" min={1} value={it.qty} onChange={e => updateGeneralItem(i, 'qty', Math.max(1, parseInt(e.target.value) || 1))}
                                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-center text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                      {col.key === 'unitPrice' && (
                                        <input type="number" min={0} step={0.01} value={it.unitPrice || ''} onChange={e => updateGeneralItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
                                          placeholder="0.00" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-right text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                      )}
                                      {col.key === 'total' && (
                                        <div className="text-right">
                                          <p className={`font-semibold tabular-nums ${rt > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{rt > 0 ? fmtG(rt) : '$0.00'}</p>
                                          <p className="text-[10px] text-slate-400 mt-0.5">Auto: qty × unit</p>
                                          <input type="number" min={0} step={0.01} value={it.overridePrice} onChange={e => updateGeneralItem(i, 'overridePrice', e.target.value)}
                                            placeholder="Override $"
                                            className={`mt-1 w-full rounded-lg border px-2 py-1 text-xs text-right outline-none focus:ring-1 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${it.overridePrice ? 'border-amber-400 bg-amber-50 text-amber-800 focus:border-amber-400 focus:ring-amber-500/20' : 'border-slate-200 bg-slate-50 text-slate-600 focus:border-indigo-400 focus:ring-indigo-500/20'}`} />
                                          {it.overridePrice && <p className="text-[10px] text-amber-500 mt-0.5">overridden</p>}
                                        </div>
                                      )}
                                      {col.key.startsWith('extra_') && (
                                        <input type="text" value={it.extras[col.key] ?? ''} onChange={e => updateGeneralItem(i, 'extras', { ...it.extras, [col.key]: e.target.value })}
                                          placeholder="—" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                                      )}
                                    </td>
                                  ))}
                                  {/* Action */}
                                  <td className="px-2 py-2.5">
                                    <div className="flex flex-col gap-1.5">
                                      <button type="button" onClick={() => setGeneralItems(prev => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i))}
                                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition">
                                        Remove
                                      </button>
                                      <button type="button"
                                        onClick={() => setGeneralNotesOpen(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })}
                                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${notesOpen ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                        {notesOpen ? 'Hide notes' : (it.notes ? 'Edit notes' : 'Add notes')}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Add Row */}
                    <div className="px-6 pt-3">
                      <button type="button" onClick={() => setGeneralItems(prev => [...prev, emptyGeneralItem(prev.length)])}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/40 transition">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Add Row
                      </button>
                    </div>
                  </div>

                  {/* Discount section — collapsible */}
                    <div className="px-6 pt-4">
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        {/* Header row — toggle switch + label */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-700">Discount</span>
                            {discPct > 0 && showGeneralDiscount && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">{discPct}% off</span>
                            )}
                          </div>
                          {/* Toggle switch */}
                          <button type="button" role="switch" aria-checked={showGeneralDiscount}
                            onClick={() => setShowGeneralDiscount(p => !p)}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${showGeneralDiscount ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${showGeneralDiscount ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        {/* Body — only when toggled on */}
                        {showGeneralDiscount && (
                          <div className="px-4 py-3 border-t border-slate-100 bg-white flex flex-wrap items-center gap-4">
                            <label className="text-sm text-slate-600">Discount (%)</label>
                            <div className="relative w-28">
                              <input type="number" min={0} max={100} step={1} value={generalDiscountPct} onChange={e => setGeneralDiscountPct(e.target.value)}
                                placeholder="0"
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 pr-7 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition" />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">%</span>
                            </div>
                            {/* Font color for discount label in PDF */}
                            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                              <span className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">PDF colour</span>
                              <input type="color" value={generalDiscountColor}
                                onChange={e => setGeneralDiscountColor(e.target.value)}
                                title="Discount text colour in PDF"
                                className="h-6 w-8 cursor-pointer rounded border border-slate-200 p-0.5" />
                              <span className="text-[11px] text-slate-400 font-mono">{generalDiscountColor}</span>
                            </div>
                            {discPct > 0 && (
                              <span className="text-sm font-medium" style={{ color: generalDiscountColor }}>
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
                        <div className="flex items-center justify-between px-4 py-3 bg-indigo-500">
                          <span className="text-sm font-bold text-indigo-100 uppercase tracking-wide">Total inc. GST</span>
                          <span className="tabular-nums font-bold text-xl text-white">{fmtG(generalAfterDiscount * 1.1)}</span>
                        </div>
                      </div>
                    </div>

                  {/* T&C product type selector */}
                  <div className="px-6 pt-5">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Terms &amp; Conditions <span className="normal-case font-normal text-slate-400">— which product line&apos;s T&amp;C applies to this quote</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { key: 'PVC_FLEX_SYSTEM' as const,     label: 'PVC Flex System', icon: 'view_column' },
                          { key: 'INDUSTRIAL_RAPID_DOOR' as const, label: 'Rapid Door',     icon: 'garage' },
                        ]).map(opt => (
                          <button key={opt.key} type="button"
                            onClick={() => { setGeneralTcType(opt.key); if (opt.key === 'PVC_FLEX_SYSTEM') setGeneralEndUser(prev => prev === 'DISTRIBUTOR' ? '' : prev) }}
                            className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition ${
                              generalTcType === opt.key
                                ? 'border-indigo-400 bg-indigo-500 text-white shadow-sm'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                            }`}>
                            <span className="material-symbols-outlined text-[18px]">{opt.icon}</span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* End User T&C selector */}
                  <div className="px-6 pt-5">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                        End User <span className="normal-case font-normal text-slate-400">— selects which T&amp;C document is appended</span>
                      </label>
                      <div className={`grid gap-3 ${generalTcType === 'PVC_FLEX_SYSTEM' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {(generalTcType === 'PVC_FLEX_SYSTEM' ? (['CUSTOMER', 'TENDER'] as const) : (['CUSTOMER', 'DISTRIBUTOR', 'TENDER'] as const)).map(type => (
                          <button key={type} type="button"
                            onClick={() => setGeneralEndUser(prev => prev === type ? '' : type)}
                            className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition ${
                              generalEndUser === type
                                ? 'border-indigo-400 bg-indigo-500 text-white shadow-sm'
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
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
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

          {/* ── General Quote Preview ───────────────────────────────────── */}
          {isGeneral && showPreview && previewUrl && (
            <div ref={previewRef} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-indigo-600 text-xl">picture_as_pdf</span>
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Quotation Preview</h2>
                    {quoteNumber && <p className="text-xs text-slate-400">{quoteNumber}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" onClick={handleSaveGeneral}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    {generalQuoteIdRef.current ? 'Update' : 'Save Quote'}
                  </button>
                  <button type="button" onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600">
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Download PDF
                  </button>
                  <button type="button" onClick={openEmailModal}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    Send Email
                  </button>
                  <button type="button" onClick={handleEditQuote}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    Edit
                  </button>
                  {generalQuoteIdRef.current && (
                    <button type="button" onClick={() => openWorkflowModal(generalQuoteIdRef.current!)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700">
                      <span className="material-symbols-outlined text-[16px]">timeline</span>
                      Workflow
                    </button>
                  )}
                </div>
              </div>
              {generalSaveMsg && (
                <div className={`px-6 py-2 text-sm font-medium flex items-center gap-2 ${generalSaveMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  <span className="material-symbols-outlined text-[16px]">{generalSaveMsg.ok ? 'check_circle' : 'error'}</span>
                  {generalSaveMsg.text}
                </div>
              )}
              {isSafari ? (
                <div className="flex flex-col items-center justify-center gap-4 py-16 px-6">
                  <span className="material-symbols-outlined text-4xl text-slate-400">picture_as_pdf</span>
                  <p className="text-sm text-slate-600 text-center max-w-sm">
                    Safari doesn&apos;t support displaying this PDF in the embedded preview. Open the PDF in a new tab to view or download it.
                  </p>
                  <button type="button" onClick={() => { const w = window.open(); if (w) w.location.href = previewUrl! }}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-slate-700">
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    Open PDF in New Tab
                  </button>
                </div>
              ) : (
                <iframe src={previewUrl!} className="w-full border-0" style={{ height: '900px' }} title="Quote Preview" />
              )}
            </div>
          )}

          {/* ── Recent General Quotes — shown on dashboard only ─────────── */}
          {false && isGeneral && !editingId && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-xl">history</span>
                  <h2 className="text-base font-semibold text-slate-800">Recent General Quotes</h2>
                </div>
                <button type="button" onClick={loadRecentGeneralQuotes}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition">
                  <span className="material-symbols-outlined text-[14px]">refresh</span>Refresh
                </button>
              </div>
              {recentGeneralLoading ? (
                <div className="px-6 py-8 text-center text-sm text-slate-400">Loading…</div>
              ) : recentGeneralQuotes.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-slate-400">No saved general quotes yet. Generate and save a quote to see it here.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Quote No.</th>
                        <th className="px-4 py-3 text-left">Customer</th>
                        <th className="px-4 py-3 text-left">Address</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-right">Total (inc GST)</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentGeneralQuotes.map(q => (
                        <tr key={q.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-3 font-mono text-xs text-indigo-600">{q.quote_number}</td>
                          <td className="px-4 py-3 text-slate-800">{q.customer_name || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 truncate max-w-[180px]">{q.site_address || '—'}</td>
                          <td className="px-4 py-3 text-slate-500">{q.service_date}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            {q.total > 0 ? `$${q.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button type="button" onClick={() => loadGeneralQuote(q)}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition">
                              <span className="material-symbols-outlined text-[13px]">edit</span>Open &amp; Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

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
              <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden${formLocked ? ' pointer-events-none opacity-75 select-none' : ''}`}>
                {formLocked && (
                  <div className="pointer-events-auto flex items-center justify-between gap-3 bg-amber-50 px-6 py-3 border-b border-amber-100">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                      <span className="material-symbols-outlined text-[15px]">lock</span>
                      Read-only — viewing saved quote
                    </div>
                    <button type="button" onClick={() => { setIsReadOnly(false); setShowPreview(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 transition">
                      <span className="material-symbols-outlined text-[15px]">edit</span>Edit Quote
                    </button>
                  </div>
                )}

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
                    {(['CUSTOMER','TENDER'] as const).map(eu => (
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
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
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
          <div className="px-6 pb-6 space-y-3">

            {/* Door Type + Door Model — two columns */}
            {isRapidDoor && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_REQ_CLS}>Door Type</label>
                  <SelectWrapper>
                    <select value={doorType} onChange={e => setDoorType(e.target.value)} className={SELECT_CLS}>
                      <option value="" disabled>— Select door type —</option>
                      {opts('door_type').map(dt => <option key={dt.code} value={dt.code}>{dt.label || dt.code}</option>)}
                    </select>
                  </SelectWrapper>
                </div>
                <div>
                  <label className={LABEL_REQ_CLS}>Guide Width <span className="normal-case font-normal after:content-none">(*If Applicable)</span></label>
                  <SelectWrapper>
                    <select value={doorModel} onChange={e => setDoorModel(e.target.value)} className={SELECT_CLS} disabled={!doorType}>
                      <option value="" disabled>— Select model —</option>
                      {opts('door_model').map(o => <option key={o.code} value={o.code}>{o.label || o.code}</option>)}
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
                    <label className={LABEL_REQ_CLS}>Clear Width <span className="normal-case font-normal after:content-none">(mm)</span></label>
                    <input type="number" min={0} placeholder="e.g. 2500" value={openingW} onChange={e => setOpeningW(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_REQ_CLS}>Clear Height <span className="normal-case font-normal after:content-none">(mm)</span></label>
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
                    <label className={LABEL_REQ_CLS}>Frame Material</label>
                    <SelectWrapper>
                      <select value={frame} onChange={e => setFrame(e.target.value)} className={SELECT_CLS}>
                        <option value="" disabled>— Select frame —</option>
                        {opts('frame').map(o => <option key={o.code} value={o.code}>{o.label || o.code}</option>)}
                      </select>
                    </SelectWrapper>
                  </div>
                  <div>
                    <label className={LABEL_REQ_CLS}>Curtain Material</label>
                    <SelectWrapper>
                      <select value={curtain} onChange={e => setCurtain(e.target.value)} className={SELECT_CLS}>
                        <option value="" disabled>— Select curtain —</option>
                        {opts('curtain').map(o => <option key={o.code} value={o.code}>{o.label || o.code}</option>)}
                      </select>
                    </SelectWrapper>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_REQ_CLS}>Colour (Curtain)</label>
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
                  <div>
                    <label className={LABEL_CLS}>Colour (Safety Edge)</label>
                    <div className="relative" ref={safetyEdgeColourRef}>
                      <button type="button" onClick={() => setSafetyEdgeColourOpen(o => !o)}
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                        {safetyEdgeColour ? (
                          <>
                            <span className="h-6 w-10 shrink-0 rounded-md border border-slate-200"
                              style={{ backgroundColor: opts('safetyEdgeColour').find(c => c.code === safetyEdgeColour)?.hexColour ?? '#e5e7eb' }} />
                            <span className="truncate">{safetyEdgeColour}</span>
                          </>
                        ) : <span className="text-slate-400">— None —</span>}
                        <span className="material-symbols-outlined ml-auto text-slate-400 text-lg pointer-events-none">expand_more</span>
                      </button>
                      {safetyEdgeColourOpen && (
                        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                          <button key="" type="button"
                            onClick={() => { setSafetyEdgeColour(''); setSafetyEdgeColourOpen(false) }}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition hover:bg-slate-50 ${!safetyEdgeColour ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400'}`}>
                            — None —
                          </button>
                          {opts('safetyEdgeColour').map(c => (
                            <button key={c.code} type="button"
                              onClick={() => { setSafetyEdgeColour(c.code); setSafetyEdgeColourOpen(false) }}
                              className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition hover:bg-slate-50 ${safetyEdgeColour === c.code ? 'bg-indigo-50 text-indigo-700' : 'text-slate-800'}`}>
                              <span className="h-6 w-10 shrink-0 rounded-md border border-slate-200" style={{ backgroundColor: c.hexColour ?? '#e5e7eb' }} />
                              {c.code}
                              {safetyEdgeColour === c.code && <span className="material-symbols-outlined ml-auto text-indigo-500 text-base">check</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>


</>
            )}

            {/* Continue button — non-rapid-door */}
            {selected && !isRapidDoor && (
              <div className="pt-2">
                <button type="button" disabled={!selected}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40">
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  Continue
                </button>
              </div>
            )}
          </div>
          )}{/* end !isMaintenance && !isGeneral && !isParts wrapper */}

          {/* ── Customer Details ── */}
          {showRightPanel && (
            <div className="mt-4 mx-1 mb-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                      ['Address',  custAddress,  setCustAddress,  'Street address',        true],
                      ['Postcode', custPostcode, setCustPostcode, '3000',                   false],
                      ['Email',    custEmail,    setCustEmail,    'contact@company.com.au', false],
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

          {/* ── Abbreviation Legend ── */}
          {showRightPanel && (() => {
            const legendItems = [
              { label: 'Door Type',       code: doorType,   category: 'door_type'        },
              { label: 'Frame',           code: frame,      category: 'frame'            },
              { label: 'Curtain',         code: curtain,    category: 'curtain'          },
              { label: 'Colour',          code: colour,     category: 'colour'           },
              { label: 'Safety Edge Col', code: safetyEdgeColour, category: 'safetyEdgeColour' },
            ].filter(item => !!item.code).map(item => ({
              ...item,
              description: opts(item.category).find(o => o.code === item.code)?.description || '',
            })).filter(item => !!item.description)

            if (legendItems.length === 0) return null
            return (
              <div className="mt-3 mx-1 mb-2 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Abbreviations</p>
                <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                  {legendItems.map(item => (
                    <div key={item.category} className="flex items-baseline gap-1.5 min-w-0">
                      <span className="shrink-0 font-mono text-[10px] font-bold text-slate-500">{item.code}</span>
                      <span className="text-[10px] text-slate-500 truncate">— {item.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* ── RIGHT: door preview + pricing ─────────────────────────────────── */}
        {showRightPanel && (
          <div className="w-[360px] shrink-0">
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

              {/* ── Motor & Control Box sub-card ── */}
              <div className="border-t border-slate-100 px-4 pb-4 pt-4">
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
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Motor Size (kW)</label>
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
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Motor Side</label>
                          <div className="relative">
                            <select value={motorSide} onChange={e => setMotorSide(e.target.value)}
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                              <option value="">—</option>
                              {opts('motorSide').map(o => <option key={o.code} value={o.code}>{o.label || o.code}</option>)}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">expand_more</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Control Box Side</label>
                          <div className="relative">
                            <select value={cbSide} onChange={e => setCbSide(e.target.value)}
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                              <option value="">—</option>
                              {opts('controlBoxSide').map(o => <option key={o.code} value={o.code}>{o.label || o.code}</option>)}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">expand_more</span>
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">Door Control</label>
                          <div className="relative">
                            <select value={doorControl} onChange={e => setDoorControl(e.target.value)}
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                              <option value="">—</option>
                              {opts('doorControl').map(o => <option key={o.code} value={o.code}>{o.label || o.code}</option>)}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">expand_more</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Safety / Detection sub-card ── */}
              <div className="border-t border-slate-100 px-4 py-4">
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <button type="button" onClick={() => setShowSafety(v => !v)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2.5 transition"
                    style={{ backgroundColor: '#92D050' }}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-white">verified_user</span>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white">Safety / Detection</p>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-white">{showSafety ? 'expand_less' : 'expand_more'}</span>
                  </button>
                  {showSafety && (
                    <div className="p-4 grid grid-cols-2 gap-3">
                      {SAFETY_FEATURES_KEYS.map(field => (
                        <div key={field.key}>
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">{field.label}</label>
                          {field.key === 'safetyOther' ? (
                            <textarea value={safetyValues[field.key] ?? ''} onChange={e => { setSafetyField(field.key, e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                              placeholder="Other…" rows={1}
                              className="w-full resize-none overflow-hidden rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
                          ) : (
                            <div className="relative">
                              <select value={safetyValues[field.key] ?? ''} onChange={e => setSafetyField(field.key, e.target.value)}
                                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                                <option value="">— None —</option>
                                {opts(field.key).map(o => <option key={o.code} value={o.code}>{o.label || o.code}</option>)}
                              </select>
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">expand_more</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Activation sub-card ── */}
              <div className="border-t border-slate-100 px-4 pb-4">
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
                          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">{field.label}</label>
                          {field.key === 'swipe' ? (
                            <div className="space-y-1.5">
                              {swipeManual ? (
                                <input value={safetyValues['swipe'] ?? ''} onChange={e => setSafetyField('swipe', e.target.value)}
                                  placeholder="Type value…" autoFocus
                                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-3 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
                              ) : (
                                <div className="relative">
                                  <select value={safetyValues['swipe'] ?? ''} onChange={e => setSafetyField('swipe', e.target.value)}
                                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                                    <option value="">— None —</option>
                                    {opts('swipe').map(o => <option key={o.code} value={o.code}>{o.label || o.code}</option>)}
                                  </select>
                                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">expand_more</span>
                                </div>
                              )}
                              <button type="button" onClick={() => { setSwipeManual(v => !v); setSafetyField('swipe', '') }}
                                className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                                <span className="material-symbols-outlined text-[14px]">{swipeManual ? 'list' : 'edit'}</span>
                                {swipeManual ? 'Pick from list' : 'Enter manually'}
                              </button>
                            </div>
                          ) : (
                            <div className="relative">
                              <select value={safetyValues[field.key] ?? ''} onChange={e => setSafetyField(field.key, e.target.value)}
                                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                                <option value="">— None —</option>
                                {opts(field.key).map(o => <option key={o.code} value={o.code}>{o.label || o.code}</option>)}
                              </select>
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">expand_more</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

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
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">Demolition Cost</label>
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
                  <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
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
      {!isGeneral && showPreview && previewUrl && (
        <div ref={previewRef} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-indigo-600 text-xl">picture_as_pdf</span>
              <div>
                <h2 className="text-base font-semibold text-slate-800">Quotation Preview</h2>
                {quoteNumber && <p className="text-xs text-slate-400">{quoteNumber}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isMaintenance && (
                <button type="button" onClick={handleSaveMaintenance}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  {maintQuoteIdRef.current ? 'Update' : 'Save Quote'}
                </button>
              )}
              {isParts && (
                <button type="button" onClick={handleSaveParts}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  {partsQuoteIdRef.current ? 'Update' : 'Save Quote'}
                </button>
              )}
              {isPvcFlex && (
                <button type="button" onClick={handleSavePvcFlex}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  {pvcFlexQuoteIdRef.current ? 'Update' : 'Save Quote'}
                </button>
              )}
              <button type="button" onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600">
                <span className="material-symbols-outlined text-[16px]">download</span>
                Download PDF
              </button>
              <button type="button" onClick={openEmailModal}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">
                <span className="material-symbols-outlined text-[16px]">send</span>
                Send Email
              </button>
              <button type="button" onClick={handleEditQuote}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50">
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Edit
              </button>
              {editingId && (
                <button type="button" onClick={() => openWorkflowModal(editingId)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700">
                  <span className="material-symbols-outlined text-[16px]">timeline</span>
                  Workflow
                </button>
              )}
            </div>
          </div>
          {(isMaintenance && maintSaveMsg) && (
            <div className={`px-6 py-2 text-sm font-medium flex items-center gap-2 ${maintSaveMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              <span className="material-symbols-outlined text-[16px]">{maintSaveMsg.ok ? 'check_circle' : 'error'}</span>
              {maintSaveMsg.text}
            </div>
          )}
          {(isParts && partsSaveMsg) && (
            <div className={`px-6 py-2 text-sm font-medium flex items-center gap-2 ${partsSaveMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              <span className="material-symbols-outlined text-[16px]">{partsSaveMsg.ok ? 'check_circle' : 'error'}</span>
              {partsSaveMsg.text}
            </div>
          )}
          {(isPvcFlex && pvcFlexSaveMsg) && (
            <div className={`px-6 py-2 text-sm font-medium flex items-center gap-2 ${pvcFlexSaveMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              <span className="material-symbols-outlined text-[16px]">{pvcFlexSaveMsg.ok ? 'check_circle' : 'error'}</span>
              {pvcFlexSaveMsg.text}
            </div>
          )}
          {isSafari ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 px-6">
              <span className="material-symbols-outlined text-4xl text-slate-400">picture_as_pdf</span>
              <p className="text-sm text-slate-600 text-center max-w-sm">
                Safari doesn&apos;t support displaying this PDF in the embedded preview. Open the PDF in a new tab to view or download it.
              </p>
              <button type="button" onClick={() => { const w = window.open(); if (w) w.location.href = previewUrl! }}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-slate-700">
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                Open PDF in New Tab
              </button>
            </div>
          ) : (
            <iframe src={previewUrl!} className="w-full border-0" style={{ height: '900px' }} title="Quote Preview" />
          )}
        </div>
      )}

      {/* ── Recent Maintenance Quotes — shown on dashboard only ─────────────── */}
      {false && isMaintenance && !editingId && (() => {
        const RecentTable = ({ rows, loading, onOpen, onRefresh }: { rows: SavedQuoteRow[]; loading: boolean; onOpen: (r: SavedQuoteRow) => void; onRefresh: () => void; label: string }) => (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 text-xl">history</span>
                <h2 className="text-base font-semibold text-slate-800">Recent Maintenance / Repair Quotes</h2>
              </div>
              <button type="button" onClick={onRefresh} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition">
                <span className="material-symbols-outlined text-[14px]">refresh</span>Refresh
              </button>
            </div>
            {loading ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No saved quotes yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Quote No.</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Address</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Total (inc GST)</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(q => (
                      <tr key={q.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3 font-mono text-xs text-indigo-600">{q.quote_number}</td>
                        <td className="px-4 py-3 text-slate-800">{q.customer_name || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 truncate max-w-[180px]">{q.site_address || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{q.service_date}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {q.total > 0 ? `$${q.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => onOpen(q)}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition">
                            <span className="material-symbols-outlined text-[13px]">edit</span>Open &amp; Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
        return <RecentTable rows={recentMaintQuotes} loading={recentMaintLoading} onOpen={loadMaintQuote} onRefresh={loadRecentMaintQuotes} label="Maintenance / Repair" />
      })()}

      {/* ── Recent Parts Quotes — shown on dashboard only ───────────────────── */}
      {false && isParts && !editingId && (() => {
        const RecentTable = ({ rows, loading, onOpen, onRefresh }: { rows: SavedQuoteRow[]; loading: boolean; onOpen: (r: SavedQuoteRow) => void; onRefresh: () => void }) => (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 text-xl">history</span>
                <h2 className="text-base font-semibold text-slate-800">Recent Parts Quotes</h2>
              </div>
              <button type="button" onClick={onRefresh} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition">
                <span className="material-symbols-outlined text-[14px]">refresh</span>Refresh
              </button>
            </div>
            {loading ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No saved quotes yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Quote No.</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Address</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Total (inc GST)</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(q => (
                      <tr key={q.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3 font-mono text-xs text-indigo-600">{q.quote_number}</td>
                        <td className="px-4 py-3 text-slate-800">{q.customer_name || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 truncate max-w-[180px]">{q.site_address || '—'}</td>
                        <td className="px-4 py-3 text-slate-500">{q.service_date}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {q.total > 0 ? `$${q.total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" onClick={() => onOpen(q)}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition">
                            <span className="material-symbols-outlined text-[13px]">edit</span>Open &amp; Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
        return <RecentTable rows={recentPartsQuotes} loading={recentPartsLoading} onOpen={loadPartsQuote} onRefresh={loadRecentPartsQuotes} />
      })()}

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

      {/* Workflow modal — available from preview panel Workflow button */}
      {workflowQuoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeWorkflowModal}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Quote Workflow</h2>
              <button type="button" onClick={closeWorkflowModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="p-5">
              {workflowLoading && !workflowState ? (
                <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                  <span className="text-sm">Loading workflow…</span>
                </div>
              ) : (
                <ServiceQuoteWorkflowPanel
                  quoteId={workflowQuoteId}
                  workflow={workflowState}
                  isManager={isWorkflowManager}
                  onUpdated={() => { loadWorkflowState(workflowQuoteId!); loadRecentQuotes() }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
