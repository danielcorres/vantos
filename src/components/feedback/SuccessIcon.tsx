import styles from './SuccessIcon.module.css'

interface SuccessIconProps {
  size?: number
  animated?: boolean
  className?: string
}

export function SuccessIcon({ size = 64, animated = true, className = '' }: SuccessIconProps) {
  const circleClass = animated ? styles.circle : undefined
  const checkClass = animated ? styles.check : undefined

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${styles.root} ${className}`.trim()}
    >
      <circle
        className={circleClass}
        cx="26"
        cy="26"
        r="24"
        strokeWidth={2.5}
        pathLength={150}
      />
      <path
        className={checkClass}
        d="M14 27 L23 36 L38 18"
        strokeWidth={3}
        pathLength={50}
      />
    </svg>
  )
}
