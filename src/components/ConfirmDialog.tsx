'use client'
import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  /** 'danger' usa rojo, 'default' usa el color primario */
  variant?: 'danger' | 'default'
  loading?: boolean
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  variant = 'default',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="max-w-sm">
      <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary, #cbd5e1)' }}>{description}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="btn-secondary flex-1"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            background: variant === 'danger' ? 'var(--danger-dim)' : 'var(--success-dim)',
            color: variant === 'danger' ? 'var(--danger)' : 'var(--success)',
            border: `1px solid ${variant === 'danger' ? 'var(--danger-border)' : 'var(--success-border)'}`,
          }}
        >
          {loading && (
            <span
              className="inline-block w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
              aria-hidden
            />
          )}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
