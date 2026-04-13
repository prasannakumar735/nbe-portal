'use client'

import { useState } from 'react'

const SERVICE_TEMPLATES: Record<string, string[]> = {
  '6 Month Service': [
    'Conducted scheduled service on rapid roller doors',
    'Inspected mechanical components',
    'Inspected electrical components',
    'Lubrication of moving parts',
    'Tension adjustments',
    'Safety sensor inspection',
    'Operational test',
  ],
  'Annual Service': [
    'Completed annual full service and condition report',
    'Checked limit settings and alignment',
    'Inspected motors, chain, and drive components',
    'Checked control panel and safety circuit',
    'Lubrication of moving parts',
    'Safety sensor inspection',
    'Operational test',
  ],
  'Door Breakdown Repair': [
    'Attended site for rapid door breakdown repair',
    'Diagnosed fault and isolated root cause',
    'Carried out repairs and adjustments',
    'Safety checks completed',
    'Operational test',
  ],
  'Photo Cell Replacement': [
    'Removed faulty photo cells',
    'Installed new photo cells',
    'Aligned and calibrated sensor operation',
    'Operational test',
  ],
  'Motor Replacement': [
    'Removed faulty rapid door motor',
    'Installed replacement motor',
    'Checked limits and drive alignment',
    'Operational test',
  ],
  'Side Leg Replacement': [
    'Removed damaged side leg assembly',
    'Installed replacement side leg',
    'Aligned curtain travel and guides',
    'Operational test',
  ],
}

type ServiceTemplateSelectorProps = {
  onApplyTemplate: (descriptions: string[]) => void
}

export function ServiceTemplateSelector({ onApplyTemplate }: ServiceTemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('')

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Quote Type</h2>
      <div className="mt-4 max-w-sm">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Quote type
          <select
            value={selectedTemplate}
            onChange={(event) => {
              const templateName = event.target.value
              if (!templateName) {
                return
              }
              onApplyTemplate(SERVICE_TEMPLATES[templateName])
              setSelectedTemplate('')
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select quote type…</option>
            {Object.keys(SERVICE_TEMPLATES).map(template => (
              <option key={template} value={template}>
                {template}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}
