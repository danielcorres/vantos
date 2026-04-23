import { supabase } from '../../../lib/supabase'
import { PLAYBOOK_STATIC_SRC } from './documentationConstants'
import { sanitizeDocumentationHtml } from './sanitizeDocumentationHtml'

export type DocumentationPageRow = {
  slug: string
  title: string
  body_html: string
  updated_at: string
  updated_by: string | null
}

export async function fetchDocumentationPage(slug: string): Promise<DocumentationPageRow | null> {
  const { data, error } = await supabase
    .from('documentation_pages')
    .select('slug,title,body_html,updated_at,updated_by')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data || typeof data.body_html !== 'string' || !data.body_html.trim()) {
    return null
  }
  return data as DocumentationPageRow
}

export async function fetchStaticDocumentationHtml(staticPath: string): Promise<string> {
  const res = await fetch(staticPath, { credentials: 'same-origin' })
  if (!res.ok) {
    throw new Error(`No se pudo cargar el documento estático (${res.status})`)
  }
  return res.text()
}

/** Carga HTML para edición: BD si existe; si no, archivo en `public/`. */
export async function loadDocumentationHtmlForEditor(
  slug: string,
  staticFallbackPath: string = PLAYBOOK_STATIC_SRC
): Promise<{ source: 'database' | 'static'; html: string; title: string }> {
  const row = await fetchDocumentationPage(slug)
  if (row && row.body_html.trim()) {
    return { source: 'database', html: row.body_html, title: row.title || slug }
  }
  const html = await fetchStaticDocumentationHtml(staticFallbackPath)
  return { source: 'static', html, title: slug }
}

export async function upsertDocumentationPage(
  slug: string,
  title: string,
  bodyHtml: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión')

  const sanitized = sanitizeDocumentationHtml(bodyHtml)
  const { error } = await supabase.from('documentation_pages').upsert(
    {
      slug,
      title: title.trim() || slug,
      body_html: sanitized,
      updated_by: user.id,
    },
    { onConflict: 'slug' }
  )
  if (error) throw error
}
