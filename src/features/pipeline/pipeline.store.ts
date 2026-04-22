import type { Lead, PipelineStage } from './pipeline.api'

export interface PipelineState {
  stages: PipelineStage[]
  leads: Lead[]
  loading: boolean
  error: string | null
}

export type PipelineAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; payload: { stages: PipelineStage[]; leads: Lead[] } }
  | { type: 'LOAD_ERROR'; payload: string }
  | { type: 'CREATE_LEAD'; payload: Lead }
  | {
      type: 'MOVE_OPTIMISTIC'
      payload: {
        leadId: string
        fromStageId: string
        toStageId: string
        prevStageChangedAt: string | null
      }
    }
  | {
      type: 'MOVE_ROLLBACK'
      payload: {
        leadId: string
        fromStageId: string
        prevStageChangedAt: string | null
      }
    }
  | { type: 'DELETE_LEAD'; payload: string }
  /** Añade leads nuevos (evita duplicar por id). */
  | { type: 'APPEND_LEADS'; payload: { leads: Lead[] } }
  /** Sustituye en memoria todos los leads de las etapas indicadas por los del payload (merge por id). */
  | { type: 'REFRESH_STAGES_DATA'; payload: { stageIds: string[]; leads: Lead[] } }
  /** Reemplaza leads por id (p. ej. carga semanal puntual). */
  | { type: 'UPSERT_LEADS'; payload: { leads: Lead[] } }

export function pipelineReducer(
  state: PipelineState,
  action: PipelineAction
): PipelineState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, error: null }

    case 'LOAD_SUCCESS':
      return {
        ...state,
        stages: action.payload.stages,
        leads: action.payload.leads,
        loading: false,
        error: null,
      }

    case 'LOAD_ERROR':
      return {
        ...state,
        loading: false,
        error: action.payload,
      }

    case 'CREATE_LEAD':
      return {
        ...state,
        leads: [action.payload, ...state.leads],
      }

    case 'MOVE_OPTIMISTIC':
      return {
        ...state,
        leads: state.leads.map((lead) =>
          lead.id === action.payload.leadId
            ? {
                ...lead,
                stage_id: action.payload.toStageId,
                stage_changed_at: new Date().toISOString(),
              }
            : lead
        ),
      }

    case 'MOVE_ROLLBACK': {
      return {
        ...state,
        leads: state.leads.map((lead) => {
          if (lead.id !== action.payload.leadId) return lead
          const fromPayload = action.payload.prevStageChangedAt
          const validFromPayload =
            typeof fromPayload === 'string' && fromPayload.trim() !== ''
          const validCurrent = lead.stage_changed_at?.trim() !== ''
          const stage_changed_at = validFromPayload
            ? (fromPayload as string)
            : validCurrent
              ? lead.stage_changed_at
              : lead.created_at
          return {
            ...lead,
            stage_id: action.payload.fromStageId,
            stage_changed_at,
          }
        }),
      }
    }

    case 'DELETE_LEAD':
      return {
        ...state,
        leads: state.leads.filter((lead) => lead.id !== action.payload),
      }

    case 'APPEND_LEADS': {
      const seen = new Set(state.leads.map((l) => l.id))
      const add = action.payload.leads.filter((l) => !seen.has(l.id))
      return { ...state, leads: [...state.leads, ...add] }
    }

    case 'REFRESH_STAGES_DATA': {
      const ids = new Set(action.payload.stageIds)
      const rest = state.leads.filter((l) => !ids.has(l.stage_id))
      const incomingIds = new Set(action.payload.leads.map((l) => l.id))
      const restNoDup = rest.filter((l) => !incomingIds.has(l.id))
      return { ...state, leads: [...restNoDup, ...action.payload.leads] }
    }

    case 'UPSERT_LEADS': {
      const incoming = action.payload.leads
      if (incoming.length === 0) return state
      const incomingIds = new Set(incoming.map((l) => l.id))
      return {
        ...state,
        leads: [...state.leads.filter((l) => !incomingIds.has(l.id)), ...incoming],
      }
    }

    default:
      return state
  }
}

export function generateIdempotencyKey(
  leadId: string,
  fromStageId: string,
  toStageId: string
): string {
  const bucket = Math.floor(Date.now() / (10 * 60 * 1000))
  return `move_lead_stage:${leadId}:${fromStageId}:${toStageId}:${bucket}`
}
