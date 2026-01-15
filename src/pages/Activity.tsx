import { useState, useEffect } from 'react'
import { useSession } from '../lib/useSession'
import { supabase } from '../lib/supabase'
import './Activity.css'

// Métricas según PROJECT_CONTEXT.md - OKR v0
const METRICS = [
  { key: 'calls', label: 'Llamadas' },
  { key: 'meetings_set', label: 'Citas agendadas' },
  { key: 'meetings_held', label: 'Citas realizadas' },
  { key: 'proposals_presented', label: 'Propuestas presentadas' },
  { key: 'applications_submitted', label: 'Solicitudes ingresadas' },
  { key: 'referrals', label: 'Referidos' },
  { key: 'policies_paid', label: 'Pólizas pagadas' },
] as const

type MetricKey = typeof METRICS[number]['key']

export function Activity() {
  const { session, loading: sessionLoading } = useSession()
  const [formData, setFormData] = useState<Record<MetricKey, number>>({
    calls: 0,
    meetings_set: 0,
    meetings_held: 0,
    proposals_presented: 0,
    applications_submitted: 0,
    referrals: 0,
    policies_paid: 0,
  })
  const [points, setPoints] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const hoy = new Date().toISOString().slice(0, 10)
  const userId = session?.user?.id

  // Calcular puntos de hoy desde activity_events
  useEffect(() => {
    if (!userId || sessionLoading) return

    const loadPoints = async () => {
      const hoyStart = new Date(hoy + 'T00:00:00').toISOString()
      const hoyEnd = new Date(hoy + 'T23:59:59.999').toISOString()

      // Calcular puntos sumando los eventos de hoy
      // Nota: Esto requiere que exista point_rules y se calcule correctamente
      // Por ahora, simplemente contamos eventos (lógica simplificada)
      const { data, error } = await supabase
        .from('activity_events')
        .select('value, metric_key')
        .eq('actor_user_id', userId)
        .gte('happened_at', hoyStart)
        .lte('happened_at', hoyEnd)
        .eq('is_void', false)

      if (error) {
        console.error('Error al cargar puntos:', error)
        return
      }

      // Suma simple de valores (debería calcularse desde point_rules en producción)
      const totalPoints = data?.reduce((sum, event) => sum + (event.value || 0), 0) ?? 0
      setPoints(totalPoints)
    }

    loadPoints()
  }, [userId, hoy, sessionLoading])

  // Cargar datos existentes de hoy
  useEffect(() => {
    if (!userId || sessionLoading) return

    const loadTodayData = async () => {
      const hoyStart = new Date(hoy + 'T00:00:00').toISOString()
      const hoyEnd = new Date(hoy + 'T23:59:59.999').toISOString()

      const { data, error } = await supabase
        .from('activity_events')
        .select('metric_key, value')
        .eq('actor_user_id', userId)
        .gte('happened_at', hoyStart)
        .lte('happened_at', hoyEnd)
        .eq('is_void', false)

      if (error) {
        console.error('Error al cargar datos:', error)
        return
      }

      if (data && data.length > 0) {
        const newFormData: Record<MetricKey, number> = {
          calls: 0,
          meetings_set: 0,
          meetings_held: 0,
          proposals_presented: 0,
          applications_submitted: 0,
          referrals: 0,
          policies_paid: 0,
        }
        // Agrupar por metric_key y sumar valores
        data.forEach((item) => {
          if (item.metric_key in newFormData) {
            newFormData[item.metric_key as MetricKey] += item.value || 0
          }
        })
        setFormData(newFormData)
      }
    }

    loadTodayData()
  }, [userId, hoy, sessionLoading])

  const handleInputChange = (key: MetricKey, value: string) => {
    const numValue = Math.max(0, parseInt(value) || 0)
    setFormData((prev) => ({ ...prev, [key]: numValue }))
  }

  const handleSave = async () => {
    if (!userId) {
      setMessage({ type: 'error', text: 'No hay sesión activa' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      // Insertar eventos para cada métrica con valor > 0
      const eventsToInsert = METRICS.filter((metric) => formData[metric.key] > 0).map(
        (metric) => ({
          actor_user_id: userId,
          metric_key: metric.key,
          value: formData[metric.key],
          happened_at: new Date().toISOString(), // Usar timestamp actual
          recorded_at: new Date().toISOString(),
          source: 'manual' as const,
          idempotency_key: null, // Para eventos manuales puede ser null
          metadata: null,
          is_void: false,
        })
      )

      if (eventsToInsert.length === 0) {
        setMessage({ type: 'error', text: 'No hay datos para guardar' })
        setLoading(false)
        return
      }

      const { error: insertError } = await supabase
        .from('activity_events')
        .insert(eventsToInsert)

      if (insertError) {
        console.error('Error al guardar datos:', insertError)
        const message = insertError.message || 'Error desconocido'
        const details = insertError.details ? ` (${insertError.details})` : ''
        throw new Error(`${message}${details}`)
      }

      // Recargar puntos calculados desde eventos
      const hoyStart = new Date(hoy + 'T00:00:00').toISOString()
      const hoyEnd = new Date(hoy + 'T23:59:59.999').toISOString()

      const { data: eventsData } = await supabase
        .from('activity_events')
        .select('value')
        .eq('actor_user_id', userId)
        .gte('happened_at', hoyStart)
        .lte('happened_at', hoyEnd)
        .eq('is_void', false)

      if (eventsData) {
        const totalPoints = eventsData.reduce((sum, event) => sum + (event.value || 0), 0)
        setPoints(totalPoints)
      }
      setMessage({ type: 'success', text: 'Datos guardados correctamente' })
    } catch (error: any) {
      const errorMessage = error.message || 'Error al guardar los datos'
      const errorDetails = error.details ? ` (${error.details})` : ''
      const fullMessage = `${errorMessage}${errorDetails}`
      console.error('Error completo al guardar:', error)
      setMessage({ type: 'error', text: fullMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleRecalculate = async () => {
    if (!userId) {
      setMessage({ type: 'error', text: 'No hay sesión activa' })
      return
    }

    setRecalculating(true)
    setMessage(null)

    try {
      // Recalcular puntos desde eventos de hoy
      const hoyStart = new Date(hoy + 'T00:00:00').toISOString()
      const hoyEnd = new Date(hoy + 'T23:59:59.999').toISOString()

      const { data, error } = await supabase
        .from('activity_events')
        .select('value')
        .eq('actor_user_id', userId)
        .gte('happened_at', hoyStart)
        .lte('happened_at', hoyEnd)
        .eq('is_void', false)

      if (error) throw error

      const totalPoints = data?.reduce((sum, event) => sum + (event.value || 0), 0) ?? 0
      setPoints(totalPoints)
      setMessage({ type: 'success', text: 'Puntos recalculados correctamente' })
    } catch (error: any) {
      const errorMessage = error.message || 'Error desconocido'
      const errorDetails = error.details ? ` (${error.details})` : ''
      console.error('Error al recalcular puntos:', error)
      setMessage({ type: 'error', text: `Error al recalcular puntos: ${errorMessage}${errorDetails}` })
    } finally {
      setRecalculating(false)
    }
  }

  if (sessionLoading) {
    return <div className="activity-loading">Cargando...</div>
  }

  return (
    <div className="activity-container">
      <h1>Registro Diario</h1>
      <p className="today-date">Hoy: {hoy}</p>

      <div className="points-display">
        <span className="points-label">Puntos de hoy:</span>
        <span className="points-value">{points}</span>
      </div>

      <form
        className="activity-form"
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
      >
        {METRICS.map((metric) => (
          <div key={metric.key} className="form-group">
            <label htmlFor={metric.key}>{metric.label}</label>
            <input
              id={metric.key}
              type="number"
              min="0"
              value={formData[metric.key]}
              onChange={(e) => handleInputChange(metric.key, e.target.value)}
              disabled={loading}
            />
          </div>
        ))}

        {message && (
          <div className={`message ${message.type}`}>{message.text}</div>
        )}

        <div className="form-actions">
          <button type="submit" disabled={loading || recalculating} className="save-btn">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={handleRecalculate}
            disabled={loading || recalculating}
            className="recalculate-btn"
          >
            {recalculating ? 'Recalculando...' : 'Recalcular hoy'}
          </button>
        </div>
      </form>
    </div>
  )
}
