import type { AuthProvider } from '@refinedev/core'

interface AuthState {
  isAuthenticated: boolean
  user: { id: string; email: string; role: string; businessId?: string } | null
  logout: () => Promise<void>
}

// Wrapper sobre AuthContext (confirmado con el dueño, 18/08/2026) — no hay
// una segunda fuente de verdad de sesión. AuthContext ya resuelve todo
// contra /api/auth/me (cookie httpOnly) con refresh en segundo plano cada
// 20 min; este provider solo traduce ese estado al contrato que pide Refine,
// sin volver a golpear /me/ni /refresh por su cuenta. Se construye dentro
// de un componente (dashboard/layout.tsx) que ya llama useAuth(), porque
// AuthProvider (el de Refine) no es un hook — es un objeto plano.
export function createAuthProvider(auth: AuthState): AuthProvider {
  return {
    // El login real sigue pasando por /login, fuera del árbol de <Refine>,
    // usando AuthContext directamente — este método existe solo porque el
    // contrato de AuthProvider lo exige, ninguna pantalla migrada lo llama.
    login: async () => ({
      success: false,
      error: new Error('El login no se gestiona desde Refine — usar /login'),
    }),
    logout: async () => {
      await auth.logout()
      return { success: true, redirectTo: '/login' }
    },
    check: async () =>
      auth.isAuthenticated
        ? { authenticated: true }
        : { authenticated: false, redirectTo: '/login' },
    onError: async error => {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined
      // apiFetch (lib/api.ts) ya redirige a /login en UNAUTHORIZED/TOKEN_EXPIRED
      // antes de que el error llegue acá — esto es solo la señal para que
      // Refine no siga tratando la sesión como válida en su propio estado.
      return code === 'UNAUTHORIZED' || code === 'TOKEN_EXPIRED'
        ? { logout: true, redirectTo: '/login' }
        : {}
    },
    getIdentity: async () => auth.user,
  }
}
