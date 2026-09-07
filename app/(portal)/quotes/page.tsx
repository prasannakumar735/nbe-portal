'use client'
import { useEffect, useRef, useState } from 'react'
import { loadDoorImageStyle } from '@/app/(portal)/admin/settings/QuoteSettingsClient'

// ── Quote number helpers ──────────────────────────────────────────────────────
function todayKey(): string {
  const d = new Date()
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
function nextRapidDoorSequence(): number {
  const key = `nbe_qrrd_seq_${todayKey()}`
  const prev = parseInt(localStorage.getItem(key) ?? '0', 10) || 0
  const next = prev + 1
  localStorage.setItem(key, String(next))
  return next
}
function buildRapidDoorQuoteNumber(seq: number): string {
  return `QRRD${todayKey()}${String(seq).padStart(2, '0')}`
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

const DOOR_TYPE_NAMES: Record<string, string> = {
  PE01: 'Performance Rapid Door', SP01: 'Speed Rapid Door',
  FR01: 'Freezer Rapid Door', CAD01: 'CAD Rapid Door',
  CL01: 'Clean Room Rapid Door', ES01: 'ES Rapid Door',
}
const FRAME_NAMES: Record<string, string> = { 'GAL': 'Galvanized', 'P/C': 'Powder Coated', 'S/S': 'Stainless Steel' }
const FRAME_OPTIONS       = ['GAL', 'P/C', 'S/S']
const CURTAIN_OPTIONS     = ['PVC900', 'INSUL', 'FRZ', 'MESH']
const MOTOR_KW_OPTIONS    = ['0.75', '1.5', '2.2', '3']
const MOTOR_SIDE_OPTIONS  = ['RHD', 'LHD']
const CONTROL_BOX_OPTIONS = ['RIGHT', 'LEFT']
const SAFETY_DETECTION: { key: string; label: string; options: string[] }[] = [
  { key: 'safety',        label: 'Safety',         options: ['PEC', 'SLC', 'TL'] },
  { key: 'pushButton',    label: 'Push Button',     options: ['PB01', 'PB02', 'PB05'] },
  { key: 'radar',         label: 'Radar',           options: ['RADAR', '-'] },
  { key: 'remoteControl', label: 'Remote Control',  options: ['R/C-4', 'R/C-8', 'R/C-16'] },
  { key: 'inductLoop',    label: 'Induct. Loop',    options: ['I/L', '-'] },
  { key: 'swipe',         label: 'Swipe',           options: ['SWIPE', '-'] },
]
const COLOUR_OPTIONS: { label: string; hex: string }[] = [
  { label: 'BL 543', hex: '#1B52D4' }, { label: 'RD 356', hex: '#DC2626' },
  { label: 'YL 119', hex: '#EAB308' }, { label: 'OR 244', hex: '#F97316' },
  { label: 'GR 679', hex: '#16A34A' }, { label: 'GY 729', hex: '#9CA3AF' },
  { label: 'TBC',    hex: '#E5E7EB' },
]
const QUOTE_TYPES = [
  { value: 'GENERAL',                    label: 'General',                       icon: 'description', description: 'Standard quotation for general works and services' },
  { value: 'INDUSTRIAL_RAPID_DOOR',      label: 'Industrial Rapid Door',         icon: 'garage',      description: 'Supply and installation of industrial rapid roller doors' },
  { value: 'PVC_FLEX_SYSTEM',            label: 'PVC Flex System',               icon: 'view_column', description: 'PVC strip curtain systems and flexible door solutions' },
  { value: 'MAINTENANCE_SERVICE_REPAIR', label: 'Maintenance Service / Repair',  icon: 'build',       description: 'Scheduled maintenance, service calls and repair works' },
  { value: 'PARTS',                      label: 'Parts',                         icon: 'settings',    description: 'Spare parts and component supply only' },
]

const SELECT_CLS = 'w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
const LABEL_CLS  = 'mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400'
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
  safetyLines: string[]
  safetyByCategory: Record<string, string>
  qty: number
  unitPrice: number
  installation: number
  demolition: number
  equipHire: number
  accTravel: number
  lineTotal: number
  customDesc: string | null
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NewQuotesPage() {
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
  const [cbSide,        setCbSide]       = useState('')
  const [qty,           setQty]          = useState('1')
  const [unitPrice,     setUnitPrice]    = useState('')
  const [safetyEnabled, setSafetyEnabled]= useState(false)
  const [safetyValues,  setSafetyValues] = useState<Record<string, string>>({})
  const [installation,  setInstallation] = useState('')
  const [demolition,    setDemolition]   = useState('')
  const [equipHire,     setEquipHire]    = useState('')
  const [accTravel,     setAccTravel]    = useState('')

  // Quotation description (editable)
  const [editingDesc, setEditingDesc]   = useState(false)
  const [customDesc,  setCustomDesc]    = useState<string | null>(null)
  const [tempDesc,    setTempDesc]      = useState('')

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
  const [generating,   setGenerating]   = useState(false)
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null)
  const [showPreview,  setShowPreview]  = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailTo,        setEmailTo]        = useState('')
  const [emailSending,   setEmailSending]   = useState(false)
  const [emailResult,    setEmailResult]    = useState<string | null>(null)
  const NBE_DOMAIN = 'nbeaustralia.com.au'
  const emailValid = emailTo.trim().toLowerCase().endsWith(`@${NBE_DOMAIN}`) && emailTo.includes('@')

  // Colour dropdown
  const [colourOpen, setColourOpen] = useState(false)
  const colourRef = useRef<HTMLDivElement>(null)

  function setSafetyField(key: string, val: string) {
    setSafetyValues(prev => ({ ...prev, [key]: val }))
  }

  function resetDoorForm() {
    setDoorType(''); setDoorModel(''); setOpeningW(''); setOpeningH(''); setFrame(''); setCurtain('')
    setColour(''); setMotorKw(''); setMotorSide(''); setCbSide(''); setQty('1')
    setUnitPrice(''); setSafetyEnabled(false); setSafetyValues({})
    setInstallation(''); setDemolition(''); setEquipHire(''); setAccTravel('')
    setCustomDesc(null); setEditingDesc(false)
  }

  function resetAll() {
    resetDoorForm()
    setQuoteNumber(null)
    setSavedDoors([])
    setPreviewUrl(null)
    setShowPreview(false)
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colourRef.current && !colourRef.current.contains(e.target as Node)) setColourOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Cleanup blob URL on unmount
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  // ── Derived values ──────────────────────────────────────────────────────────
  const qtyN      = parseFloat(qty) || 1
  const unitN     = parseFloat(unitPrice) || 0
  const instN     = parseFloat(installation) || 0
  const demolN    = parseFloat(demolition) || 0
  const equipN    = parseFloat(equipHire) || 0
  const travN     = parseFloat(accTravel) || 0
  const lineTotal = qtyN * unitN + instN + demolN + equipN + travN

  const safetySelected = Object.values(safetyValues).filter(v => v && v !== '-')

  const autoDescLines = [
    doorType && DOOR_TYPE_NAMES[doorType] ? `${doorType} | ${DOOR_TYPE_NAMES[doorType]}` : '',
    openingW && openingH ? `${openingW} W × ${openingH} H mm` : '',
    [frame && FRAME_NAMES[frame] ? `${FRAME_NAMES[frame]} frame` : '', curtain, colour, motorSide].filter(Boolean).join(' | '),
    safetyEnabled && safetySelected.length > 0 ? `CONTROLS: ${safetySelected.join(' | ')}` : '',
  ].filter(Boolean)

  const displayDesc = customDesc ?? autoDescLines.join('\n')

  const isRapidDoor   = selected === 'INDUSTRIAL_RAPID_DOOR'
  const showRightPanel = isRapidDoor && !!doorType

  const grandTotal = lineTotal + savedDoors.reduce((sum, d) => sum + d.lineTotal, 0)

  const customerFilled = !!custName && !!custAddress
  const { ew: extW, eh: extH } = doorType && doorModel && openingW && openingH
    ? calcExternal(openingW, openingH, doorType, doorModel)
    : { ew: '', eh: '' }

  const canGenerate = !generating && !!doorType && !!doorModel && !!openingW && !!openingH && !!frame &&
    !!curtain && !!colour && !!motorKw && !!motorSide && !!cbSide && !!qty && !!unitPrice &&
    safetyEnabled && safetySelected.length > 0 &&
    (custCanBeBlank || customerFilled)

  // ── Save current door to locked list ────────────────────────────────────────
  function saveCurrentDoor() {
    const door: SavedDoor = {
      id: crypto.randomUUID(),
      doorType, doorModel, openingW, openingH, frame, curtain, colour,
      motorKw, motorSide, cbSide,
      safetyLines: safetySelected,
      safetyByCategory: { ...safetyValues },
      qty: qtyN, unitPrice: unitN,
      installation: instN, demolition: demolN, equipHire: equipN, accTravel: travN,
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
    setMotorKw(d.motorKw); setMotorSide(d.motorSide); setCbSide(d.cbSide)
    setQty(String(d.qty)); setUnitPrice(String(d.unitPrice))
    setInstallation(d.installation > 0 ? String(d.installation) : '')
    setDemolition(d.demolition > 0 ? String(d.demolition) : '')
    setEquipHire(d.equipHire > 0 ? String(d.equipHire) : '')
    setAccTravel(d.accTravel > 0 ? String(d.accTravel) : '')
    setCustomDesc(d.customDesc); setEditingDesc(false)
    // Safety: reconstruct safetyValues map from safetyLines
    if (d.safetyLines.length > 0) {
      setSafetyEnabled(true)
      // We can't reconstruct per-field mapping perfectly, so put first 6 into the keys
      const keys = ['safety','pushButton','radar','remoteControl','inductLoop','swipe']
      const vals: Record<string,string> = {}
      d.safetyLines.forEach((v, i) => { if (keys[i]) vals[keys[i]] = v })
      setSafetyValues(vals)
    } else {
      setSafetyEnabled(false); setSafetyValues({})
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
      const qn = quoteNumber ?? buildRapidDoorQuoteNumber(nextRapidDoorSequence())
      if (!quoteNumber) setQuoteNumber(qn)

      const validDate = new Date()
      validDate.setDate(validDate.getDate() + 30)
      const validUntil = `${String(validDate.getDate()).padStart(2,'0')}/${String(validDate.getMonth()+1).padStart(2,'0')}/${validDate.getFullYear()}`

      // Build all doors (saved + current)
      const allDoors = [
        ...savedDoors.map(d => {
          const { ew, eh } = calcExternal(d.openingW, d.openingH, d.doorType, d.doorModel ?? '')
          return {
            doorType: d.doorType, doorTypeName: DOOR_TYPE_NAMES[d.doorType] ?? d.doorType,
            doorModel: d.doorModel,
            openingW: d.openingW, openingH: d.openingH,
            externalW: ew, externalH: eh,
            frameRaw: d.frame,
            frame: FRAME_NAMES[d.frame] ?? d.frame,
            curtain: d.curtain, colour: d.colour,
            motorKw: d.motorKw, motorSide: d.motorSide, cbSide: d.cbSide,
            safetyLines: d.safetyLines,
            safetyByCategory: d.safetyByCategory,
            qty: d.qty, unitPrice: d.unitPrice,
            installation: d.installation, demolition: d.demolition,
            equipHire: d.equipHire, accTravel: d.accTravel,
            lineTotal: d.lineTotal, customDesc: d.customDesc,
            colourCode: COLOUR_IMAGE_CODE[d.colour] ?? null,
          }
        }),
        {
          doorType, doorTypeName: DOOR_TYPE_NAMES[doorType] ?? doorType,
          doorModel,
          openingW, openingH,
          externalW: extW, externalH: extH,
          frameRaw: frame,
          frame: FRAME_NAMES[frame] ?? frame,
          curtain, colour,
          motorKw, motorSide, cbSide,
          safetyLines: safetySelected,
          safetyByCategory: { ...safetyValues },
          qty: qtyN, unitPrice: unitN,
          installation: instN, demolition: demolN, equipHire: equipN, accTravel: travN,
          lineTotal, customDesc,
          colourCode: COLOUR_IMAGE_CODE[colour] ?? null,
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
    a.download = `${quoteNumber}_CUSTOMER_(SUMMARY).pdf`
    a.click()
  }

  function handleEditQuote() {
    setShowPreview(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Quotes</h1>
        <p className="mt-1 text-sm text-slate-500">Create and manage quotations — PVC, Service, Repair &amp; Rapid Door</p>
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
      <div className={`flex gap-6 items-stretch ${showRightPanel ? '' : 'max-w-2xl'}`}>

        {/* ── LEFT: form card ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
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

            {/* Door Type */}
            {isRapidDoor && (
              <div>
                <label className={LABEL_CLS}>Door Type</label>
                <SelectWrapper>
                  <select value={doorType} onChange={e => setDoorType(e.target.value)} className={SELECT_CLS}>
                    <option value="" disabled>— Select door type —</option>
                    {RAPID_DOOR_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                  </select>
                </SelectWrapper>
              </div>
            )}

            {/* Fields shown once door type chosen */}
            {isRapidDoor && doorType && (
              <>
                {/* Door Model */}
                <div>
                  <label className={LABEL_CLS}>Door Model</label>
                  <SelectWrapper>
                    <select value={doorModel} onChange={e => setDoorModel(e.target.value)} className={SELECT_CLS}>
                      <option value="" disabled>— Select model —</option>
                      {getDoorModelOptions(doorType).map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </SelectWrapper>
                </div>

                {/* Opening dimensions + derived externals */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLS}>Clear Width <span className="normal-case font-normal">(mm)</span></label>
                    <input type="number" min={0} placeholder="e.g. 2500" value={openingW} onChange={e => setOpeningW(e.target.value)} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Clear Height <span className="normal-case font-normal">(mm)</span></label>
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

                <div>
                  <label className={LABEL_CLS}>Frame</label>
                  <SelectWrapper>
                    <select value={frame} onChange={e => setFrame(e.target.value)} className={SELECT_CLS}>
                      <option value="" disabled>— Select frame —</option>
                      {FRAME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </SelectWrapper>
                </div>

                <div>
                  <label className={LABEL_CLS}>Curtain</label>
                  <SelectWrapper>
                    <select value={curtain} onChange={e => setCurtain(e.target.value)} className={SELECT_CLS}>
                      <option value="" disabled>— Select curtain —</option>
                      {CURTAIN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </SelectWrapper>
                </div>

                <div>
                  <label className={LABEL_CLS}>Colour</label>
                  <div className="relative" ref={colourRef}>
                    <button type="button" onClick={() => setColourOpen(o => !o)}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                      {colour ? (
                        <>
                          <span className="h-6 w-10 shrink-0 rounded-md border border-slate-200"
                            style={{ backgroundColor: COLOUR_OPTIONS.find(c => c.label === colour)?.hex }} />
                          {colour}
                        </>
                      ) : <span className="text-slate-400">— Select colour —</span>}
                      <span className="material-symbols-outlined ml-auto text-slate-400 text-lg">expand_more</span>
                    </button>
                    {colourOpen && (
                      <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                        {COLOUR_OPTIONS.map(c => (
                          <button key={c.label} type="button"
                            onClick={() => { setColour(c.label); setColourOpen(false) }}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition hover:bg-slate-50 ${colour === c.label ? 'bg-indigo-50 text-indigo-700' : 'text-slate-800'}`}>
                            <span className="h-6 w-10 shrink-0 rounded-md border border-slate-200" style={{ backgroundColor: c.hex }} />
                            {c.label}
                            {colour === c.label && <span className="material-symbols-outlined ml-auto text-indigo-500 text-base">check</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL_CLS}>Motor <span className="normal-case font-normal">(kW)</span></label>
                    <SelectWrapper>
                      <select value={motorKw} onChange={e => setMotorKw(e.target.value)} className={SELECT_CLS}>
                        <option value="" disabled>— Select —</option>
                        {MOTOR_KW_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </SelectWrapper>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Motor Side</label>
                    <SelectWrapper>
                      <select value={motorSide} onChange={e => setMotorSide(e.target.value)} className={SELECT_CLS}>
                        <option value="" disabled>— Select —</option>
                        {MOTOR_SIDE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </SelectWrapper>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Control Box Side</label>
                    <SelectWrapper>
                      <select value={cbSide} onChange={e => setCbSide(e.target.value)} className={SELECT_CLS}>
                        <option value="" disabled>— Select —</option>
                        {CONTROL_BOX_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </SelectWrapper>
                  </div>
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
        </div>

        {/* ── RIGHT: door preview + pricing ─────────────────────────────────── */}
        {showRightPanel && (
          <div className="w-[420px] shrink-0">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">

              {/* Door preview header */}
              <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Door Preview</p>
                {colour && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                    <span className="inline-block h-3 w-3 rounded-full border border-slate-200"
                      style={{ backgroundColor: COLOUR_OPTIONS.find(c => c.label === colour)?.hex }} />
                    {colour}
                  </span>
                )}
              </div>

              {/* Door image */}
              {colour && getDoorImageUrl(doorType, colour) ? (
                <div className="relative bg-slate-100 shrink-0">
                  <img key={colour} src={getDoorImageUrl(doorType, colour)!} alt={`${doorType} in ${colour}`}
                    className="w-full object-contain max-h-[280px]" />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent px-4 py-3">
                    <p className="text-xs font-semibold text-white">{doorType} — {DOOR_TYPE_NAMES[doorType]}</p>
                    {curtain && <p className="text-[11px] text-white/70 mt-0.5">{curtain} · {colour}</p>}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 h-36 text-slate-400 shrink-0 bg-slate-50">
                  <span className="material-symbols-outlined text-5xl text-slate-300">garage</span>
                  <p className="text-sm">{colour ? 'No image for this colour' : 'Select a colour to preview'}</p>
                </div>
              )}

              {/* ── Quotation Description — with edit pencil ────────────────── */}
              <div className="mt-6 border-t border-slate-100">
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
              </div>

              {/* ── Safety / Detection ───────────────────────────────────── */}
              <div className="mt-4 border-t border-slate-100">
                <button type="button"
                  onClick={() => { setSafetyEnabled(v => !v); setSafetyValues({}) }}
                  className={`flex w-full items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-wide transition ${safetyEnabled ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">security</span>
                    Safety / Detection
                    <span className="text-red-400">*</span>
                  </div>
                  <span className="material-symbols-outlined text-[18px]">
                    {safetyEnabled ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                </button>
                {safetyEnabled && (
                  <div className="grid grid-cols-3 gap-3 p-4">
                    {SAFETY_DETECTION.map(field => (
                      <div key={field.key}>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">{field.label}</label>
                        <div className="relative">
                          <select value={safetyValues[field.key] ?? ''} onChange={e => setSafetyField(field.key, e.target.value)}
                            className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20">
                            <option value="">— None —</option>
                            {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-base">expand_more</span>
                        </div>
                      </div>
                    ))}
                    {safetySelected.length === 0 && (
                      <p className="col-span-3 text-xs text-red-500">Select at least one safety / detection option</p>
                    )}
                  </div>
                )}
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

      {/* ── Pricing & Generate ────────────────────────────────────────────── */}
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
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Unit Price <span className="normal-case font-normal">(ex GST)</span>
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

            {/* Additional Costs */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Additional Costs</p>
                <span className="text-[10px] text-slate-400 normal-case">(optional)</span>
              </div>
              {!installation && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <span className="material-symbols-outlined text-[14px] text-amber-500">info</span>
                  <p className="text-[11px] text-amber-700">Installation not entered — add if this quote includes installation.</p>
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Installation',           value: installation, set: setInstallation },
                  { label: 'Demolition',             value: demolition,   set: setDemolition },
                  { label: 'Equipment Hire',         value: equipHire,    set: setEquipHire },
                  { label: 'Accommodation & Travel', value: accTravel,    set: setAccTravel },
                ].map(({ label, value, set }) => (
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

            {!custCanBeBlank && !customerFilled && (
              <p className="text-[11px] text-amber-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">info</span>
                Customer name &amp; address required — fill in Customer Details above, or check "can be blank"
              </p>
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
              <button type="button" onClick={() => { setEmailTo(''); setEmailResult(null); setShowEmailModal(true) }}
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

      {/* ── Recent Quotes placeholder ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Recent Quotes</h2>
            <p className="mt-0.5 text-xs text-slate-400">All quotes across types</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
          <span className="material-symbols-outlined text-4xl text-slate-300">receipt_long</span>
          <p className="text-sm">Quote list will appear here</p>
        </div>
      </div>

      {/* ── Email Modal ────────────────────────────────────────────────────── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-indigo-600">send</span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Send Quote via Email</h3>
                  <p className="text-xs text-slate-400">Only @{NBE_DOMAIN} addresses allowed</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-slate-600 transition">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {quoteNumber && (
                <div className="flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2">
                  <span className="material-symbols-outlined text-[14px] text-indigo-500">picture_as_pdf</span>
                  <span className="text-xs font-medium text-indigo-700">{quoteNumber}_CUSTOMER_(SUMMARY).pdf</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={e => { setEmailTo(e.target.value); setEmailResult(null) }}
                  placeholder={`name@${NBE_DOMAIN}`}
                  className={`w-full rounded-xl border py-3 px-4 text-sm font-medium text-slate-800 outline-none transition focus:ring-2 focus:ring-indigo-500/20 ${
                    emailTo && !emailValid
                      ? 'border-red-300 focus:border-red-400'
                      : 'border-slate-200 focus:border-indigo-400'
                  }`}
                />
                {emailTo && !emailValid && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                    <span className="material-symbols-outlined text-[13px]">error</span>
                    Email must be an @{NBE_DOMAIN} address
                  </p>
                )}
                {emailTo && emailValid && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                    Valid NBE Australia address
                  </p>
                )}
              </div>

              {emailResult && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  emailResult.startsWith('✓')
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {emailResult}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setShowEmailModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                type="button"
                disabled={!emailValid || emailSending}
                onClick={async () => {
                  setEmailSending(true)
                  setEmailResult(null)
                  try {
                    // Placeholder — wire up real email API when ready
                    await new Promise(r => setTimeout(r, 1200))
                    setEmailResult(`✓ Quote sent to ${emailTo}`)
                  } catch {
                    setEmailResult('Failed to send. Please try again.')
                  } finally {
                    setEmailSending(false)
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
                {emailSending
                  ? <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>Sending…</>
                  : <><span className="material-symbols-outlined text-[16px]">send</span>Send</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
