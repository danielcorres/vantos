import { useCallback, useEffect, useRef, useState } from 'react'
import { pipelineApi, type Lead } from '../../pipeline/pipeline.api'

const DEBOUNCE_MS = 280
const SEARCH_LIMIT = 15

type Props = {
  /** Lead fijado desde fuera (URL / pipeline): solo lectura del nombre. */
  locked?: boolean
  /** Texto del input cuando aún no hay lead (búsqueda / título libre al guardar). */
  draft: string
  onDraftChange: (v: string) => void
  selectedLead: Lead | null
  onSelectLead: (lead: Lead) => void
  onClear: () => void
}

export function AppointmentLeadPicker({
  locked,
  draft,
  onDraftChange,
  selectedLead,
  onSelectLead,
  onClear,
}: Props) {
  const [results, setResults] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    const t = q.trim()
    if (t.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { leads } = await pipelineApi.queryActivosLeads({
        offset: 0,
        limit: SEARCH_LIMIT,
        search: t,
      })
      setResults(leads)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (locked) return
    if (selectedLead) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void runSearch(draft)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [draft, locked, selectedLead, runSearch])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (locked && selectedLead) {
    return (
      <div>
        <label className="block text-xs font-medium text-muted mb-1">Cliente</label>
        <input
          type="text"
          readOnly
          value={selectedLead.full_name}
          className="w-full rounded-lg border border-border bg-neutral-50 dark:bg-neutral-900/40 px-3 py-2 text-sm text-text"
        />
      </div>
    )
  }

  const inputValue = selectedLead ? selectedLead.full_name : draft

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs font-medium text-muted mb-1">Cliente</label>
      <div className="flex gap-2">
        <input
          type="text"
          autoComplete="off"
          value={inputValue}
          onChange={(e) => {
            const v = e.target.value
            if (selectedLead) {
              onClear()
              onDraftChange(v)
              setOpen(true)
            } else {
              onDraftChange(v)
              setOpen(true)
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar o escribir nombre…"
          readOnly={!!selectedLead}
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted read-only:bg-neutral-50 dark:read-only:bg-neutral-900/40"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {selectedLead ? (
          <button
            type="button"
            onClick={() => {
              onClear()
              onDraftChange('')
              setResults([])
            }}
            className="shrink-0 rounded-lg border border-border px-2.5 py-2 text-xs font-medium text-muted hover:bg-black/5"
          >
            Cambiar
          </button>
        ) : null}
      </div>
      {open && !selectedLead && (draft.trim().length >= 2 || loading) ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-bg py-1 shadow-lg"
        >
          {loading ? (
            <li className="px-3 py-2 text-xs text-muted">Buscando…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted">Sin resultados</li>
          ) : (
            results.map((lead) => (
              <li key={lead.id} role="option">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-black/5"
                  onClick={() => {
                    onSelectLead(lead)
                    setOpen(false)
                    setResults([])
                  }}
                >
                  <span className="font-medium text-text">{lead.full_name}</span>
                  {lead.phone || lead.email ? (
                    <span className="block text-xs text-muted truncate">
                      {[lead.phone, lead.email].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
