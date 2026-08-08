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
      <p className="text-sm text-slate-300 mb-6 leading-relaxed">{description}</p>
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
            background: variant === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
            color: variant === 'danger' ? '#f87171' : '#34d399',
            border: `1px solid ${
              variant === 'danger' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'
            }`,
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
