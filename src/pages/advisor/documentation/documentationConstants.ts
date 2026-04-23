/** Slug en `documentation_pages`; coincide con el archivo estático sin extensión. */
export const PLAYBOOK_DOCUMENT_SLUG = 'playbook-consulta'

export const PLAYBOOK_STATIC_SRC = '/docs/playbook-consulta.html'

export const PLAYBOOK_DEFAULT_TITLE = 'Playbook Consulta'

export function canEditDocumentation(role: string | null): boolean {
  return role === 'owner' || role === 'director'
}
