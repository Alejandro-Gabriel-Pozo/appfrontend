# Auditoría UX — Modales, detalle y edición

> Documento vivo. Segunda opinión externa traída por el dueño (analista de
> UX, no generada en este repo), verificada contra el código real antes de
> actuar. Fuente de verdad de la regla de interacción declarada en
> `CLAUDE.md` (raíz de `appfrontend-main`), sección "Interacción — modal,
> panel o ruta dedicada". Actualizar la sección "Estado de la migración"
> al final cada vez que una entidad se mueva de modal a ruta dedicada.

Última actualización: 2026-08-25.

## Conclusión ejecutiva

El frontend depende **demasiado de modales para un ERP**, especialmente en
entidades con datos críticos, perfiles extensos y flujos de operación con
varios estados. El repositorio no aplicaba de forma consistente la
estrategia de **ruta o pantalla dedicada para detalle y edición**.

La situación no era absoluta. El repo ya tenía una excepción correcta para
órdenes: `/dashboard/ordenes/[id]`. También existían rutas específicas
para subflujos de productos: `/dashboard/productos/[id]/receta` y
`/dashboard/productos/[id]/variantes`. Eso demuestra que la arquitectura
puede soportar navegación profunda, pero todavía no se usaba como patrón
para las entidades principales del ERP.

## Inventario objetivo (25/08/2026, verificado contra el repo)

| Patrón | Ocurrencias aproximadas | Lectura UX |
|---|---:|---|
| Uso de `<Modal>` | 12 archivos en `dashboard/` | Alta dependencia de overlays para alta, edición y detalle. |
| Uso de `<ConfirmDialog>` | 8 | Acciones críticas resueltas como confirmaciones superpuestas. |
| Overlays inline con `fixed inset-0 z-50` | 15 | Varias pantallas implementan modales manualmente además del componente compartido. |
| Formularios en pantallas del dashboard | 30+ | La lógica de edición está distribuida dentro de listados y overlays. |

El patrón dominante era **listado → modal**, no **listado → detalle →
edición**.

## Evidencia por dominio

| Dominio | Situación (25/08/2026) | Evaluación ERP |
|---|---|---|
| **Clientes** | ✅ Migrado a `/dashboard/clientes/[id]` (ver "Estado de la migración"). | Era el caso más crítico — perfil, fiscalidad, etiquetas y tarifas ya no viven en un modal de `max-w-md`. |
| **Usuarios** | ✅ Migrado a `/dashboard/usuarios/[id]` (ver "Estado de la migración"). | Era crítico — identidad, permisos y contraseña/reset ya no viven en el mismo modal que el alta. |
| **Recursos** | ✅ Migrado a `/dashboard/recursos/[id]` (ver "Estado de la migración"). | Era alto — horario propio y borrado ya tienen sección/URL propia. |
| **Reservas** | ✅ Migrado a `/dashboard/reservas/[id]` (ver "Estado de la migración"). Alta ("Nueva reserva") se queda en modal. | Era crítico — trazabilidad, estado, ajuste de precio y facturación ya tienen URL propia. |
| **Estadías** | ✅ Migrado a `/dashboard/estadias/[id]` (ver "Estado de la migración"). Check-in se queda en modal. | Era crítico operativo — folio, transferencia y no-show ya tienen URL propia, folio visible sin click extra. |
| **Housekeeping** | ✅ Migrado a `/dashboard/housekeeping/[id]` (ver "Estado de la migración"). El rack se queda como entrada operativa — la propia auditoría lo marcaba como patrón correcto. | Era alto — la ficha de cada recurso ya tiene URL propia (`id` = recurso, `date` en query string). |
| **Productos** | ✅ Migrado a `/dashboard/productos/[id]` (ver "Estado de la migración") — ya existía la carpeta con `receta/`/`variantes/` adentro, faltaba el `page.tsx` base. | Era medio-alto — ya hay página canónica que enlaza a las dos subrutas. |
| **Órdenes** | Existe `/dashboard/ordenes/[id]` con detalle dedicado. Las acciones de estado usan `ConfirmDialog`. | **Mejor patrón ya existente** — tomado como referencia para la migración de Clientes. |
| **Turnos** | ✅ Migrado a `/dashboard/turnos/[id]` (ver "Estado de la migración"). | Era alto — mismo patrón que Reservas, ya con URL propia. |
| **Categorías, roles y motivos de merma** | Formularios y confirmaciones en overlays inline. | **Aceptable solo para CRUD corto.** Pueden permanecer en modal mientras el formulario siga siendo pequeño y sin historial ni relaciones complejas. |

## El componente Modal confirma el problema estructural

`src/components/Modal.tsx` define un panel con ancho máximo de `max-w-md`
por defecto, altura máxima de `90dvh` y scroll interno. Se cierra con
`Escape` y al hacer click sobre el backdrop. No hay capa de cambios no
guardados, navegación interna, breadcrumbs, tabs persistentes ni URL
asociada.

> El problema no es que exista un componente modal. El problema es usarlo
> como contenedor principal de edición para entidades que requieren
> memoria, trazabilidad, relaciones y múltiples pasos.

## Modelo de interacción recomendado (regla aplicada — ver CLAUDE.md)

1. **Modal breve** — confirmaciones, acciones reversibles, alta mínima
   (2-4 campos) y decisiones de una sola intención.
2. **Panel lateral o sheet** — inspección rápida de una entidad desde una
   tabla, cuando el contenido es acotado y no requiere navegación
   profunda. (Sin caso migrado todavía en el repo.)
3. **Ruta dedicada** — detalle, edición extensa, historial, relaciones,
   facturación, permisos y flujos de varios pasos.

Patrón para entidades complejas: `Listado → /dashboard/{entidad}/{id}`,
página única con secciones editables in-place (cards con su propio form +
botón "Guardar"), **sin ruta `/edit` separada** — decisión tomada al
migrar Clientes, siguiendo el patrón ya establecido en `ordenes/[id]`
(más simple que el `[id]` + `[id]/edit` de la propuesta original, y ya
probado en este repo).

## Orden de migración sugerido

| Prioridad | Ruta propuesta | Motivo | Estado |
|---:|---|---|---|
| 1 | `/dashboard/clientes/[id]` | Modal más extenso: perfil, fiscalidad, etiquetas, tarifas. | ✅ Migrado (25/08/2026) |
| 2 | `/dashboard/usuarios/[id]` | Identidad, permisos, seguridad e invitaciones. | ✅ Migrado (25/08/2026) |
| 3 | `/dashboard/reservas/[id]` | Trazabilidad, estado, fechas, huésped, cobros. | ✅ Migrado (25/08/2026) |
| 4 | `/dashboard/estadias/[id]` | Check-in/out, folio, saldo y housekeeping. | ✅ Migrado (25/08/2026) |
| 5 | `/dashboard/recursos/[id]` | Horarios, categoría, precio y disponibilidad. | ✅ Migrado (25/08/2026) |
| 6 | `/dashboard/housekeeping/[id]` | Historial de tarea, responsable, estado y excepciones. | ✅ Migrado (25/08/2026) |
| 7 | `/dashboard/productos/[id]` | Página base que englobe receta, variantes, stock y acciones. | ✅ Migrado (25/08/2026) |
| 8 | `/dashboard/turnos/[id]` | Simetría con reservas para servicios puntuales. | ✅ Migrado (25/08/2026) |

## Estado de la migración

- **Clientes — ✅ RESUELTO (25/08/2026).** `dashboard/clientes/[id]/page.tsx`
  nuevo (perfil básico, etiquetas, datos fiscales, tarifas especiales,
  cada sección en su propia card). `dashboard/clientes/page.tsx` recortado
  a solo listar/crear, con navegación a la ruta de detalle. Verificado con
  `tsc`/`eslint` y en navegador contra `biz-demo-01` (alta y baja real de
  una etiqueta de prueba). Ver `app-main/docs/pendientes-2026-08-25.md`
  para el detalle completo de la sesión.
- **Usuarios — ✅ RESUELTO (25/08/2026).** `dashboard/usuarios/[id]/page.tsx`
  nuevo — sin `GET /api/users/:id` en el backend, reusa el mismo criterio
  que el adapter `usuarios` de `lib/refine/dataProvider.ts`
  (`usersApi.list()` + find por id). Card "Información" (perfil + rol +
  contraseña/reset link, con el guard de jerarquía K1 ya existente) y card
  "Acceso" (desactivar, solo visible para el propietario y nunca para
  OWNER). `dashboard/usuarios/page.tsx` recortado: el modal "Nuevo
  usuario" queda intacto (alta con todos los campos — no se redujo a "modal
  breve" porque cambiar qué campos pide el alta es una decisión de
  producto aparte, no una migración de UI), y la tabla navega a la ruta de
  detalle en vez de abrir el modal de edición. Invitaciones (lista +
  modal) se quedaron en el listado — no son una membership todavía, no
  tienen detalle propio. Verificado con `tsc`/`eslint` y en navegador
  contra `biz-demo-01`: edición real de nombre completo (persistió,
  reflejado en el listado), diálogo de "Desactivar usuario" abre
  correctamente (cancelado a propósito, sin confirmar — hubiera
  desactivado una cuenta real sin forma de reactivarla desde la UI
  todavía), y "Usuario no encontrado" para un id inexistente.
- **Reservas — ✅ RESUELTO (25/08/2026).** `dashboard/reservas/[id]/page.tsx`
  nuevo — usa `reservationsApi.get(id)` (GET real, ya existía). Una sola
  card "Detalle de reserva" que alterna entre vista y edición
  (`editingDetail`, mismo patrón de `ordenes/[id]::editingNotes`) en vez
  de separarse en cards siempre-visibles: la entidad no se presta a eso,
  el modal original ya era una sola vista con un toggle, no varias
  secciones independientes. Mantiene estado, huéspedes, notas, horario
  especial (pedir/aprobar/rechazar), botón "Facturar" (`FacturarButton`)
  y el preview de ajuste de precio con confirmación gateada a MANAGEMENT.
  `dashboard/reservas/page.tsx` recortado: se sacó todo el estado/lógica
  del modal de detalle (~190 líneas de handlers). El drag-to-move del
  calendario (`handleCalendarUpdate`) se simplificó — ya no necesita
  chequear si el detalle de esa reserva estaba abierto para refrescar el
  ajuste de precio, porque el detalle no vive más en esta misma página.
  Fila de la tabla y click en el calendario (`onReservationClick`) navegan
  a la ruta en vez de abrir el modal. "Nueva reserva" se queda en modal,
  sin tocar (mismo criterio que Clientes/Usuarios: no se achica el alta a
  "modal breve" como parte de esta migración).
  **`hooks/useReservationsScreen.ts` no se tocó** — es compartido con
  Turnos y ya declaraba explícitamente que el detalle no es su
  responsabilidad.
  Verificado con `tsc`/`eslint` y en navegador contra `biz-demo-01`: una
  reserva de prueba creada por API (PENDING) → confirmada desde la ruta de
  detalle (pasa a CONFIRMED, aparecen los botones nuevos) → editado el
  check-out (persistió, "Facturar" aparece porque ya había un CHARGE del
  confirm) → cancelada al final (datos de prueba, sin dejar nada activo).
  También: `/dashboard/reservas/<id inexistente>` → "Reserva no
  encontrada" (código real `NOT_FOUND` del backend), y el click de una
  barra del calendario navega a la ruta de detalle igual que una fila de
  la tabla.
- **Estadías — ✅ RESUELTO (25/08/2026).** `dashboard/estadias/[id]/page.tsx`
  nuevo — sin `GET /api/stays/:id`, reusa `staysApi.listActive()` + find
  por id (mismo criterio que el adapter `estadias` de `dataProvider.ts`;
  una estadía ya cerrada no aparece, mismo alcance que ya tenía el
  listado). 3 cards: "Detalle" (check-in, habitación, notas), "Check-out"
  (folio cargado automáticamente al entrar a la página, no al hacer click
  — la razón de fondo del hallazgo: la decisión de hacer check-out
  depende de ver el saldo primero) con transferencia a cuenta por cobrar
  inline, y "No show" con `ConfirmDialog`. Check-out/no-show navegan de
  vuelta al listado al confirmar (la estadía deja de estar activa, no hay
  nada más que mostrar en esa URL). `dashboard/estadias/page.tsx`
  recortado a listar + "Nuevo check-in" (se queda en modal). Reemplazado
  el modal de confirmación de no-show hecho a mano por `ConfirmDialog` —
  el comentario que decía "no ConfirmDialog: colores hardcodeados fuera de
  Bastión" está desactualizado, el componente ya usa las variables CSS de
  Zulu (mismo que ya se usó sin problema en Clientes/Usuarios).
  Verificado con `tsc`/`eslint` y en navegador contra `biz-demo-01`: la
  única estadía activa real de la demo carga folio ($0, sin saldo) y las
  3 cards correctas; el diálogo de "No show" abre bien — cancelado sin
  confirmar (es un huésped real en check-in, no un dato de prueba
  descartable). `/dashboard/estadias/<id inexistente>` → "Estadía no
  encontrada".
- **Recursos — ✅ RESUELTO (25/08/2026).** `dashboard/recursos/[id]/page.tsx`
  nuevo — mismo criterio de list+find que el adapter `recursos`. Card
  "Información" (nombre, categoría, precio base colapsado), card "Horario
  propio" (franjas + alta/baja) y card "Eliminar" con `ConfirmDialog`
  (reemplaza el overlay de borrado hecho a mano). `dashboard/recursos/page.tsx`
  recortado a listar + "Nuevo recurso" (modal, sin la sección de horario
  propio que solo aplicaba a edición). Verificado con `tsc`/`eslint` y en
  navegador contra `biz-demo-01`: agregada y quitada una franja horaria de
  prueba en Habitación 02 (persistió en ambos sentidos), "Recurso no
  encontrado" para id inexistente.
- **Housekeeping — ✅ RESUELTO (25/08/2026).** Caso distinto a los
  anteriores: la ficha del rack se abría por RECURSO, no por tarea (una
  tarea es "recurso + fecha", puede no existir ese día) — `id` en
  `dashboard/housekeeping/[id]/page.tsx` es el id del recurso, `date`
  viaja por query string (`?date=YYYY-MM-DD`, leído una sola vez de
  `window.location.search` al montar, mismo criterio ya usado en
  `portal/[businessSlug]/cuenta/reservas/page.tsx` para no arrastrar el
  requisito de `<Suspense>` de `useSearchParams()`). 2 cards:
  "Mantenimiento" (ventana activa + reactivar, o alta inline si no hay) y
  "Tarea — {fecha}" (estado + asignar/iniciar/completar/inspeccionar
  inline, o alta inline "Planificar tarea para {recurso}" si no hay
  tarea ese día). El rack de `dashboard/housekeeping/page.tsx` no se
  tocó como entrada — la propia auditoría ya lo marcaba como patrón
  correcto ("apropiado como entrada operativa") —, solo el tile ahora
  navega en vez de abrir modal. **"Mis tareas" no migró** — no es un
  detalle de un recurso, es la lista de trabajo del housekeeper logueado
  cruzando recursos/fechas distintas; se quedó con su propio mini-modal
  de asignar/completar (mismo componente, alcance recortado — ya no
  incluye la rama de ventana de mantenimiento, que ahora es exclusiva de
  la ficha de detalle).
  Verificado con `tsc`/`eslint` y en navegador contra `biz-demo-01`: click
  en una ficha del rack navega a `/dashboard/housekeeping/<id>?date=...`
  con la fecha correcta ya cargada, cards de Mantenimiento y Tarea
  renderizando el estado real (INSPECTED, sin ventana activa).
- **Productos — ✅ RESUELTO (25/08/2026).** Primera página canónica real
  del producto (`dashboard/productos/[id]/page.tsx`) — antes solo existían
  las subrutas `receta/` y `variantes/`, sin base. `productsApi.get(id)`
  (GET real). 3 cards: "Información" (el form completo de "Editar
  producto", movido tal cual del modal), "Empresa" (compartir con la
  empresa, o el manejo completo de override de precio/receta si ya está
  vinculado — antes un modal aparte, `CompanyLinkModal`) y "Eliminar" con
  `ConfirmDialog` (antes un `confirm()` de navegador liso). El
  encabezado linkea a `/receta` y `/variantes` cuando aplican — la pieza
  que le faltaba a la arquitectura de subrutas ya buena, según la propia
  auditoría. `dashboard/productos/page.tsx` recortado: "Nuevo producto"
  se queda en modal (alta, mismo criterio de todas las fases), "Merma" y
  "Producción" también se quedan como modales en la lista — 2-3 campos,
  no necesitan el contexto completo del producto (el stock actual ya se
  muestra dentro del modal mismo). La fila navega a la ruta de detalle;
  el "●" de revisión pendiente de vínculo se movió de un botón propio a
  un indicador junto al badge de estado.
  Verificado con `tsc`/`eslint` y en navegador contra `biz-demo-01`:
  producto de prueba creado → cambiado a tipo Compuesto en el detalle
  (apareció "Armar en vivo al vender" y el link "Ver receta →" en el
  encabezado, ambos condicionales) → eliminado con `ConfirmDialog` →
  vuelta automática al listado. "Producto no encontrado" para un id
  inexistente.
- **Turnos — ✅ RESUELTO (25/08/2026).** Última entidad del backlog.
  `dashboard/turnos/[id]/page.tsx` — clon deliberado de
  `dashboard/reservas/[id]/page.tsx` (mismo criterio que la lista: Turnos
  ya era un clon de Reservas con el filtro de categoría invertido),
  recortado a lo que Turnos de verdad tiene: sin calendario, sin ajuste
  de precio, sin facturación, sin horario especial (todo eso es
  específico de alojamiento). Una sola card "Detalle de turno" con
  toggle vista/edición. `dashboard/turnos/page.tsx` recortado: se sacó
  el estado/handlers del modal de detalle, la fila navega a la ruta.
  "Nuevo turno" se queda en modal.
  Verificado con `tsc`/`eslint` y en navegador contra `biz-demo-01`: un
  turno real (Completada) muestra las 4 secciones de datos sin botones de
  acción (correcto, estado terminal); "Turno no encontrado" para un id
  inexistente.

**Backlog de la auditoría completo — las 8 entidades migradas
(25/08/2026): Clientes, Usuarios, Reservas, Estadías, Recursos,
Housekeeping, Productos, Turnos.** Quedan sin decidir/hacer, fuera del
alcance de esta migración de UI: el nivel intermedio "panel lateral o
sheet" (nunca se usó — cada caso terminó siendo modal breve o ruta
dedicada, ninguno pidió ese punto medio) y la reactivación de F2
(`POST /users/:id/reactivate`) sin pantalla, mencionada de paso durante
Usuarios.
