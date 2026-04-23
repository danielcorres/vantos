import { Link } from 'react-router-dom'

const DOCS = [
  {
    id: 'playbook',
    title: 'Playbook Consulta',
    description: 'Manual de onboarding y operación del Sistema Consulta.',
    to: '/docs/playbook',
  },
] as const

export function DocumentationIndexPage() {
  return (
    <div className="flex flex-col gap-6 max-w-[900px] mx-auto w-full px-4 pb-8">
      <div>
        <h1 className="text-2xl font-semibold text-text">Documentación</h1>
        <p className="text-sm text-muted mt-1">
          Elige un documento. Aquí iremos publicando guías y manuales internos.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        {DOCS.map((doc) => (
          <li key={doc.id}>
            <Link
              to={doc.to}
              className="card block p-5 h-full transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <h2 className="text-base font-semibold text-text">{doc.title}</h2>
              <p className="text-sm text-muted mt-2">{doc.description}</p>
              <span className="inline-block mt-3 text-sm font-medium text-primary">Abrir</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
