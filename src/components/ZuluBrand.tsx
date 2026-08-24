import type { CSSProperties } from 'react'

type ZuluMarkProps = {
  size?: number
  className?: string
  style?: CSSProperties
}

export function ZuluMark({ size = 36, className = '', style }: ZuluMarkProps) {
  return (
    <span
      className={`zulu-mark ${className}`}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" fill="none" role="presentation">
        <circle cx="6" cy="8" r="3.25" fill="currentColor" opacity="0.95" />
        <circle cx="26" cy="24" r="3.25" fill="currentColor" opacity="0.95" />
        <path
          d="M6 8h20L6 24h20"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

type ZuluBrandProps = {
  subtitle?: string
  compact?: boolean
  className?: string
}

export default function ZuluBrand({ subtitle, compact = false, className = '' }: ZuluBrandProps) {
  return (
    <div className={`brand-lockup${compact ? ' brand-lockup-compact' : ''} ${className}`.trim()}>
      <ZuluMark size={compact ? 30 : 42} />
      <div className="brand-lockup-copy">
        <span className="brand-wordmark">ZULU</span>
        {subtitle && <span className="brand-subtitle">{subtitle}</span>}
      </div>
    </div>
  )
}
