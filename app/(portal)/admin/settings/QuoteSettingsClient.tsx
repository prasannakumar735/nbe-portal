'use client'
import { useEffect, useState } from 'react'

// ── Default dropdown values per quote type ────────────────────────────────────
const DEFAULTS = {
  INDUSTRIAL_RAPID_DOOR: {
    doorTypes:       ['PE01', 'SP01', 'FR01', 'CAD01', 'CL01', 'ES01'],
    frameOptions:    ['GAL', 'P/C', 'S/S'],
    curtainOptions:  ['PVC900', 'INSUL', 'FRZ', 'MESH'],
    motorKwOptions:  ['0.75', '1.5', '2.2', '3'],
    motorSideOptions: ['RHD', 'LHD'],
    controlBoxOptions: ['RIGHT', 'LEFT'],
    safetyOptions: {
      safety:        ['PEC', 'SLC', 'TL'],
      pushButton:    ['PB01', 'PB02', 'PB05'],
      radar:         ['RADAR', '-'],
      remoteControl: ['R/C-4', 'R/C-8', 'R/C-16'],
      inductLoop:    ['I/L', '-'],
      swipe:         ['SWIPE', '-'],
    },
  },
  PVC_FLEX_SYSTEM: {
    stripTypes:      ['Standard PVC', 'Ribbed PVC', 'Anti-static', 'Polar'],
    widths:          ['200mm', '300mm', '400mm'],
    thicknesses:     ['2mm', '3mm', '4mm'],
    colours:         ['Clear', 'Yellow', 'Blue', 'Red', 'Orange'],
  },
  MAINTENANCE_SERVICE_REPAIR: {
    serviceTypes:    ['Preventive Maintenance', 'Corrective Repair', 'Emergency Callout', 'Annual Inspection'],
    doorBrands:      ['NBE', 'Dynaco', 'Assa Abloy', 'Other'],
    technicianRates: ['Standard', 'After Hours', 'Emergency'],
  },
  PARTS: {
    partCategories:  ['Motor', 'Drive Belt', 'Control Board', 'Curtain Panel', 'Sensor', 'Other'],
    suppliers:       ['NBE Stock', 'Supplier A', 'Supplier B', 'Import'],
  },
  GENERAL: {
    serviceCategories: ['Supply', 'Installation', 'Consultation', 'Other'],
    paymentTerms:      ['14 days', '30 days', '45 days', 'COD'],
  },
}

const STORAGE_KEY = 'nbe_quote_settings_v1'

type Settings = typeof DEFAULTS

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { return DEFAULTS }
}

function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

const QUOTE_TYPE_LABELS: Record<string, string> = {
  INDUSTRIAL_RAPID_DOOR:      'Industrial Rapid Door',
  PVC_FLEX_SYSTEM:            'PVC Flex System',
  MAINTENANCE_SERVICE_REPAIR: 'Maintenance Service / Repair',
  PARTS:                      'Parts',
  GENERAL:                    'General',
}

function TagEditor({
  label, values, onChange,
}: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')

  function addItem() {
    const v = draft.trim()
    if (!v || values.includes(v)) return
    onChange([...values, v])
    setDraft('')
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-1.5 min-h-[32px] rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
        {values.map(v => (
          <span key={v} className="flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 shadow-sm">
            {v}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))}
              className="ml-0.5 text-slate-400 hover:text-red-500 transition">
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        <input
          type="text" value={draft} placeholder="Add value…"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
        />
        <button type="button" onClick={addItem}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition">
          Add
        </button>
      </div>
    </div>
  )
}

export function QuoteSettingsClient() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [activeType, setActiveType] = useState<keyof Settings>('INDUSTRIAL_RAPID_DOOR')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  function updateField(type: keyof Settings, field: string, values: string[]) {
    setSettings(prev => ({
      ...prev,
      [type]: { ...(prev[type] as Record<string, unknown>), [field]: values },
    }) as Settings)
  }

  function updateSafetyField(field: string, values: string[]) {
    const ird = settings.INDUSTRIAL_RAPID_DOOR
    setSettings(prev => ({
      ...prev,
      INDUSTRIAL_RAPID_DOOR: {
        ...prev.INDUSTRIAL_RAPID_DOOR,
        safetyOptions: { ...ird.safetyOptions, [field]: values },
      },
    }))
  }

  function handleSave() {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function handleReset() {
    setSettings(DEFAULTS)
    saveSettings(DEFAULTS)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const currentType = settings[activeType] as Record<string, string[] | Record<string, string[]>>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Quote Settings</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage the dropdown values available in each quote type. Changes apply immediately in the New Quotes module.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleReset}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            Reset defaults
          </button>
          <button type="button" onClick={handleSave}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
              saved ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}>
            <span className="material-symbols-outlined text-[16px]">{saved ? 'check' : 'save'}</span>
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Quote type selector */}
      <div className="flex gap-1 flex-wrap">
        {(Object.keys(QUOTE_TYPE_LABELS) as (keyof Settings)[]).map(type => (
          <button key={type} type="button"
            onClick={() => setActiveType(type)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeType === type
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}>
            {QUOTE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* Fields for selected type */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">{QUOTE_TYPE_LABELS[activeType]}</h3>
          <span className="text-xs text-slate-400">— dropdown values</span>
        </div>

        {activeType === 'INDUSTRIAL_RAPID_DOOR' && (() => {
          const ird = settings.INDUSTRIAL_RAPID_DOOR
          return (
            <div className="grid grid-cols-2 gap-5">
              <TagEditor label="Door Types" values={ird.doorTypes} onChange={v => updateField('INDUSTRIAL_RAPID_DOOR', 'doorTypes', v)} />
              <TagEditor label="Frame Options" values={ird.frameOptions} onChange={v => updateField('INDUSTRIAL_RAPID_DOOR', 'frameOptions', v)} />
              <TagEditor label="Curtain Options" values={ird.curtainOptions} onChange={v => updateField('INDUSTRIAL_RAPID_DOOR', 'curtainOptions', v)} />
              <TagEditor label="Motor kW Options" values={ird.motorKwOptions} onChange={v => updateField('INDUSTRIAL_RAPID_DOOR', 'motorKwOptions', v)} />
              <TagEditor label="Motor Side Options" values={ird.motorSideOptions} onChange={v => updateField('INDUSTRIAL_RAPID_DOOR', 'motorSideOptions', v)} />
              <TagEditor label="Control Box Options" values={ird.controlBoxOptions} onChange={v => updateField('INDUSTRIAL_RAPID_DOOR', 'controlBoxOptions', v)} />
              <div className="col-span-2">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Safety / Detection Options</p>
                <div className="grid grid-cols-3 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  {(Object.entries(ird.safetyOptions) as [string, string[]][]).map(([key, vals]) => (
                    <TagEditor key={key} label={key} values={vals} onChange={v => updateSafetyField(key, v)} />
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {activeType === 'PVC_FLEX_SYSTEM' && (() => {
          const pvc = settings.PVC_FLEX_SYSTEM
          return (
            <div className="grid grid-cols-2 gap-5">
              <TagEditor label="Strip Types" values={pvc.stripTypes} onChange={v => updateField('PVC_FLEX_SYSTEM', 'stripTypes', v)} />
              <TagEditor label="Widths" values={pvc.widths} onChange={v => updateField('PVC_FLEX_SYSTEM', 'widths', v)} />
              <TagEditor label="Thicknesses" values={pvc.thicknesses} onChange={v => updateField('PVC_FLEX_SYSTEM', 'thicknesses', v)} />
              <TagEditor label="Colours" values={pvc.colours} onChange={v => updateField('PVC_FLEX_SYSTEM', 'colours', v)} />
            </div>
          )
        })()}

        {activeType === 'MAINTENANCE_SERVICE_REPAIR' && (() => {
          const msr = settings.MAINTENANCE_SERVICE_REPAIR
          return (
            <div className="grid grid-cols-2 gap-5">
              <TagEditor label="Service Types" values={msr.serviceTypes} onChange={v => updateField('MAINTENANCE_SERVICE_REPAIR', 'serviceTypes', v)} />
              <TagEditor label="Door Brands" values={msr.doorBrands} onChange={v => updateField('MAINTENANCE_SERVICE_REPAIR', 'doorBrands', v)} />
              <TagEditor label="Technician Rates" values={msr.technicianRates} onChange={v => updateField('MAINTENANCE_SERVICE_REPAIR', 'technicianRates', v)} />
            </div>
          )
        })()}

        {activeType === 'PARTS' && (() => {
          const parts = settings.PARTS
          return (
            <div className="grid grid-cols-2 gap-5">
              <TagEditor label="Part Categories" values={parts.partCategories} onChange={v => updateField('PARTS', 'partCategories', v)} />
              <TagEditor label="Suppliers" values={parts.suppliers} onChange={v => updateField('PARTS', 'suppliers', v)} />
            </div>
          )
        })()}

        {activeType === 'GENERAL' && (() => {
          const gen = settings.GENERAL
          return (
            <div className="grid grid-cols-2 gap-5">
              <TagEditor label="Service Categories" values={gen.serviceCategories} onChange={v => updateField('GENERAL', 'serviceCategories', v)} />
              <TagEditor label="Payment Terms" values={gen.paymentTerms} onChange={v => updateField('GENERAL', 'paymentTerms', v)} />
            </div>
          )
        })()}
      </div>

      <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
        <span className="font-semibold">Note:</span> Quote settings are currently stored in your browser. Supabase persistence will be added in a future update so settings are shared across all staff.
      </div>
    </div>
  )
}
