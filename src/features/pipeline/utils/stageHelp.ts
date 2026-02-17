export type StageHelp = { title: string; bullets: string[]; tip?: string }

export const STAGE_HELP_BY_SLUG: Record<string, StageHelp> = {
  contactos_nuevos: {
    title: 'Contactos Nuevos',
    bullets: [
      'Leads que acabas de captar o referir.',
      'Objetivo: contactar y calificar.',
      'Mueve a Citas Agendadas cuando confirmes cita.',
    ],
    tip: 'Prioriza los que llevan más tiempo sin contacto.',
  },
  citas_agendadas: {
    title: 'Citas Agendadas',
    bullets: [
      'Leads con cita confirmada.',
      'Objetivo: asegurar asistencia y preparar la reunión.',
      'Mueve a Citas Realizadas cuando se concrete.',
    ],
    tip: 'Revisa próxima acción para no perder citas.',
  },
  citas_realizadas: {
    title: 'Citas Realizadas',
    bullets: [
      'Reunión ya concretada.',
      'Objetivo: enviar propuesta o seguir el proceso.',
      'Mueve a Casos Abiertos cuando haya propuesta.',
    ],
  },
  casos_abiertos: {
    title: 'Casos Abiertos',
    bullets: [
      'Propuesta enviada o en negociación.',
      'Objetivo: responder dudas y cerrar.',
      'Mueve a Citas de Cierre cuando esté listo para firmar.',
    ],
    tip: 'Cotización y seguimiento de documentación.',
  },
  citas_cierre: {
    title: 'Citas de Cierre',
    bullets: [
      'Listo para cita de cierre o firma.',
      'Objetivo: concretar la venta.',
      'Mueve a Solicitudes o Casos Ganados según resultado.',
    ],
    tip: 'Confirma asistencia y documentos antes.',
  },
  solicitudes_ingresadas: {
    title: 'Solicitudes Ingresadas',
    bullets: [
      'En proceso de emisión o documentación.',
      'Objetivo: completar solicitud y firma.',
      'Mueve a Casos Ganados cuando cierre.',
    ],
    tip: 'Revisa requisitos y estado de solicitud.',
  },
  casos_ganados: {
    title: 'Casos Ganados',
    bullets: [
      'Venta cerrada exitosamente.',
      'Lead completado en el pipeline.',
    ],
  },
  casos_perdidos: {
    title: 'Casos Perdidos',
    bullets: [
      'Oportunidad cerrada sin venta.',
      'Puedes archivar el lead si ya no aplica.',
    ],
  },
}

/** Normaliza stage name a slug para lookup (ej. "Contactos Nuevos" → "contactos_nuevos"). */
export function stageNameToHelpKey(name: string): string {
  return (name ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '_')
}

/** Obtiene ayuda por slug o por nombre normalizado. */
export function getStageHelp(slugOrName: string | undefined): StageHelp {
  if (!slugOrName) {
    return {
      title: 'Etapa',
      bullets: ['Aquí van leads en esta etapa.'],
    }
  }
  const bySlug = STAGE_HELP_BY_SLUG[slugOrName.toLowerCase().replace(/\s+/g, '_')]
  if (bySlug) return bySlug

  const key = stageNameToHelpKey(slugOrName)
  const byKey = STAGE_HELP_BY_SLUG[key]
  if (byKey) return byKey

  return {
    title: slugOrName,
    bullets: ['Aquí van leads en esta etapa.'],
  }
}
