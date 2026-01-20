type FullScreenLoaderProps = {
  label?: string
}

export function FullScreenLoader({ label = 'Cargando...' }: FullScreenLoaderProps) {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen gap-4">
      <span className="text-muted">{label}</span>
    </div>
  )
}
