'use client'
import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** Ancho máximo del panel, default 'max-w-md' */
  size?: 'max-w-sm' | 'max-w-md' | 'max-w-lg' | 'max-w-xl' | 'max-w-2xl'
  children: ReactNode
}

export default function Modal({ open, onClose, title, size = 'max-w-md', children }: ModalProps) {
  // Cierra con Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Bloquea scroll del body mientras está abierto
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--zulu-scrim)', backdropFilter: 'blur(3px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`relative w-full ${size} rounded-xl shadow-2xl`}
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border-md, var(--zulu-overlay-08))',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border, var(--zulu-overlay-06))', flexShrink: 0 }}
        >
          <h2 id="modal-title" className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {title}
          </h2>
          {/*
            V2.6.2b — el hover era `hover:bg-white/10`: blanco al 10% sobre
            la superficie blanca del modal, o sea invisible desde que se
            invirtió la polaridad. Es el mismo defecto que V2.2 vino a
            cerrar, pero escrito en Tailwind, que es la forma que el guard
            no miraba. Ahora usa el overlay del sistema, que sabe de qué
            lado está el fondo.
          */}
          <button
            onClick={onClose}
            className="modal-close p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            aria-label="Cerrar modal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — scroll interno */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}
