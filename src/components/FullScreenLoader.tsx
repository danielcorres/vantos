import { VantMark } from './branding/VantMark'

type FullScreenLoaderProps = {
  label?: string
  showMark?: boolean
}

export function FullScreenLoader({ label = 'Cargando...', showMark = true }: FullScreenLoaderProps) {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen gap-4">
      {showMark && <VantMark size={48} animated aria-label="VANT" />}
      <span className="text-muted">{label}</span>
    </div>
  )
}
