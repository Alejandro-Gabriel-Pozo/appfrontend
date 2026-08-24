'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ZuluMark } from '@/components/ZuluBrand'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    // Antes leía el token de localStorage de forma sincrónica. Con la
    // cookie httpOnly (B2) ya no hay nada legible desde JS — hay que
    // preguntarle al backend si la sesión es válida.
    fetch('/api/auth/me', { credentials: 'include' })
      .then(res => router.replace(res.ok ? '/dashboard' : '/login'))
      .catch(() => router.replace('/login'))
  }, [router])
  return (
    <div className="zulu min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4" aria-label="Cargando ZULU">
        <ZuluMark size={48} />
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-zulu-mono)' }}>
          <span className="dot-live" /> Sincronizando sesión
        </div>
      </div>
    </div>
  )
}
