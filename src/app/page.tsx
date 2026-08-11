'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getTokenImperative } from '@/context/AuthContext'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    // Antes leía localStorage.getItem('token') — el login hace rato guarda
    // el token en sessionStorage bajo otra clave (ver AuthContext.tsx), así
    // que esto siempre mandaba a /login aunque hubiera sesión activa.
    router.replace(getTokenImperative() ? '/dashboard' : '/login')
  }, [router])
  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
