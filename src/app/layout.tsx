import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'

// Mismas 3 tipografías y variables que dashboard/layout.tsx (sistema ZULU,
// F3, 23/08/2026) -- acá para que las pantallas FUERA del dashboard
// (login, registro, superadmin/login, invitaciones, restablecer-contraseña)
// también las tengan disponibles, sin depender de que el dashboard las cargue.
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-zulu-display' })
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-zulu-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-zulu-mono' })

export const metadata: Metadata = {
  title: 'ZULU — Centro de coordinación operativa',
  description: 'ZULU conecta señales operativas para coordinar el servicio con claridad.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className={`${spaceGrotesk.variable} ${plexSans.variable} ${plexMono.variable}`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
