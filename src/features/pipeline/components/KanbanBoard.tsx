import * as React from 'react'
import type { PipelineStage, Lead } from '../pipeline.api'
import { EmptyState } from '../../../components/pipeline/EmptyState'
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
  onCreateLead?: (stageId: string) => void
  onToast?: (message: string) => void
}

export function KanbanBoard({
  stages,
  leads,
  onDragStart,
  onDragOver,
  onDrop,
  onMoveStage,
  onCreateLead,
  onToast,
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

  const leadsByStage = React.useMemo(() => {
    const map = new Map<string, Lead[]>()
    for (const lead of leads) {
      const list = map.get(lead.stage_id)
      if (list) list.push(lead)
      else map.set(lead.stage_id, [lead])
    }
    return map
  }, [leads])

  const emptyLeads: Lead[] = React.useMemo(() => [], [])

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

        {/* Animación sutil al cambiar de etapa (sin librerías). */}
        <style>{`
          @keyframes vantFadeSlideIn {
            from { opacity: 0; transform: translateX(6px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}</style>

        <div className="px-3 py-3 space-y-2">
          {mobileLeads.length === 0 ? (
            <EmptyState
              title="No hay leads en esta etapa"
              subtitle="Puedes crear uno directamente aquí."
              actionLabel="+ Nuevo lead"
              onAction={() => onCreateLead?.(mobileStageId)}
              variant="dashed"
            />
          ) : (
            <div
              key={mobileStageId}
              className="space-y-2 motion-safe:animate-[vantFadeSlideIn_150ms_ease-out] motion-reduce:animate-none"
            >
              {mobileLeads.map((lead) => (
                <LeadCardMobile
                  key={lead.id}
                  lead={lead}
                  stages={stagesLite}
                  stageName={mobileStageName}
                  onMoveStage={onMoveStage}
                  onToast={onToast}
                />
              ))}
            </div>
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
              stages={stages}
              leads={leadsByStage.get(stage.id) ?? emptyLeads}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onMoveStage={onMoveStage}
              onToast={onToast}
            />
          ))}
        </div>
      </div>
    </>
  )
}
