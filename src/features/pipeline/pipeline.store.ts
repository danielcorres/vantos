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
  | { type: 'MOVE_OPTIMISTIC'; payload: { leadId: string; toStageId: string } }
  | { type: 'MOVE_ROLLBACK'; payload: { leadId: string; fromStageId: string } }
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

    case 'MOVE_ROLLBACK':
      return {
        ...state,
        leads: state.leads.map((lead) =>
          lead.id === action.payload.leadId
            ? {
                ...lead,
                stage_id: action.payload.fromStageId,
              }
            : lead
        ),
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
