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
