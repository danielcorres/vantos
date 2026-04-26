import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react'

export type AnimationVariant = 'fade' | 'up' | 'scale'

interface AnimatedContainerProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  variant?: AnimationVariant
  delayMs?: number
  as?: ElementType
  children?: ReactNode
}

const VARIANT_CLASS: Record<AnimationVariant, string> = {
  fade: 'animate-fade-in',
  up: 'animate-fade-in-up',
  scale: 'animate-scale-in',
}

export function AnimatedContainer({
  variant = 'up',
  delayMs,
  as: Tag = 'div',
  className = '',
  style,
  children,
  ...rest
}: AnimatedContainerProps) {
  const composedClassName = `${VARIANT_CLASS[variant]} ${className}`.trim()
  const composedStyle: CSSProperties | undefined = delayMs
    ? { ...style, animationDelay: `${delayMs}ms` }
    : style

  return (
    <Tag className={composedClassName} style={composedStyle} {...rest}>
      {children}
    </Tag>
  )
}
