import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', loading, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-3.5 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0f0f0f] disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-500',
        variant === 'secondary' && 'bg-white/10 text-white hover:bg-white/15 focus:ring-white/20',
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
