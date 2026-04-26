interface SuccessIconProps {
  size?: number
  className?: string
}

export function SuccessIcon({ size = 64, className = '' }: SuccessIconProps) {
  const inner = Math.round(size * 0.5)

  return (
    <div
      aria-hidden="true"
      className={`animate-scale-in inline-flex items-center justify-center rounded-full bg-green-50 text-green-600 ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: inner, height: inner }}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  )
}
