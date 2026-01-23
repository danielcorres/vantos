import { VantLogo } from './branding/VantLogo'

type FullScreenLoaderProps = {
  label?: string
  showMark?: boolean
}

export function FullScreenLoader({ label = 'Cargando...', showMark = true }: FullScreenLoaderProps) {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen gap-4">
      {showMark && <VantLogo size={48} mode="light" animated className="mx-auto" aria-label="vant" />}
      <span className="text-muted">{label}</span>
    </div>
  )
}
