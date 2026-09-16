# Roadmap — migración a Refine

Inventario puntual (22/08/2026) de qué pantallas del dashboard ya usan
`@refinedev/core` (`useTable`/`useForm`/`useCreate`/`useUpdate`/
`useDelete` contra `lib/refine/dataProvider.ts`), cuáles faltan, y cuáles
quedan afuera a propósito. Fuente de verdad al momento de escribir esto —
no se actualiza solo, revisar contra el código si pasó tiempo.

**Alcance: solo `/dashboard` (staff).** El proveedor de Refine (`<Refine
dataProvider={dataProvider}>`) se monta en `src/app/dashboard/layout.tsx`
únicamente. El portal de clientes (`src/app/portal/[businessSlug]/...`)
es una superficie completamente distinta — login, disponibilidad, cuenta
del huésped — sin Refine montado ahí y sin adaptador correspondiente en
`dataProvider.ts`. No entra en este roadmap ni en el criterio de
CLAUDE.md: es una decisión aparte si alguna vez se evalúa.

---

## 1. Ya migrado (11 recursos, 10 pantallas)

Todos con adaptador en `lib/refine/dataProvider.ts` y registrados en
`REFINE_RESOURCES` (`dashboard/layout.tsx`):

| Recurso | Pantalla | Notas |
|---|---|---|
| `categorias` | `dashboard/categorias` | |
| `productos` | `dashboard/productos` | |
| `recursos` | `dashboard/recursos` | |
| `servicios` | `dashboard/servicios` | |
| `usuarios` | `dashboard/usuarios` | Ver sección 2 — roles/invitaciones en la misma pantalla NO están migrados. |
| `clientes` | `dashboard/clientes` | Sin `deleteOne` real (se desactivan) — `notSupported()` correcto a propósito. |
| `reservas` | `dashboard/reservas` + `dashboard/turnos` | Mismo recurso Refine, dos pantallas — ver nota abajo. |
| `estadias` | `dashboard/estadias` | `update`/`deleteOne` no soportados a propósito (check-out/no-show son acciones con nombre). |
| `housekeeping` | `dashboard/housekeeping` | `update`/`deleteOne` no soportados a propósito (assign/start/complete/... son acciones con nombre). |
| `ordenes` | `dashboard/ordenes` | `update`/`deleteOne` no soportados a propósito (confirm/cancel/complete/... son acciones con nombre). |
| `motivos-merma` | `dashboard/motivos-merma` | |

**`reservas`/`turnos` — caso particular, ya migrado, no es una pantalla
suelta sin Refine:** las dos pantallas comparten
`hooks/useReservationsScreen.ts`, que sí llama a `useTable`/`useCreate`/
`useUpdate` contra el recurso `'reservas'` — confirmar/cancelar/completar
son acciones con nombre (`reservationsApi[action]`), mismo patrón que
`ordenes`. Un detalle menor documentado en el propio código (comentario
de `useReservationsScreen.ts`, línea ~49): recursos/servicios/categorías
para armar los combos de recurso/servicio se siguen trayendo con
`resourcesApi.list()`/`bookableServicesApi.list()`/`categoriesApi.list()`
crudo en vez de `useList()` de Refine, aunque los tres YA tienen
adaptador (los usan sus propias pantallas migradas). Es cosmético — no
bloquea nada, se puede limpiar cuando alguien toque ese hook por otra
razón, no amerita una tarea propia.

---

## 2. Falta migrar — recursos reales sin adaptador todavía

- **Roles** (`rolesApi` en `lib/usuarios/api.ts`) — CRUD completo
  (`list`/`get`/`create`/`update`/`remove`) expuesto en `/api/roles`,
  consumido hoy con fetch manual dentro de `dashboard/usuarios/page.tsx`
  (panel de roles en la misma pantalla). Candidato directo: agregar
  `roles` a `dataProvider.ts` (mapeo 1:1, sin acciones con nombre) y
  pasar ese panel a `useTable`/`useForm`.
- **Invitaciones** (`invitationsApi`, mismo archivo) — `list`/`create`/
  `revoke` (DELETE real) + `resend` (acción con nombre, como
  confirm/cancel en otros recursos). Mismo patrón que `ordenes`/
  `estadias`: migrable con `update` marcado `notSupported` y `resend`
  llamado directo, fuera de Refine.

Ninguna de las dos tiene adaptador hoy — antes de escribir la migración,
agregarlas a `resources` en `dataProvider.ts` siguiendo `ResourceAdapter`
(regla ya vigente para pantallas nuevas, ver CLAUDE.md).

---

## 3. Pregunta de diseño sin resolver — sub-recursos anidados (no asumir una respuesta)

Varios "recursos" reales del backend viven siempre DENTRO del detalle de
otro (nunca como una lista independiente propia), y hoy se manejan con
fetch manual scopeado por el id del padre:

| Sub-recurso | API | Dónde vive hoy |
|---|---|---|
| Receta de un producto | `recipeItemsApi` (`list(productId)`, ...) | `productos/[id]/receta/page.tsx` |
| Variantes de un producto | `variantsApi` (`list(productId)`, ...) | `productos/[id]/variantes/page.tsx` |
| Horario propio de un recurso | `resourceHoursApi` (`list(resourceId)`, ...) | panel dentro de `dashboard/recursos/page.tsx` |
| Tarifas de un servicio | `ratePlansApi` (`list(serviceId)`, ...) | `components/RatePlanManager.tsx` |
| Horario de un servicio | `serviceSchedulesApi` (`list(serviceId)`, ...) | `components/ScheduleManager.tsx` |
| Recursos bloqueados por un servicio | `resourceLocksApi` (`list(serviceId)`, ...) | `components/ResourceLockPicker.tsx` |
| Tarifas especiales de un cliente | `customerRatesApi` (`list(customerId)`, ...) | panel dentro de `dashboard/clientes/page.tsx` |

**No están en el inventario de "falta migrar" de la sección 2 porque
migrarlos no es mecánico** — `dataProvider.ts` hoy asume un `resource`
plano (`categorias`, `productos`, ...); estos siete son 1:N respecto de
un padre y necesitarían decidir la convención de scope (¿`meta.parentId`
+ una entrada por sub-recurso en `resources`? ¿un `resource` compuesto
tipo `"productos/:id/receta"`? ¿directamente no entran nunca porque solo
tienen sentido dentro del detalle de su padre?). Es una decisión de
arquitectura del data provider, no una migración de pantalla — no
elegir una opción sin que el dueño la confirme, mismo criterio que
cualquier otra decisión de diseño de este repo.

---

## 4. Afuera a propósito (excepciones confirmadas)

- **`dashboard/mi-negocio`** — singleton de configuración (perfil del
  negocio, horarios estándar, política de seña). No hay lista que
  paginar ni ítems que crear — un solo GET + un solo PUT.
- **`dashboard/empresa`** — pantalla de "empresas" multipropiedad
  (vincular/desvincular, catálogo compartido) — no es CRUD de un recurso
  propio, es una acción de vínculo entre negocios.
- **`dashboard/reportes`** — solo lectura, filtros + gráficos/tablas de
  agregados. Sin create/update/delete de nada.
- **`dashboard/admin`** — retirado (16/09/2026, backend D-06/P-04, Wave 7
  del plan de ejecución integral de `app-main`): existía solo para el
  botón de `repair-tenant-db`, una trampa armada del lado del backend
  (aplicaba schema de tenant contra `DATABASE_URL`, sin declarar en
  Render). `set-tenant-url` nunca tuvo pantalla propia acá.
- **`dashboard` (home)** — resumen/overview (reservas de hoy, ocupación),
  no una pantalla de gestión.
- **`dashboard/ordenes/[id]`** — detalle de UNA orden: confirmar/
  cancelar/completar/agregar-quitar ítem son todas acciones con nombre
  (mismo criterio que la lista, sección 1) — no hay un "editar la orden"
  genérico que mapear a `useForm`.
- **`dashboard/cuentas-corrientes`** — buscar un cliente + ver su
  extracto + registrar un pago. No es CRUD de `clientes` (ya migrado en
  su propia pantalla) ni de una entidad propia — es un flujo de
  consulta/cobro. La búsqueda de clientes *podría* reusar el adaptador
  `clientes` ya existente (`useList` en vez de `customersApi.list()`
  crudo) como prolijidad menor, pero no es un mandato de esta regla — la
  pantalla en conjunto no mapea 1:1 a list/create/update/delete.

---

## 5. No confundir con un gap: fetch crudo de OTRO recurso dentro de una pantalla migrada

Es el patrón más común en el repo y es intencional, no deuda: casi toda
pantalla ya migrada sigue trayendo con `Api.list()` crudo los datos de
OTRO recurso que solo necesita para un combo/selector (ej. `categorias`
dentro de `recursos`/`servicios`, `productos` dentro de `ordenes`,
`clientes` dentro de `estadias`/`ordenes`). Usar `useList()` de Refine
ahí en vez de la función de API directa no aportaría paginación, cache
ni ninguna otra ventaja real para un combo que se llena una vez al
montar la pantalla — cambiarlo sería mecánico sin beneficio. La regla de
CLAUDE.md aplica al recurso PRINCIPAL que la pantalla lista/crea/edita/
borra, no a cada fetch auxiliar que aparece adentro.
