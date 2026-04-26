import { AnimatedContainer } from './AnimatedContainer'
import { LoadingSpinner } from './LoadingSpinner'

interface PageLoadingProps {
  label?: string
  className?: string
  /** Tamaño del spinner. Default 22 (page). Para secciones pequeñas usa 16. */
  size?: number
  /** Si true, usa min-h alto (pantallas full); default false. */
  fullHeight?: boolean
}

export function PageLoading({
  label = 'Cargando...',
  className = '',
  size = 22,
  fullHeight = false,
}: PageLoadingProps) {
  return (
    <AnimatedContainer
      variant="up"
      className={`flex items-center justify-center p-8 ${fullHeight ? 'min-h-[40vh]' : ''} ${className}`.trim()}
    >
      <LoadingSpinner
        size={size}
        label={label}
        className="text-neutral-600 dark:text-neutral-300"
      />
    </AnimatedContainer>
  )
}
