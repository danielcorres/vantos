/**
 * Skeleton de carga para rutas lazy (Suspense fallback).
 * Mantiene estilo ligero y consistente con el sistema.
 */
export function PageSkeleton() {
  return (
    <div className="flex flex-col min-h-0 flex-1 p-4 md:p-6 space-y-4" aria-hidden="true">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-black/10 dark:bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-64 bg-black/5 dark:bg-white/5 rounded animate-pulse" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-24 bg-black/10 dark:bg-white/10 rounded-lg animate-pulse" />
        <div className="h-9 w-24 bg-black/10 dark:bg-white/10 rounded-lg animate-pulse" />
      </div>
      <div className="space-y-3 flex-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-bg/30 p-4">
            <div className="h-4 w-3/4 bg-black/10 dark:bg-white/10 rounded animate-pulse mb-2" />
            <div className="h-3 w-full bg-black/5 dark:bg-white/5 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
