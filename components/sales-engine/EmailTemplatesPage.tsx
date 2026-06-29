'use client'

import Link from 'next/link'
import { useState } from 'react'
import { EmailTemplateEditor } from '@/components/sales-engine/EmailTemplateEditor'
import { EmailTemplateForm } from '@/components/sales-engine/EmailTemplateForm'
import { EmailTemplatesTable } from '@/components/sales-engine/EmailTemplatesTable'
import type { SalesEmailTemplate } from '@/lib/sales/types/emailTemplate.types'
import {
  templateToFormValues,
  useEmailTemplates,
  type EmailTemplateFormValues,
} from '@/hooks/useEmailTemplates'

export function EmailTemplatesPage() {
  const tpl = useEmailTemplates()
  const [showCreate, setShowCreate] = useState(false)
  const [createValues, setCreateValues] = useState<EmailTemplateFormValues>(() => tpl.emptyForm())
  const [createError, setCreateError] = useState<string | null>(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'view' | 'edit'>('view')
  const [editingTemplate, setEditingTemplate] = useState<SalesEmailTemplate | null>(null)
  const [editValues, setEditValues] = useState<EmailTemplateFormValues>(() => tpl.emptyForm())
  const [editError, setEditError] = useState<string | null>(null)

  function openView(template: SalesEmailTemplate) {
    setEditingTemplate(template)
    setEditValues(templateToFormValues(template))
    setEditorMode('view')
    setEditError(null)
    setEditorOpen(true)
  }

  function openEdit(template: SalesEmailTemplate) {
    setEditingTemplate(template)
    setEditValues(templateToFormValues(template))
    setEditorMode('edit')
    setEditError(null)
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditingTemplate(null)
  }

  async function handleCreate() {
    setCreateError(null)
    try {
      await tpl.createTemplate(createValues)
      setCreateValues(tpl.emptyForm())
      setShowCreate(false)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create template')
    }
  }

  async function handleUpdate() {
    if (!editingTemplate) return
    setEditError(null)
    try {
      await tpl.updateTemplate(editingTemplate.id, editValues)
      closeEditor()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update template')
    }
  }

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6">
      <header>
        <Link
          href="/dashboard/sales-engine"
          className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          ← Back to Sales Engine
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Email Templates</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage AI prompt templates for campaign generation
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="filter-campaign">
              Filter by campaign type
            </label>
            <select
              id="filter-campaign"
              value={tpl.campaignTypeFilter}
              onChange={(e) =>
                tpl.setCampaignTypeFilter(
                  e.target.value as typeof tpl.campaignTypeFilter,
                )
              }
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              {tpl.campaignTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowCreate((v) => !v)
              setCreateError(null)
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {showCreate ? 'Hide Create Form' : 'Create New Template'}
          </button>
        </div>

        {showCreate ? (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <h2 className="text-base font-semibold text-slate-900">Create Template</h2>
            <div className="mt-4">
              <EmailTemplateForm
                values={createValues}
                onChange={(patch) => setCreateValues((prev) => ({ ...prev, ...patch }))}
                campaignTypes={tpl.campaignTypes}
                disabled={tpl.saving || tpl.catalogLoading}
                submitLabel={tpl.saving ? 'Creating…' : 'Create Template'}
                onSubmit={() => void handleCreate()}
                onCancel={() => setShowCreate(false)}
                error={createError}
              />
            </div>
          </div>
        ) : null}
      </section>

      {tpl.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {tpl.error}
        </div>
      ) : null}

      <EmailTemplatesTable
        rows={tpl.templates}
        loading={tpl.loading}
        togglingId={tpl.togglingId}
        onView={openView}
        onEdit={openEdit}
        onToggleActive={(template, isActive) => void tpl.setTemplateActive(template.id, isActive)}
      />

      <EmailTemplateEditor
        open={editorOpen}
        mode={editorMode}
        template={editingTemplate}
        values={editValues}
        campaignTypes={tpl.campaignTypes}
        onChange={(patch) => setEditValues((prev) => ({ ...prev, ...patch }))}
        saving={tpl.saving}
        formError={editError}
        onClose={closeEditor}
        onSwitchToEdit={() => setEditorMode('edit')}
        onSave={() => void handleUpdate()}
      />
    </div>
  )
}
