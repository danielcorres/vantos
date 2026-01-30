import * as React from 'react'
import type { PipelineStage, Lead } from '../pipeline.api'
import { KanbanColumn } from './KanbanColumn'
import { LeadCardMobile } from '../../../components/pipeline/LeadCardMobile'
import { MobileStageSwitcher } from '../../../components/pipeline/MobileStageSwitcher'
import type { PipelineStageLite } from '../../../components/pipeline/LeadProgressDots'

interface KanbanBoardProps {
  stages: PipelineStage[]
  leads: Lead[]
  onDragStart: (e: React.DragEvent, lead: Lead) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, stageId: string) => void
  onMoveStage: (leadId: string, toStageId: string) => Promise<void>
}

export function KanbanBoard({
  stages,
  leads,
  onDragStart,
  onDragOver,
  onDrop,
  onMoveStage,
}: KanbanBoardProps) {
  const stageItems = React.useMemo(
    () => stages.map((s) => ({ id: s.id, name: s.name, position: s.position })),
    [stages]
  )

  const stagesLite: PipelineStageLite[] = React.useMemo(
    () => stageItems.map((s) => ({ id: s.id, name: s.name, position: s.position })),
    [stageItems]
  )

  const STORAGE_KEY = 'vant.pipeline.kanban.mobileStageId'
  const [mobileStageId, setMobileStageId] = React.useState<string>(() => {
    if (typeof window === 'undefined') return stages[0]?.id ?? ''
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved || stages[0]?.id || ''
  })

  React.useEffect(() => {
    if (!mobileStageId) return
    try {
      window.localStorage.setItem(STORAGE_KEY, mobileStageId)
    } catch {
      // ignore
    }
  }, [mobileStageId])

  React.useEffect(() => {
    // Si las etapas cambian y el id guardado ya no existe, caer a la primera.
    if (!stages.length) return
    if (!mobileStageId || !stages.some((s) => s.id === mobileStageId)) {
      setMobileStageId(stages[0].id)
    }
  }, [stages, mobileStageId])

  const mobileLeads = React.useMemo(
    () => leads.filter((l) => l.stage_id === mobileStageId),
    [leads, mobileStageId]
  )

  const mobileStageName = React.useMemo(
    () => stages.find((s) => s.id === mobileStageId)?.name,
    [stages, mobileStageId]
  )

  const leadsByStage = new Map<string, Lead[]>()
  leads.forEach((lead) => {
    if (!leadsByStage.has(lead.stage_id)) {
      leadsByStage.set(lead.stage_id, [])
    }
    leadsByStage.get(lead.stage_id)!.push(lead)
  })

  return (
    <>
      {/* MOBILE: una columna a la vez (sin drag & drop) */}
      <div className="md:hidden">
        <MobileStageSwitcher
          stages={stageItems}
          value={mobileStageId}
          onChange={setMobileStageId}
          count={mobileLeads.length}
          label="Pipeline"
        />

        <div className="px-3 py-3 space-y-2">
          {mobileLeads.length === 0 ? (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
              No hay leads en esta etapa.
            </div>
          ) : (
            mobileLeads.map((lead) => (
              <LeadCardMobile
                key={lead.id}
                lead={lead}
                stages={stagesLite}
                stageName={mobileStageName}
                onMoveStage={onMoveStage}
              />
            ))
          )}
        </div>
      </div>

      {/* DESKTOP: tablero completo con drag & drop (se mantiene) */}
      <div className="hidden md:block -mx-4 px-4 pb-4 overflow-x-auto">
        <div className="flex gap-3 items-start min-w-max">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={leadsByStage.get(stage.id) || []}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      </div>
    </>
  )
}
