'use client'

import type {
  PVCHangerWidth,
  PVCHeadrailType,
  PVCInstallationType,
  PVCOverlapMm,
  PVCStripType,
  PVCStripWidth,
} from '@/lib/types/pvc.types'

export interface PVCFormValues {
  customer: string
  attn: string
  address: string
  refNo: string
  width: number
  height: number
  stripType: PVCStripType
  stripWidth: PVCStripWidth
  hangerWidth: PVCHangerWidth
  stripsPerHanger: 1 | 2
  thickness: number
  overlap: PVCOverlapMm
  headrailType: PVCHeadrailType
  installType: PVCInstallationType
  manualInstallationPrice: number
  manualFreightPrice: number
  freightRequired: boolean
  /** Identical doors at the same width × height (Excel qty column). */
  doorQuantity: number
}

interface PVCFormProps {
  values: PVCFormValues
  isLoading: boolean
  onChange: <K extends keyof PVCFormValues>(field: K, value: PVCFormValues[K]) => void
  onSubmit: () => void
}

const STRIP_TYPES: Array<{ value: PVCStripType; label: string }> = [
  { value: 'standard', label: 'Standard' },
  { value: 'ribbed', label: 'Ribbed' },
  { value: 'colour', label: 'Colour' },
  { value: 'polar', label: 'Polar' },
  { value: 'ribbed_polar', label: 'Ribbed Polar' },
]

const STRIP_WIDTHS: PVCStripWidth[] = [100, 150, 200, 300]
const HANGER_WIDTHS: PVCHangerWidth[] = [100, 150, 200, 300, 400, 1200, 1370]
const OVERLAP_OPTIONS: number[] = [0, 10, 15, 20, 25, 33, 50, 66, 100]
const HEADRAIL_TYPES: Array<{ value: PVCHeadrailType; label: string }> = [
  { value: 'stainless', label: 'Stainless' },
  { value: 'galvanized', label: 'Galvanized' },
  { value: 'aluminium', label: 'Aluminium' },
  { value: 'plastic', label: 'Plastic' },
]
const INSTALL_TYPES: Array<{ value: PVCInstallationType; label: string }> = [
  { value: 'supply_only', label: 'Supply Only' },
  { value: 'supply_install', label: 'Supply + Install' },
]

function inputBaseClassName() {
  return 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none'
}

export function PVCForm({ values, isLoading, onChange, onSubmit }: PVCFormProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">PVC Strip Curtain Calculator</h2>
      <p className="mt-1 text-sm text-slate-500">Enter opening and product settings to calculate material and quote pricing.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 border-b border-slate-200 pb-10 mb-2 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Customer</span>
          <input
            type="text"
            className={inputBaseClassName()}
            value={values.customer}
            onChange={(event) => onChange('customer', event.target.value)}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Attn</span>
          <input
            type="text"
            className={inputBaseClassName()}
            value={values.attn}
            onChange={(event) => onChange('attn', event.target.value)}
          />
        </label>

        <label className="space-y-1 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Address</span>
          <textarea
            rows={2}
            className={`${inputBaseClassName()} resize-y min-h-[2.75rem]`}
            value={values.address}
            onChange={(event) => onChange('address', event.target.value)}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Ref No</span>
          <input
            type="text"
            className={inputBaseClassName()}
            value={values.refNo}
            onChange={(event) => onChange('refNo', event.target.value)}
          />
        </label>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Width (mm)</span>
          <input
            type="number"
            min={1}
            className={inputBaseClassName()}
            value={values.width}
            onChange={(event) => onChange('width', Number(event.target.value) || 0)}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Height (mm)</span>
          <input
            type="number"
            min={1}
            className={inputBaseClassName()}
            value={values.height}
            onChange={(event) => onChange('height', Number(event.target.value) || 0)}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">No. of identical doors</span>
          <input
            type="number"
            min={1}
            max={99}
            step={1}
            className={inputBaseClassName()}
            value={values.doorQuantity}
            onChange={(event) => {
              const raw = Number.parseInt(event.target.value, 10)
              const next = Number.isFinite(raw) ? Math.min(99, Math.max(1, raw)) : 1
              onChange('doorQuantity', next)
            }}
          />
          <span className="text-xs text-slate-500">
            Same size and spec as above (e.g. 2 matching openings). Quote uses unit cost × quantity.
          </span>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Strip Type</span>
          <select
            className={inputBaseClassName()}
            value={values.stripType}
            onChange={(event) => onChange('stripType', event.target.value as PVCStripType)}
          >
            {STRIP_TYPES.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Strip Width (mm)</span>
          <select
            className={inputBaseClassName()}
            value={values.stripWidth}
            onChange={(event) => onChange('stripWidth', Number(event.target.value) as PVCStripWidth)}
          >
            {STRIP_WIDTHS.map(width => (
              <option key={width} value={width}>
                {width}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Thickness (mm)</span>
          <input
            type="number"
            min={1}
            step={0.1}
            className={inputBaseClassName()}
            value={values.thickness}
            onChange={(event) => onChange('thickness', Number(event.target.value) || 0)}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Overlap (mm)</span>
          <select
            className={inputBaseClassName()}
            value={values.overlap}
            onChange={(event) => onChange('overlap', Number(event.target.value) as PVCOverlapMm)}
          >
            {OVERLAP_OPTIONS.map(overlap => (
              <option key={overlap} value={overlap}>
                {overlap}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Headrail / Hanger Width (mm)</span>
          <select
            className={inputBaseClassName()}
            value={values.hangerWidth}
            onChange={(event) => onChange('hangerWidth', Number(event.target.value) as PVCHangerWidth)}
          >
            {HANGER_WIDTHS.map(width => (
              <option key={width} value={width}>
                {width}
              </option>
            ))}
          </select>
        </label>

        {values.stripWidth === 100 && (
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Strips per Hanger</span>
            <select
              className={inputBaseClassName()}
              value={values.stripsPerHanger}
              onChange={(event) => onChange('stripsPerHanger', Number(event.target.value) as 1 | 2)}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
        )}

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Headrail Type</span>
          <select
            className={inputBaseClassName()}
            value={values.headrailType}
            onChange={(event) => onChange('headrailType', event.target.value as PVCHeadrailType)}
          >
            {HEADRAIL_TYPES.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Install Type</span>
          <select
            className={inputBaseClassName()}
            value={values.installType}
            onChange={(event) => onChange('installType', event.target.value as PVCInstallationType)}
          >
            {INSTALL_TYPES.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {values.installType === 'supply_only' && (
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Freight</span>
            <input
              type="number"
              min={0}
              step={0.01}
              className={inputBaseClassName()}
              value={values.manualFreightPrice || ''}
              placeholder="0.00"
              onChange={(event) => onChange('manualFreightPrice', Number(event.target.value) || 0)}
            />
            <span className="text-xs text-slate-500">Added to the quote total without the material margin.</span>
          </label>
        )}

        {values.installType === 'supply_install' && (
          <>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Installation price (manual)</span>
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputBaseClassName()}
                value={values.manualInstallationPrice || ''}
                placeholder="0.00"
                onChange={(event) => onChange('manualInstallationPrice', Number(event.target.value) || 0)}
              />
              <span className="text-xs text-slate-500">Added to the quote total without the material margin.</span>
            </label>

            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={values.freightRequired}
                onChange={(event) => onChange('freightRequired', event.target.checked)}
              />
              <span className="text-sm font-medium text-slate-700">Freight required</span>
            </label>

            {values.freightRequired && (
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Freight</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className={inputBaseClassName()}
                  value={values.manualFreightPrice || ''}
                  placeholder="0.00"
                  onChange={(event) => onChange('manualFreightPrice', Number(event.target.value) || 0)}
                />
                <span className="text-xs text-slate-500">Added to the quote total without the material margin.</span>
              </label>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isLoading}
        className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Calculating...' : 'Calculate'}
      </button>
    </section>
  )
}