import DOMPurify from 'dompurify'

/** Reduce XSS al guardar HTML completo (playbook autocontenido). */
export function sanitizeDocumentationHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style', 'link', 'meta'],
    ADD_ATTR: [
      'class',
      'id',
      'href',
      'rel',
      'type',
      'charset',
      'name',
      'content',
      'media',
      'sizes',
      'crossorigin',
      'viewBox',
      'xmlns',
      'fill',
      'aria-hidden',
      'lang',
      'integrity',
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'base'],
    FORBID_ATTR: ['onclick', 'onerror', 'onload', 'onmouseover', 'formaction'],
  } as import('dompurify').Config)
}
