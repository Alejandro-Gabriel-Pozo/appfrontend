@AGENTS.md

# Instrucciones del proyecto — appfrontend-main

Frontend (panel admin, Next.js) de una app de reservas multi-tenant y
multirubro. Ver también el `CLAUDE.md` de `App - frontend/` (nivel
superior) para el contexto de los dos repos.

## Modularidad — convenciones aplicadas (no aspiracionales)

Estado real del código después de `app-main/docs/auditoria-modularidad.md`
(auditoría completa de ambos repos) y su roadmap (7 fases, todas
aplicadas). El detalle completo — hallazgos, métricas, razonamiento —
vive en ese documento; acá solo las reglas que un archivo nuevo tiene
que respetar de entrada.

**Tipos y clientes de API viven por dominio de negocio, no en un archivo
central.** `src/lib/<dominio>/types.ts` + `src/lib/<dominio>/api.ts` —
mismo patrón de carpetas que ya usa `app-main/src` (`reservas/`,
`pms-estadias/`, `clientes-finanzas/`...). Dominios existentes:
`catalogo`, `recursos`, `servicios`, `reservas`, `housekeeping`,
`estadias`, `clientes`, `finanzas`, `productos`, `empresa`, `ordenes`,
`usuarios`, `negocio`, `sistema`, `portal`. El fetch base + manejo de
error + interceptor de sesión vencida vive en `src/lib/http.ts`.

**`src/lib/types.ts` y `src/lib/api.ts` son barrels de compatibilidad,
no el lugar para código nuevo.** Solo re-exportan desde
`lib/<dominio>/...` — así el resto del repo puede seguir haciendo
`import { x } from '@/lib/api'` sin que le importe en qué carpeta vive
la implementación real. Un tipo o función de API nueva **va directo en
su `lib/<dominio>/`** correspondiente (creá el dominio si no existe
todavía) y se agrega también como re-export en el barrel — nunca se
declara la implementación real dentro de `types.ts`/`api.ts` mismos, eso
es exactamente el problema que la Fase 5 del roadmap resolvió (dos
archivos de 600+ líneas con todos los dominios mezclados).

**Antes de duplicar lógica entre dos pantallas del dashboard, revisá
`src/hooks/`:**
- Traer recursos/servicios/categorías, filtrar por `isLodging`, listar/
  buscar/paginar reservas, y confirmar/cancelar/completar → ya existe
  `useReservationsScreen(isLodging)` (`hooks/useReservationsScreen.ts`),
  compartido entre Reservas y Turnos. Si agregás una tercera pantalla
  con esta misma forma, extendé el hook, no copies el bloque.
- Chequeo de rol "¿es dueño o administrador?" → `useIsManagement()`/
  `useIsOwner()` (`hooks/useAuthRole.ts`), nunca
  `role === 'OWNER' || role === 'ADMIN'` a mano — esa lógica de
  autorización necesita un solo lugar, no una copia por pantalla (el
  backend igual la valida en serio; esto solo evita mostrar un botón
  que el backend va a rechazar).

**Las tipografías del sistema de diseño "Bastión" se cargan una sola
vez, en `dashboard/layout.tsx`.** Una pantalla nueva del dashboard que
use la clase `.bastion` NO necesita volver a importar
`Fraunces`/`IBM_Plex_Sans`/`IBM_Plex_Mono` — las variables CSS ya
cascadean desde el layout.

## Refine — cuándo usarlo (aplicado, no aspiracional)

**Toda pantalla nueva del dashboard que liste/cree/edite/borre un
recurso con contraparte en `lib/refine/dataProvider.ts`** usa
`useTable`/`useForm`/`useCreate`/`useUpdate`/`useDelete` de
`@refinedev/core` — nunca `useState` + `useEffect` + `*Api.list()` a
mano para ese caso. Si el recurso no tiene adaptador todavía, se agrega
en `dataProvider.ts` siguiendo `ResourceAdapter` antes de escribir la
pantalla. Estado real de la migración, qué falta y qué queda afuera a
propósito: `docs/roadmap-migracion-refine.md`.

**Excepción explícita — no van por Refine:** pantallas singleton de
configuración (`mi-negocio`, `empresa`), reportes de solo lectura
(`reportes`), paneles de acciones puntuales sin lista (`admin`), y
cualquier vista que no mapee 1:1 a un recurso con list/create/update/
delete (detalle de una orden con acciones con nombre, cuentas
corrientes). Estas siguen con fetch directo vía `lib/<dominio>/api.ts`.
Un fetch crudo de OTRO recurso solo para llenar un combo/selector dentro
de una pantalla ya migrada tampoco es una excepción que declarar — no es
el recurso que esa pantalla gestiona, no aplica la regla.

**Sub-recursos anidados** (receta/variantes de un producto, horario de
un recurso/servicio, tarifas de un servicio/cliente — viven siempre
dentro del detalle de su padre, nunca como lista independiente) son una
pregunta de diseño del data provider sin resolver, no una excepción
decidida ni una migración pendiente — ver `docs/roadmap-migracion-refine.md`
sección 3. No agregarles un adaptador por tu cuenta sin confirmar antes
la convención de scope.

**Al tocar una pantalla existente que no usa Refine y sí aplica el
criterio de arriba** (recursos, servicios, productos, usuarios,
clientes...), migrarla como parte del mismo cambio — no se acumula
deuda nueva sobre lo que ya está identificado en
`docs/roadmap-migracion-refine.md`.
