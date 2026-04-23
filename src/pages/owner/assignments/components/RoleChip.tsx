import { useState, useRef, useEffect } from 'react'
import type { AssignmentProfile } from '../types'
import { isEditableAssignmentRole, type EditableRole } from '../types'
import { roleLabelEs } from '../copy'

type Props = {
  currentRole: AssignmentProfile['role']
  disabled?: boolean
  onChange: (next: EditableRole) => void
}

const OPTIONS: EditableRole[] = ['advisor', 'manager', 'recruiter', 'director', 'seguimiento']

export function RoleChip({ currentRole, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (disabled || !isEditableAssignmentRole(currentRole)) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-md bg-black/5 text-sm font-medium text-text">
        {roleLabelEs(currentRole)}
      </span>
    )
  }

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-bg text-sm font-medium text-text hover:bg-black/5"
      >
        {roleLabelEs(currentRole)}
        <span className="text-muted text-xs">▾</span>
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 min-w-[10rem] rounded-md border border-border bg-surface shadow-lg py-1"
          role="menu"
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              role="menuitem"
              className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 ${
                opt === currentRole ? 'font-semibold text-primary' : 'text-text'
              }`}
              onClick={() => {
                onChange(opt)
                setOpen(false)
              }}
            >
              {roleLabelEs(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
