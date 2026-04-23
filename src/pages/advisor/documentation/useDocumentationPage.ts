import { useCallback, useEffect, useState } from 'react'
import {
  fetchDocumentationPage,
  loadDocumentationHtmlForEditor,
  upsertDocumentationPage,
} from './documentationApi'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

/** Carga HTML guardado para vista iframe (null = usar URL estática). */
export function useDocumentationBodyHtml(slug: string): {
  state: LoadState
  bodyHtml: string | null
  error: string | null
  reload: () => void
} {
  const [state, setState] = useState<LoadState>('idle')
  const [bodyHtml, setBodyHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setState('loading')
    setError(null)

    ;(async () => {
      try {
        const row = await fetchDocumentationPage(slug)
        if (cancelled) return
        if (row?.body_html?.trim()) {
          setBodyHtml(row.body_html)
        } else {
          setBodyHtml(null)
        }
        setState('ready')
      } catch (e) {
        if (cancelled) return
        setBodyHtml(null)
        setError(e instanceof Error ? e.message : 'Error al cargar documentación')
        setState('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug, tick])

  return { state, bodyHtml, error, reload }
}

/** Editor: carga inicial desde BD o estático; guardado con saneado. */
export function useDocumentationEditor(slug: string, defaultTitle: string) {
  const [state, setState] = useState<LoadState>('idle')
  const [html, setHtml] = useState('')
  const [title, setTitle] = useState(defaultTitle)
  const [loadSource, setLoadSource] = useState<'database' | 'static' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    setError(null)

    ;(async () => {
      try {
        const result = await loadDocumentationHtmlForEditor(slug)
        if (cancelled) return
        setHtml(result.html)
        setTitle(result.title === slug ? defaultTitle : result.title)
        setLoadSource(result.source)
        setState('ready')
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error al cargar')
        setState('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug, defaultTitle])

  const save = useCallback(async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await upsertDocumentationPage(slug, title, html)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al guardar')
      throw e
    } finally {
      setSaving(false)
    }
  }, [slug, title, html])

  return {
    state,
    html,
    setHtml,
    title,
    setTitle,
    loadSource,
    error,
    saving,
    saveError,
    setSaveError,
    save,
  }
}
