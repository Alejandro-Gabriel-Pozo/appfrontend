type Variant = 'success' | 'warning' | 'danger' | 'info'

/** Reemplaza el KpiCard local que cada pantalla reimplementaba — mismo
 * markup/clases .kpi-* (ya token-driven), ahora como componente
 * reutilizable (guía ZULU §5: TelemetryCard). */
export default function TelemetryCard({
  label,
  value,
  sub,
  icon,
  variant,
  loading,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ReactNode
  variant?: Variant
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="kpi-card">
        <div className="skeleton h-3 w-20 mb-4" />
        <div className="skeleton h-8 w-14 mb-3" />
        <div className="skeleton h-3 w-28" />
      </div>
    )
  }

  const accentColor: Record<Variant, string> = {
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
    info: 'var(--info)',
  }
  const accentDim: Record<Variant, string> = {
    success: 'var(--success-dim)',
    warning: 'var(--warning-dim)',
    danger: 'var(--danger-dim)',
    info: 'var(--info-dim)',
  }
  const color = variant ? accentColor[variant] : 'var(--zulu-technical)'
  const dim = variant ? accentDim[variant] : 'var(--zulu-surface-selected)'
  const variantClass = variant ? ` kpi-card-${variant}` : ''

  return (
    <div className={`kpi-card${variantClass}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="kpi-label">{label}</span>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: dim, color }}>
          {icon}
        </div>
      </div>
      <p className="kpi-value">{value}</p>
      <p className="kpi-trend">{sub}</p>
    </div>
  )
}
