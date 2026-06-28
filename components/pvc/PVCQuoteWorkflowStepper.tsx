'use client'

import {
  invoiceStatusLabel,
  isPvcWorkflowClosedStatus,
  resolveActiveWorkflowStepIndex,
  workflowDraftCloseOptions,
  workflowDraftOnHoldOption,
  workflowStatusLabel,
  workflowStepState,
  workflowSteps,
  type PvcWorkflowStepDef,
} from '@/lib/pvc/pvcQuoteWorkflow'

type StepVisualState = 'complete' | 'current' | 'upcoming' | 'terminal'

function resolveMainStepVisual(
  stepKey: string,
  status: string,
  closed: boolean,
  activeIndex: number,
  stepIndex: number,
): StepVisualState {
  if (closed) return 'upcoming'
  if (status === 'on_hold' && stepKey === 'draft_review') return 'complete'
  return workflowStepState(stepIndex, activeIndex)
}

function resolveBranchVisual(nodeKey: string, status: string): StepVisualState {
  if (status === nodeKey) {
    if (nodeKey === 'rejected' || nodeKey === 'void') return 'terminal'
    return 'current'
  }
  return 'upcoming'
}

function stepCardClass(visual: StepVisualState, terminalKind?: 'rejected' | 'void' | 'on_hold') {
  const shadow = visual === 'current' || visual === 'terminal' ? 'shadow-sm' : ''
  if (visual === 'terminal' && terminalKind === 'rejected') {
    return `border-red-300 bg-red-50 text-red-950 ring-2 ring-red-200/80 ${shadow}`
  }
  if (visual === 'terminal' && terminalKind === 'void') {
    return `border-slate-400 bg-slate-200 text-slate-900 ring-2 ring-slate-300/80 ${shadow}`
  }
  if (terminalKind === 'on_hold' && visual === 'current') {
    return `border-amber-300 bg-amber-50 text-amber-950 ring-2 ring-amber-200/80 ${shadow}`
  }
  if (visual === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  if (visual === 'current') return `border-indigo-300 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-200/80 ${shadow}`
  return 'border-slate-200 bg-white text-slate-500'
}

function StatusIndicator({ visual, terminalKind }: { visual: StepVisualState; terminalKind?: 'rejected' | 'void' }) {
  if (visual === 'complete') {
    return (
      <span className="mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
          <path
            fill="currentColor"
            d="M10.2 3.2a.75.75 0 0 1 0 1.1l-4.5 4.5a.75.75 0 0 1-1.1 0l-2-2a.75.75 0 1 1 1.1-1.06L5.2 7.1l3.95-3.95a.75.75 0 0 1 1.05 0Z"
          />
        </svg>
      </span>
    )
  }
  if (visual === 'current' || visual === 'terminal') {
    const dotClass =
      visual === 'terminal' && terminalKind === 'void'
        ? 'bg-slate-600'
        : visual === 'terminal'
          ? 'bg-red-500'
          : 'bg-indigo-500'
    return <span className={`mr-2 inline-block h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
  }
  return (
    <span className="mr-2 inline-block h-2 w-2 shrink-0 rounded-full border border-slate-300 bg-white" aria-hidden />
  )
}

function WorkflowStepCard({
  label,
  description,
  visual,
  terminalKind,
  className = '',
  showIndicator = true,
  muted = false,
}: {
  label: string
  description: string
  visual: StepVisualState
  terminalKind?: 'rejected' | 'void' | 'on_hold'
  className?: string
  showIndicator?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={`flex min-h-[3.5rem] flex-col justify-center rounded-lg border px-3 py-2.5 ${stepCardClass(visual, terminalKind)} ${muted ? 'opacity-50' : ''} ${className}`}
    >
      <div className="flex items-center">
        {showIndicator ? <StatusIndicator visual={visual} terminalKind={terminalKind === 'void' ? 'void' : terminalKind === 'rejected' ? 'rejected' : undefined} /> : null}
        <span className="text-sm font-semibold leading-tight">{label}</span>
      </div>
      <span className={`mt-0.5 text-xs leading-snug opacity-90 ${showIndicator ? 'pl-6' : ''}`}>
        {description}
      </span>
    </div>
  )
}

function ConnectorHorizontal({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-5 w-8 shrink-0 text-slate-300 ${className}`}
      viewBox="0 0 32 20"
      fill="none"
      aria-hidden
    >
      <path d="M0 10h24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M20 5l6 5-6 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ConnectorVertical({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-6 w-5 shrink-0 text-slate-300 ${className}`} viewBox="0 0 20 24" fill="none" aria-hidden>
      <path d="M10 0v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M5 12l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ConnectorBranch({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-5 w-6 shrink-0 text-slate-400 ${className}`}
      viewBox="0 0 24 20"
      fill="none"
      aria-hidden
    >
      <path d="M12 0v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 8h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M16 8l4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function currentStatusBadgeClass(status: string): string {
  if (status === 'rejected') return 'bg-red-100 text-red-900'
  if (status === 'void') return 'bg-slate-200 text-slate-800'
  if (status === 'on_hold') return 'bg-amber-100 text-amber-950'
  return 'bg-indigo-100 text-indigo-900'
}

function BranchList({
  status,
  closed,
  onHoldOption,
  closeOptions,
  compact = false,
}: {
  status: string
  closed: boolean
  onHoldOption: PvcWorkflowStepDef
  closeOptions: PvcWorkflowStepDef[]
  compact?: boolean
}) {
  const onHoldVisual = resolveBranchVisual('on_hold', status)
  const onHoldActive = onHoldVisual === 'current'

  return (
    <div className={`flex flex-col gap-2 ${compact ? '' : 'mt-1'}`}>
      <div className="flex items-stretch gap-1">
        {!compact ? <ConnectorBranch /> : null}
        <WorkflowStepCard
          label={onHoldOption.shortLabel}
          description={onHoldOption.description}
          visual={onHoldVisual}
          terminalKind="on_hold"
          className="min-w-0 flex-1"
          showIndicator={!compact}
          muted={closed && !onHoldActive}
        />
      </div>
      {closeOptions.map((option, idx) => {
        const kind = option.key === 'rejected' ? 'rejected' : 'void'
        const visual = resolveBranchVisual(option.key, status)
        const isActiveTerminal = closed && visual === 'terminal'
        return (
          <div key={option.key} className="flex items-stretch gap-1">
            {idx === 0 ? (
              !compact ? (
                <ConnectorBranch />
              ) : null
            ) : (
              <span className="flex w-6 shrink-0 items-center justify-center text-[10px] font-medium uppercase text-slate-400">
                or
              </span>
            )}
            <WorkflowStepCard
              label={option.shortLabel}
              description={option.description}
              visual={visual}
              terminalKind={kind}
              className="min-w-0 flex-1"
              showIndicator={!compact}
              muted={closed && !isActiveTerminal}
            />
          </div>
        )
      })}
    </div>
  )
}

export function PVCQuoteWorkflowStepper({
  workflowStatus = 'draft_review',
  invoiceStatus = null,
  showCaption = true,
}: {
  workflowStatus?: string | null
  invoiceStatus?: string | null
  showCaption?: boolean
}) {
  const steps = workflowSteps()
  const closeOptions = workflowDraftCloseOptions()
  const onHoldOption = workflowDraftOnHoldOption()
  const status = workflowStatus ?? 'draft_review'
  const closed = isPvcWorkflowClosedStatus(status)
  const activeIndex = resolveActiveWorkflowStepIndex(workflowStatus, invoiceStatus)

  const youAreHereLabel =
    status === 'shipped_or_installed' && invoiceStatus
      ? invoiceStatusLabel(invoiceStatus)
      : workflowStatusLabel(status)

  const renderPipelineStep = (step: PvcWorkflowStepDef, index: number) => {
    const visual = resolveMainStepVisual(step.key, status, closed, activeIndex, index)
    const isInvoicing = step.key === 'invoicing'
    const invoicingDetail = isInvoicing && invoiceStatus ? invoiceStatusLabel(invoiceStatus) : null

    return (
      <WorkflowStepCard
        label={step.shortLabel}
        description={invoicingDetail ?? step.description}
        visual={visual}
        className="w-full min-w-0"
        muted={closed}
      />
    )
  }

  return (
    <section
      className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5"
      aria-label="PVC quote workflow"
    >
      {showCaption ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quote workflow</h2>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${currentStatusBadgeClass(status)}`}
          >
            {youAreHereLabel}
          </span>
        </div>
      ) : null}

      {closed ? (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            status === 'rejected'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-slate-300 bg-slate-100 text-slate-800'
          }`}
        >
          This quote is closed and will not continue through approval or fulfilment.
        </div>
      ) : null}

      <div className="hidden lg:block">
        <div
          className="grid items-center gap-x-1 gap-y-3"
          style={{
            gridTemplateColumns:
              'minmax(8.5rem, 1fr) auto minmax(8.5rem, 1fr) auto minmax(8.5rem, 1fr) auto minmax(8.5rem, 1fr)',
          }}
        >
          <div className="col-start-1 row-start-1">{renderPipelineStep(steps[0], 0)}</div>
          <div className="col-start-2 row-start-1 flex justify-center">
            <ConnectorHorizontal />
          </div>
          <div className="col-start-3 row-start-1">{renderPipelineStep(steps[1], 1)}</div>
          <div className="col-start-4 row-start-1 flex justify-center">
            <ConnectorHorizontal />
          </div>
          <div className="col-start-5 row-start-1">{renderPipelineStep(steps[2], 2)}</div>
          <div className="col-start-6 row-start-1 flex justify-center">
            <ConnectorHorizontal />
          </div>
          <div className="col-start-7 row-start-1">{renderPipelineStep(steps[3], 3)}</div>

          <div className="col-start-1 row-start-2">
            <div className="mx-auto mb-1 h-3 w-px bg-slate-300" aria-hidden />
            <BranchList
              status={status}
              closed={closed}
              onHoldOption={onHoldOption}
              closeOptions={closeOptions}
            />
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <ol className="flex list-none flex-col gap-2">
          {steps.map((step, index) => (
            <li key={step.key} className="flex flex-col items-stretch">
              {renderPipelineStep(step, index)}
              {index < steps.length - 1 ? (
                <div className="flex justify-center py-0.5">
                  <ConnectorVertical />
                </div>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">From draft</p>
          <BranchList
            status={status}
            closed={closed}
            onHoldOption={onHoldOption}
            closeOptions={closeOptions}
            compact
          />
        </div>
      </div>
    </section>
  )
}
