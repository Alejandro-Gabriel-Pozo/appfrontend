'use client'
import { useEffect, useRef, useState } from 'react'

// Login con Google (punto 5/E5, pendientes-2026-08-15.md) — usa Google
// Identity Services (el botón de Google devuelve un ID token directo al
// browser, sin intercambio de código en el backend) en vez de OAuth code
// flow completo — más simple, sin necesitar client_secret acá.
//
// Sin NEXT_PUBLIC_GOOGLE_CLIENT_ID configurada (todavía no hay
// credenciales reales, ver pendientes-2026-08-15.md) el componente no
// renderiza nada — no un botón roto.

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (parent: HTMLElement, options: { theme?: string; size?: string; width?: number }) => void
        }
      }
    }
  }
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let gsiScriptPromise: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (gsiScriptPromise) return gsiScriptPromise
  gsiScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SCRIPT_SRC}"]`)
    if (existing) { resolve(); return }
    const script = document.createElement('script')
    script.src = GSI_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar el script de Google'))
    document.head.appendChild(script)
  })
  return gsiScriptPromise
}

interface GoogleSignInButtonProps {
  /** Recibe el ID token verificado por Google — el caller lo manda al backend propio. */
  onCredential: (idToken: string) => void
}

export function GoogleSignInButton({ onCredential }: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!clientId) return
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => onCredential(response.credential),
        })
        setReady(true)
      })
      .catch(() => { /* Sin Google disponible -- el botón simplemente no aparece. */ })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCredential estable por el caller, re-inicializar en cada render rompe el botón de Google
  }, [clientId])

  useEffect(() => {
    if (!ready || !containerRef.current || !window.google) return
    containerRef.current.innerHTML = ''
    window.google.accounts.id.renderButton(containerRef.current, {
      theme: 'outline',
      size: 'large',
      width: 328,
    })
  }, [ready])

  if (!clientId) return null

  return <div ref={containerRef} className="flex justify-center" />
}
