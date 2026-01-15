import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

type PipelineStageSettings = {
  id: string
  name: string
  position: number
  sla_enabled: boolean
  sla_days: number | null
  sla_warn_days: number | null
}

type StageFormData = {
  sla_enabled: boolean
  sla_days: number | null
  sla_warn_days: number | null
}

type StageChanges = {
  [stageId: string]: StageFormData & { hasChanges: boolean; isValid: boolean }
}

export function PipelineSettingsPage() {
  const navigate = useNavigate()
  const [stages, setStages] = useState<PipelineStageSettings[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [changes, setChanges] = useState<StageChanges>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<{ [key: string]: string }>({})

  const loadStages = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('pipeline_stages')
        .select('id, name, position, sla_enabled, sla_days, sla_warn_days')
        .order('position', { ascending: true })

      if (fetchError) throw fetchError

      const stagesData = (data || []).map((s) => ({
        ...s,
        sla_enabled: s.sla_enabled ?? false,
        sla_days: s.sla_days ?? null,
        sla_warn_days: s.sla_warn_days ?? null,
      }))

      setStages(stagesData)

      // Initialize changes tracking
      const initialChanges: StageChanges = {}
      stagesData.forEach((stage) => {
        initialChanges[stage.id] = {
          sla_enabled: stage.sla_enabled,
          sla_days: stage.sla_days,
          sla_warn_days: stage.sla_warn_days,
          hasChanges: false,
          isValid: true,
        }
      })
      setChanges(initialChanges)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar etapas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStages()
  }, [])

  const updateStageChange = (
    stageId: string,
    field: keyof StageFormData,
    value: boolean | number | null
  ) => {
    const stage = stages.find((s) => s.id === stageId)
    if (!stage) return

    const currentChange = changes[stageId] || {
      sla_enabled: stage.sla_enabled,
      sla_days: stage.sla_days,
      sla_warn_days: stage.sla_warn_days,
      hasChanges: false,
      isValid: true,
    }

    const newChange = {
      ...currentChange,
      [field]: value,
    }

    // Validate: warn_days must be <= sla_days if both are set and sla_enabled
    let isValid = true
    if (
      newChange.sla_enabled &&
      newChange.sla_days !== null &&
      newChange.sla_warn_days !== null &&
      newChange.sla_warn_days > newChange.sla_days
    ) {
      isValid = false
    }

    // Check if there are changes from original
    const hasChanges =
      newChange.sla_enabled !== stage.sla_enabled ||
      newChange.sla_days !== stage.sla_days ||
      newChange.sla_warn_days !== stage.sla_warn_days

    setChanges({
      ...changes,
      [stageId]: {
        ...newChange,
        hasChanges,
        isValid,
      },
    })

    // Clear save message for this stage
    if (saveMessage[stageId]) {
      setSaveMessage({ ...saveMessage, [stageId]: '' })
    }
  }

  const handleSave = async (stageId: string) => {
    const change = changes[stageId]
    if (!change || !change.hasChanges || !change.isValid) return

    setSaving(stageId)
    try {
      const updateData: Partial<PipelineStageSettings> = {
        sla_enabled: change.sla_enabled,
        sla_days: change.sla_days,
        sla_warn_days: change.sla_warn_days,
      }

      const { error: updateError } = await supabase
        .from('pipeline_stages')
        .update(updateData)
        .eq('id', stageId)

      if (updateError) throw updateError

      // Update local state
      setStages(
        stages.map((s) =>
          s.id === stageId
            ? {
                ...s,
                sla_enabled: change.sla_enabled,
                sla_days: change.sla_days,
                sla_warn_days: change.sla_warn_days,
              }
            : s
        )
      )

      // Mark as saved (no changes)
      setChanges({
        ...changes,
        [stageId]: {
          ...change,
          hasChanges: false,
        },
      })

      // Show success message
      setSaveMessage({ ...saveMessage, [stageId]: 'Guardado' })
      setTimeout(() => {
        setSaveMessage({ ...saveMessage, [stageId]: '' })
      }, 2000)
    } catch (err) {
      setSaveMessage({
        ...saveMessage,
        [stageId]: err instanceof Error ? err.message : 'Error al guardar',
      })
      setTimeout(() => {
        setSaveMessage({ ...saveMessage, [stageId]: '' })
      }, 3000)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div>
        <div className="row space-between" style={{ marginBottom: '24px' }}>
          <h2 className="title">Configurar SLA por etapa</h2>
        </div>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  height: '80px',
                  background: 'var(--bg)',
                  borderRadius: '8px',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div className="row space-between" style={{ marginBottom: '24px' }}>
          <h2 className="title">Configurar SLA por etapa</h2>
          <button onClick={() => navigate(-1)} className="btn btn-ghost">
            Volver
          </button>
        </div>
        <div className="error-box">
          <p style={{ margin: '0 0 12px 0' }}>{error}</p>
          <button onClick={loadStages} className="btn btn-primary">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="row space-between" style={{ marginBottom: '24px' }}>
        <h2 className="title">Configurar SLA por etapa</h2>
        <button onClick={() => navigate(-1)} className="btn btn-ghost">
          Volver
        </button>
      </div>

      <div className="card" style={{ padding: '0' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    borderBottom: '2px solid var(--border)',
                    fontWeight: '600',
                    fontSize: '13px',
                  }}
                >
                  Etapa
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '12px 16px',
                    borderBottom: '2px solid var(--border)',
                    fontWeight: '600',
                    fontSize: '13px',
                  }}
                >
                  SLA activo
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    borderBottom: '2px solid var(--border)',
                    fontWeight: '600',
                    fontSize: '13px',
                  }}
                >
                  SLA (días)
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    borderBottom: '2px solid var(--border)',
                    fontWeight: '600',
                    fontSize: '13px',
                  }}
                >
                  Alerta antes (días)
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '12px 16px',
                    borderBottom: '2px solid var(--border)',
                    fontWeight: '600',
                    fontSize: '13px',
                  }}
                >
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage) => {
                const change = changes[stage.id] || {
                  sla_enabled: stage.sla_enabled,
                  sla_days: stage.sla_days,
                  sla_warn_days: stage.sla_warn_days,
                  hasChanges: false,
                  isValid: true,
                }
                const isDisabled = !change.sla_enabled
                const hasValidationError =
                  change.sla_enabled &&
                  change.sla_days !== null &&
                  change.sla_warn_days !== null &&
                  change.sla_warn_days > change.sla_days

                return (
                  <tr key={stage.id}>
                    <td style={{ padding: '16px', fontWeight: '600' }}>
                      {stage.name}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={change.sla_enabled}
                          onChange={(e) =>
                            updateStageChange(stage.id, 'sla_enabled', e.target.checked)
                          }
                          style={{
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer',
                          }}
                        />
                      </label>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <input
                        type="number"
                        min="0"
                        value={change.sla_days ?? ''}
                        onChange={(e) => {
                          const value = e.target.value
                          updateStageChange(
                            stage.id,
                            'sla_days',
                            value === '' ? null : parseInt(value, 10)
                          )
                        }}
                        disabled={isDisabled}
                        placeholder="Días"
                        style={{
                          width: '100px',
                          padding: '6px 8px',
                          opacity: isDisabled ? 0.5 : 1,
                        }}
                      />
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div>
                        <input
                          type="number"
                          min="0"
                          value={change.sla_warn_days ?? ''}
                          onChange={(e) => {
                            const value = e.target.value
                            updateStageChange(
                              stage.id,
                              'sla_warn_days',
                              value === '' ? null : parseInt(value, 10)
                            )
                          }}
                          disabled={isDisabled}
                          placeholder="Días"
                          style={{
                            width: '100px',
                            padding: '6px 8px',
                            opacity: isDisabled ? 0.5 : 1,
                          }}
                        />
                        {hasValidationError && (
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#c33',
                              marginTop: '4px',
                            }}
                          >
                            Debe ser ≤ SLA (días)
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <button
                          onClick={() => handleSave(stage.id)}
                          disabled={
                            !change.hasChanges ||
                            !change.isValid ||
                            saving === stage.id
                          }
                          className="btn btn-primary"
                          style={{
                            fontSize: '12px',
                            padding: '6px 12px',
                          }}
                        >
                          {saving === stage.id ? 'Guardando...' : 'Guardar'}
                        </button>
                        {saveMessage[stage.id] && (
                          <div
                            style={{
                              fontSize: '11px',
                              color:
                                saveMessage[stage.id] === 'Guardado'
                                  ? '#3c3'
                                  : '#c33',
                            }}
                          >
                            {saveMessage[stage.id]}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
          <strong>Nota:</strong> Los SLAs configurados determinarán qué leads
          aparecen en la página "Qué hacer hoy". Cuando un lead supere el SLA
          o se acerque a la fecha de advertencia, aparecerá en el focus para
          seguimiento.
        </p>
      </div>
    </div>
  )
}
