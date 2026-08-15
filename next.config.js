/** @type {import('next').NextConfig} */
// Proxy same-origin hacia el backend (B2, docs/pendientes-2026-08-13.md en
// app-main): appfrontend y app-main viven en dominios de Render distintos
// (no subdominios de una raíz compartida), así que una cookie httpOnly del
// backend nunca le llegaría al browser en un fetch cross-origin normal, salvo
// con SameSite=None -- cada vez más bloqueado por navegadores como cookie de
// tercero. Con este rewrite, todo /api/* que pide el browser va al MISMO
// origen que el frontend; Next.js lo reenvía server-side al backend real, así
// que la cookie que fija el backend queda asociada al dominio del frontend.
//
// Sigue funcionando igual para el auth actual (header Authorization) --
// este paso no cambia el mecanismo de auth todavía, solo hace que el
// transporte sea same-origin, requisito previo para poder migrar a
// httpOnly cookie después sin reescribir esto de nuevo.
const nextConfig = {
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_API_URL
    if (!backend) return []
    return [
      { source: '/api/:path*', destination: `${backend}/api/:path*` },
      // /platform/* (panel superadmin, 15/08/2026) -- el backend lo monta
      // SIN prefijo /api (app.ts: app.use('/platform', ...)), así que el
      // rewrite de arriba no lo cubre. No lleva cookie (el login de
      // plataforma devuelve el JWT en el body, ver PlatformAuthContext),
      // pero igual conviene same-origin: evita configurar CORS aparte para
      // esta única sección.
      { source: '/platform/:path*', destination: `${backend}/platform/:path*` },
    ]
  },
}
module.exports = nextConfig
