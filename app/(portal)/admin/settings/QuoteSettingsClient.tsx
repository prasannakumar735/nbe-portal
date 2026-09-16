'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// ── Image style (still localStorage — it's a per-device UI preference) ────────
export const IMAGE_STYLE_KEY = 'nbe_quote_image_style_v1'
export type DoorImageStyle = 'withText' | 'withOutText'
export function loadDoorImageStyle(): DoorImageStyle {
  try { return (localStorage.getItem(IMAGE_STYLE_KEY) as DoorImageStyle) || 'withOutText' } catch { return 'withOutText' }
}

// ── Two-level hierarchy: Quote Type → Categories ──────────────────────────────
type CategoryDef = { key: string; label: string }
type QuoteTypeDef = { key: string; label: string; categories: CategoryDef[] }

const QUOTE_TYPES: QuoteTypeDef[] = [
  {
    key: 'industrialRapidDoor',
    label: 'Industrial Rapid Door',
    categories: [
      { key: 'indicatorLamp',    label: 'Indicator Lamp'    },
      { key: 'safety',           label: 'Safety Sensor'     },
      { key: 'safetyEdgeColour', label: 'Safety Edge Colour'},
      { key: 'pushButton',       label: 'Push Button'       },
      { key: 'radar',            label: 'Radar'             },
      { key: 'remoteControl',    label: 'Remote Control'    },
      { key: 'inductLoop',       label: 'Induction Loop'    },
      { key: 'swipe',            label: 'Other (Swipe)'     },
      { key: 'doorControl',      label: 'Door Control'      },
      { key: 'frame',            label: 'Frame Material'    },
      { key: 'curtain',          label: 'Curtain Material'  },
      { key: 'colour',           label: 'Curtain Colour'    },
      { key: 'motorKw',          label: 'Motor kW'          },
      { key: 'motorSide',        label: 'Motor Side'        },
      { key: 'controlBoxSide',   label: 'Control Box Side'  },
      { key: 'openingSpeed',     label: 'Opening Speed'     },
      { key: 'powerSupply',      label: 'Power Supply'      },
      { key: 'door_type',        label: 'Door Type'         },
    ],
  },
  { key: 'general',                  label: 'General',                       categories: [] },
  { key: 'pvcFlexSystem',            label: 'PVC Flex System',               categories: [] },
  { key: 'maintenanceServiceRepair', label: 'Maintenance Service / Repair',  categories: [] },
  { key: 'parts',                    label: 'Parts',                         categories: [] },
]

type OptionRow = {
  id:          string
  category:    string
  code:        string
  label:       string
  description: string
  hex_colour:  string | null
  sort_order:  number
  is_active:   boolean
}

type EditState = Omit<OptionRow, 'id' | 'category'>

// ── Option table editor ───────────────────────────────────────────────────────
function OptionTableEditor({ category }: { category: string }) {
  const [rows,     setRows]     = useState<OptionRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editDraft,setEditDraft]= useState<EditState | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [adding,   setAdding]   = useState(false)
  const [newDraft, setNewDraft] = useState<EditState>({ code: '', label: '', description: '', hex_colour: null, sort_order: 1, is_active: true })
  const [rowMsg,   setRowMsg]   = useState<{ id: string; ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/admin/quote-options?category=${category}`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setRows(json.data as OptionRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => { void load() }, [load])

  function startEdit(row: OptionRow) {
    setEditId(row.id)
    setEditDraft({ code: row.code, label: row.label, description: row.description, hex_colour: row.hex_colour, sort_order: row.sort_order, is_active: row.is_active })
    setRowMsg(null)
  }

  function cancelEdit() { setEditId(null); setEditDraft(null) }

  async function saveEdit(id: string) {
    if (!editDraft) return
    setSaving(true); setRowMsg(null)
    try {
      const res = await fetch(`/api/admin/quote-options/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...editDraft } : r))
      setEditId(null); setEditDraft(null)
      setRowMsg({ id, ok: true, text: 'Saved' })
      setTimeout(() => setRowMsg(null), 2000)
    } catch (e) {
      setRowMsg({ id, ok: false, text: e instanceof Error ? e.message : 'Save failed' })
    } finally { setSaving(false) }
  }

  async function toggleActive(row: OptionRow) {
    const next = !row.is_active
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: next } : r))
    try {
      const res = await fetch(`/api/admin/quote-options/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: next }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
    } catch {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: !next } : r))
    }
  }

  async function deleteRow(id: string) {
    if (!confirm('Delete this option? This cannot be undone.')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/quote-options/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setRows(prev => prev.filter(r => r.id !== id))
    } catch (e) {
      setRowMsg({ id, ok: false, text: e instanceof Error ? e.message : 'Delete failed' })
    } finally { setDeleting(null) }
  }

  async function addRow() {
    if (!newDraft.code.trim() || !newDraft.label.trim()) {
      setRowMsg({ id: '__new', ok: false, text: 'Code and Label are required' })
      return
    }
    setSaving(true); setRowMsg(null)
    try {
      const res = await fetch('/api/admin/quote-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, ...newDraft }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setRows(prev => [...prev, json.data as OptionRow])
      setNewDraft({ code: '', label: '', description: '', hex_colour: null, sort_order: rows.length * 10 + 10, is_active: true })
      setAdding(false)
    } catch (e) {
      setRowMsg({ id: '__new', ok: false, text: e instanceof Error ? e.message : 'Add failed' })
    } finally { setSaving(false) }
  }

  const INPUT = 'w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
  const TD = 'px-3 py-2.5 text-sm text-slate-700'
  const TH = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-400'

  if (loading) return (
    <div className="flex items-center gap-2 py-10 justify-center text-sm text-slate-400">
      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
      Loading…
    </div>
  )
  if (error) return (
    <div className="flex items-center gap-2 py-6 justify-center text-sm text-red-500">
      <span className="material-symbols-outlined text-[18px]">error</span>{error}
      <button className="ml-2 underline text-indigo-600" onClick={load}>Retry</button>
    </div>
  )

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              <th className={TH} style={{ width: 44 }}>#</th>
              <th className={TH} style={{ width: 100 }}>Code</th>
              <th className={TH} style={{ width: 140 }}>Label</th>
              <th className={TH}>Description (PDF)</th>
              <th className={TH} style={{ width: 76 }}>Active</th>
              <th className={TH} style={{ width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-slate-400">No options yet — add one below</td></tr>
            )}
            {rows.map((row, idx) => {
              const isEditing = editId === row.id
              const msg = rowMsg?.id === row.id ? rowMsg : null
              const isDel = deleting === row.id

              return (
                <tr key={row.id} className={`transition ${!row.is_active ? 'bg-slate-50 opacity-60' : ''}`}>
                  {/* Row index / sort order */}
                  <td className={`${TD} text-slate-400 text-xs`}>
                    {isEditing
                      ? <input type="number" value={editDraft!.sort_order} onChange={e => setEditDraft(d => d && { ...d, sort_order: Number(e.target.value) })} className={`${INPUT} w-10 text-xs px-1`} />
                      : idx + 1
                    }
                  </td>

                  {/* Code */}
                  <td className={TD}>
                    {isEditing
                      ? <input value={editDraft!.code} onChange={e => setEditDraft(d => d && { ...d, code: e.target.value })} className={INPUT} />
                      : <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{row.code}</span>
                    }
                  </td>

                  {/* Label */}
                  <td className={TD}>
                    {isEditing
                      ? <input value={editDraft!.label} onChange={e => setEditDraft(d => d && { ...d, label: e.target.value })} className={INPUT} />
                      : row.label
                    }
                  </td>

                  {/* Description */}
                  <td className={TD}>
                    {isEditing
                      ? <input value={editDraft!.description} onChange={e => setEditDraft(d => d && { ...d, description: e.target.value })} className={INPUT} placeholder="e.g. (Amber Strobe Light)" />
                      : <span className="text-slate-500">{row.description || <span className="text-slate-300 italic">—</span>}</span>
                    }
                  </td>

                  {/* Active toggle */}
                  <td className={TD}>
                    <button type="button" onClick={() => toggleActive(row)}
                      title={row.is_active ? 'Click to deactivate' : 'Click to activate'}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${row.is_active ? 'bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600' : 'bg-slate-100 text-slate-400 hover:bg-green-50 hover:text-green-600'}`}>
                      <span className="material-symbols-outlined text-[12px]">{row.is_active ? 'check_circle' : 'cancel'}</span>
                      {row.is_active ? 'Active' : 'Off'}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className={TD}>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button type="button" disabled={saving} onClick={() => saveEdit(row.id)}
                            className="inline-flex items-center gap-0.5 rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition">
                            <span className="material-symbols-outlined text-[12px]">{saving ? 'progress_activity' : 'check'}</span>
                            Save
                          </button>
                          <button type="button" onClick={cancelEdit}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEdit(row)} title={`Edit row ${idx + 1}`}
                            className="rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition">
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                          </button>
                          <button type="button" disabled={isDel} onClick={() => deleteRow(row.id)} title="Delete"
                            className="rounded-lg border border-slate-200 p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 transition">
                            <span className="material-symbols-outlined text-[15px]">{isDel ? 'progress_activity' : 'delete'}</span>
                          </button>
                        </>
                      )}
                    </div>
                    {msg && <p className={`mt-1 text-[11px] font-medium ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>}
                  </td>
                </tr>
              )
            })}

            {/* Add new row */}
            {adding && (
              <tr className="bg-indigo-50/40">
                <td className={`${TD} text-slate-400 text-xs`}>{rows.length + 1}</td>
                <td className={TD}>
                  <input value={newDraft.code} onChange={e => setNewDraft(d => ({ ...d, code: e.target.value }))} className={INPUT} placeholder="PEC" />
                </td>
                <td className={TD}>
                  <input value={newDraft.label} onChange={e => setNewDraft(d => ({ ...d, label: e.target.value }))} className={INPUT} placeholder="PEC" />
                </td>
                <td className={TD}>
                  <input value={newDraft.description} onChange={e => setNewDraft(d => ({ ...d, description: e.target.value }))} className={INPUT} placeholder="(Dual-Photocell)" />
                </td>
                <td className={TD}>
                  <span className="text-xs text-slate-400">Active on save</span>
                </td>
                <td className={TD}>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={saving} onClick={addRow}
                      className="inline-flex items-center gap-0.5 rounded-lg bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition">
                      <span className="material-symbols-outlined text-[12px]">{saving ? 'progress_activity' : 'add'}</span>
                      Add
                    </button>
                    <button type="button" onClick={() => { setAdding(false); setRowMsg(null) }}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition">
                      Cancel
                    </button>
                  </div>
                  {rowMsg?.id === '__new' && <p className={`mt-1 text-[11px] font-medium ${rowMsg.ok ? 'text-green-600' : 'text-red-500'}`}>{rowMsg.text}</p>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!adding && (
        <button type="button" onClick={() => { setAdding(true); setNewDraft({ code: '', label: '', description: '', hex_colour: null, sort_order: rows.length + 1, is_active: true }) }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition">
          <span className="material-symbols-outlined text-[15px]">add</span>
          Add option
        </button>
      )}
    </div>
  )
}

// ── Shared select style ───────────────────────────────────────────────────────
const SELECT_CLS = 'appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'

// ── Main exported component ───────────────────────────────────────────────────
export function QuoteSettingsClient() {
  const [activeQuoteType, setActiveQuoteType] = useState('industrialRapidDoor')
  const [activeCategory,  setActiveCategory]  = useState('indicatorLamp')
  const [imageStyle, setImageStyle] = useState<DoorImageStyle>('withOutText')

  useEffect(() => { setImageStyle(loadDoorImageStyle()) }, [])

  function handleImageStyleChange(style: DoorImageStyle) {
    setImageStyle(style)
    try { localStorage.setItem(IMAGE_STYLE_KEY, style) } catch {}
  }

  const quoteTypeDef  = QUOTE_TYPES.find(q => q.key === activeQuoteType)!
  const categoryDef   = quoteTypeDef.categories.find(c => c.key === activeCategory)
  const activeCatLabel = categoryDef?.label ?? activeCategory

  function handleQuoteTypeChange(key: string) {
    setActiveQuoteType(key)
    const firstCat = QUOTE_TYPES.find(q => q.key === key)?.categories[0]?.key ?? ''
    setActiveCategory(firstCat)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Quote Settings</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Manage dropdown options for each quote type. All changes are saved directly to the database and take effect immediately.
        </p>
      </div>

      {/* Door image style toggle */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Door Image Style</p>
            <p className="mt-0.5 text-xs text-slate-500">Choose whether door preview images show product descriptions or are clean without text.</p>
          </div>
          <div className="flex rounded-xl border border-slate-200 overflow-hidden">
            {(['withOutText', 'withText'] as DoorImageStyle[]).map(style => (
              <button key={style} type="button"
                onClick={() => handleImageStyleChange(style)}
                className={`px-4 py-2 text-xs font-semibold transition ${imageStyle === style ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {style === 'withOutText' ? 'Without Description' : 'With Description'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dropdown option map editor */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Dropdown Options</h3>
          <p className="mt-0.5 text-xs text-slate-500">Select a quote type and category to view and edit its options. The Description column is what appears in generated PDFs.</p>
        </div>

        {/* Two-level selectors */}
        <div className="flex items-end gap-4 flex-wrap">
          {/* Level 1: Quote Type */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400">Quote Type</label>
            <div className="relative">
              <select value={activeQuoteType} onChange={e => handleQuoteTypeChange(e.target.value)} className={SELECT_CLS}>
                {QUOTE_TYPES.map(q => (
                  <option key={q.key} value={q.key}>{q.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">expand_more</span>
            </div>
          </div>

          {/* Level 2: Category (only when quote type has categories) */}
          {quoteTypeDef.categories.length > 0 && (
            <>
              <span className="material-symbols-outlined text-slate-300 text-lg mb-2">chevron_right</span>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400">Category</label>
                <div className="relative">
                  <select value={activeCategory} onChange={e => setActiveCategory(e.target.value)} className={SELECT_CLS}>
                    {quoteTypeDef.categories.map(c => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">expand_more</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Active selection breadcrumb */}
        {quoteTypeDef.categories.length > 0 ? (
          <>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <span className="material-symbols-outlined text-[16px] text-indigo-500">tune</span>
              <span className="text-sm text-slate-500">{quoteTypeDef.label}</span>
              <span className="material-symbols-outlined text-[14px] text-slate-300">chevron_right</span>
              <span className="text-sm font-semibold text-slate-700">{activeCatLabel}</span>
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-500">{activeCategory}</span>
            </div>
            <OptionTableEditor key={activeCategory} category={activeCategory} />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
            <span className="material-symbols-outlined text-[36px]">inbox</span>
            <p className="text-sm">No dropdown categories configured for <span className="font-semibold">{quoteTypeDef.label}</span> yet.</p>
          </div>
        )}
      </div>

      {/* T&C Document Upload */}
      <TcUploadSection />
    </div>
  )
}

// ── Terms & Conditions Upload (unchanged) ─────────────────────────────────────

type TcRow = {
  quote_type:    string
  end_user_type: string
  file_name:     string
  uploaded_at:   string
  storage_path:  string
}

const TC_QUOTE_TYPES: { key: string; label: string; endUserTypes: { key: string; label: string }[] }[] = [
  {
    key: 'INDUSTRIAL_RAPID_DOOR',
    label: 'Industrial Rapid Door',
    endUserTypes: [
      { key: 'CUSTOMER',    label: 'Customer' },
      { key: 'DISTRIBUTOR', label: 'Distributor' },
      { key: 'TENDER',      label: 'Tender' },
    ],
  },
  { key: 'PVC_FLEX_SYSTEM',            label: 'PVC Flex System',        endUserTypes: [{ key: 'ALL', label: 'General T&C' }] },
  { key: 'MAINTENANCE_SERVICE_REPAIR', label: 'Maintenance / Repair',   endUserTypes: [{ key: 'ALL', label: 'General T&C' }] },
  { key: 'PARTS',                      label: 'Parts',                  endUserTypes: [{ key: 'ALL', label: 'General T&C' }] },
  { key: 'GENERAL',                    label: 'General',                endUserTypes: [{ key: 'ALL', label: 'General T&C' }] },
]

function TcUploadSection() {
  const [activeTcType, setActiveTcType] = useState('INDUSTRIAL_RAPID_DOOR')
  const [tcDocs, setTcDocs]             = useState<TcRow[]>([])
  const [uploading, setUploading]       = useState<string | null>(null)
  const [uploadMsg, setUploadMsg]       = useState<{ key: string; ok: boolean; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUpload = useRef<{ quoteType: string; endUserType: string } | null>(null)

  useEffect(() => { fetchTcDocs() }, [])

  async function fetchTcDocs() {
    try {
      const res = await fetch('/api/admin/quote-tc/list')
      const json = await res.json()
      if (json.ok) setTcDocs(json.data)
    } catch { /* silent */ }
  }

  function triggerUpload(quoteType: string, endUserType: string) {
    pendingUpload.current = { quoteType, endUserType }
    fileInputRef.current?.click()
  }

  async function downloadTcDoc(storagePath: string, fileName: string) {
    try {
      const res = await fetch(`/api/admin/quote-tc/download?path=${encodeURIComponent(storagePath)}`)
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
    } catch { /* silent */ }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const target = pendingUpload.current
    if (!file || !target) return
    e.target.value = ''
    const key = `${target.quoteType}|${target.endUserType}`
    setUploading(key); setUploadMsg(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('quoteType', target.quoteType)
    fd.append('endUserType', target.endUserType)
    try {
      const res  = await fetch('/api/admin/quote-tc/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok) { setUploadMsg({ key, ok: true, text: 'Uploaded successfully' }); await fetchTcDocs() }
      else setUploadMsg({ key, ok: false, text: json.error ?? 'Upload failed' })
    } catch { setUploadMsg({ key, ok: false, text: 'Network error' }) }
    finally { setUploading(null); pendingUpload.current = null }
  }

  const activeConfig = TC_QUOTE_TYPES.find(t => t.key === activeTcType)!

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800">Terms &amp; Conditions Documents</h2>
        <p className="mt-0.5 text-sm text-slate-500">Upload updated T&amp;C PDFs per quote type and end-user category. Uploaded files override the bundled defaults when generating quotes.</p>
      </div>
      <div className="flex gap-1 flex-wrap">
        {TC_QUOTE_TYPES.map(t => (
          <button key={t.key} type="button" onClick={() => setActiveTcType(t.key)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${activeTcType === t.key ? 'bg-indigo-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
        {activeConfig.endUserTypes.map(eu => {
          const key     = `${activeTcType}|${eu.key}`
          const current = tcDocs.find(d => d.quote_type === activeTcType && d.end_user_type === eu.key)
          const isUp    = uploading === key
          const msg     = uploadMsg?.key === key ? uploadMsg : null
          return (
            <div key={eu.key} className="flex items-center gap-4 px-5 py-4">
              <div className="w-36 shrink-0">
                <p className="text-sm font-semibold text-slate-700">{eu.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{eu.key === 'ALL' ? 'All end users' : `End user: ${eu.key}`}</p>
              </div>
              <div className="flex-1 min-w-0">
                {current ? (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-green-500">check_circle</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{current.file_name}</p>
                      <p className="text-[11px] text-slate-400">Uploaded {new Date(current.uploaded_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="material-symbols-outlined text-[16px]">upload_file</span>
                    <p className="text-xs">Using bundled default T&amp;C</p>
                  </div>
                )}
                {msg && <p className={`text-[11px] mt-1 font-medium ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {current && (
                  <button type="button" onClick={() => downloadTcDoc(current.storage_path, current.file_name)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition">
                    <span className="material-symbols-outlined text-[14px]">download</span>Download
                  </button>
                )}
                <button type="button" disabled={isUp} onClick={() => triggerUpload(activeTcType, eu.key)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition disabled:opacity-50">
                  {isUp ? <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>Uploading…</>
                        : <><span className="material-symbols-outlined text-[14px]">upload</span>{current ? 'Replace' : 'Upload PDF'}</>}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
      <p className="text-[11px] text-slate-400">PDF files only · Max 20 MB · Uploaded files are stored in Supabase Storage and applied immediately to all new quotes.</p>
    </div>
  )
}
