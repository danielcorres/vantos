import { PipelineTableView } from './PipelineTableView'
import type { Lead } from '../pipeline.api'
import type { CalendarEvent } from '../../calendar/types/calendar.types'

export type PipelineRecordsViewProps = {
  activosLeads?: Lead[] | null
  /** Próxima cita por lead (misma fuente que Kanban). */
  nextAppointmentByLeadId?: Record<string, CalendarEvent | null>
  pipelineMode?: 'activos' | 'archivados'
  groupByStage?: boolean
  onCountsChange?: (counts: { activos: number; archivados: number }) => void
  onRefreshActivos?: () => Promise<void>
  onMoveStageOptimistic?: (
    leadId: string,
    fromStageId: string,
    toStageId: string,
    prevStageChangedAt: string | null
  ) => void
  onMoveStageRollback?: (
    leadId: string,
    fromStageId: string,
    prevStageChangedAt: string | null
  ) => void
  weeklyFilterLeadIds?: Set<string> | null
  weeklyStageLabel?: string | null
  weeklyWeekRange?: string | null
  weeklyLoadError?: string | null
  onClearWeekly?: () => void
  onVisibleCountChange?: (n: number) => void
  onToast?: (message: string) => void
}

/**
 * Records view: reutiliza PipelineTableView para mostrar la tabla de leads
 * con filtros (búsqueda, fuente) y modo activos/archivados.
 */
export function PipelineRecordsView(props: PipelineRecordsViewProps) {
  return <PipelineTableView {...props} />
}
