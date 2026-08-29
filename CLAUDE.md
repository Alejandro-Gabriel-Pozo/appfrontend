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

**Las tipografías se cargan una sola vez, en `dashboard/layout.tsx`.** Una
pantalla nueva del dashboard que use la clase `.zulu` NO necesita volver a
importar `Space_Grotesk`/`IBM_Plex_Sans`/`IBM_Plex_Mono` — las variables
`--font-zulu-display` / `--font-zulu-sans` / `--font-zulu-mono` ya
cascadean desde el layout.

*(Este párrafo decía `.bastion` y `Fraunces` hasta el 28/08/2026. Las dos
cosas eran falsas desde la migración del 23/08: ningún `.tsx` usa
`.bastion` — 0 ocurrencias — y la display es Space Grotesk. Ver la sección
"Sistema de diseño" más abajo.)*

## Sistema de diseño — ZULU Hub (normativo; el código todavía no lo refleja)

**Fuente de verdad:** `docs/sistema-diseno-zulu-hub.md`.
**Boceto de referencia:** `docs/zulu-hub-sketch.html` (se abre con doble click).
**Corriente de trabajo:** Fases V1–V7, en
`app-main/docs/plan-separacion-dominios-multirubro-2026-08-28.md` §16.

Esta sección existe porque hay una brecha declarada entre lo que el código
hace hoy y lo que el sistema manda. **Leer el spec antes de tocar color,
tipografía o un componente compartido** — no alcanza con mirar cómo lo hace
la pantalla de al lado.

### Lo que rige hoy en el código (legado, se reemplaza en la Fase V2)

El bloque `.zulu` de `src/app/globals.css` es **navy `#060a1f` + cian neón
`#00e0ff`**, con un acento primario único y sin color por módulo. Sigue
siendo lo que se ve en pantalla y no se toca fuera de la Fase V2.

### Lo que manda el sistema nuevo

Base **blanco / blanco cálido / negro / grafito**; **brass** para reservas y
recursos; **clay** para comercio y POS; **sage** para estados positivos;
**cian restringido al plano técnico**. Hexes y contrastes medidos: spec §4.

**No es una extensión del sistema actual: es un reemplazo del token layer**,
y da vuelta la polaridad de oscuro a claro. Revierte deliberadamente la guía
del 23/08/2026 que está escrita en `globals.css:645-656` (decisión del dueño,
28/08/2026, registrada en el spec §1). Tampoco es "volver a Bastión": los
hexes son distintos (brass `#B8892E` acá vs `#B8935F` en Bastión).

### Reglas que ya rigen para código nuevo, antes de la Fase V2

1. **Cero hexadecimales en `.tsx`/`.ts`.** Si falta un token, se agrega al
   sistema, no un `#RRGGBB` en la página. Hoy hay 21 en 10 archivos: es
   deuda registrada, no un precedente.
2. **Cero clases Tailwind de color crudas** (`bg-slate-800`, `text-emerald-400`).
   Medido el 29/08/2026 (V2.6.1): hay **93**, y **no** están concentradas en
   `app/superadmin/*` — ahí vive el 31% (29). El 69% restante está repartido:
   `styles.css` 24, `app/admin` 11, `ApiSection.tsx` 10, `ResourceLockPicker`
   y `UpgradePrompt` 6 cada uno, `ToastContext.tsx` 4. *(Este punto decía "69,
   concentradas en `app/superadmin/*`" y las dos mitades eran falsas. Contarlas
   de nuevo antes de citar el número.)*
   Dos consecuencias que importan más que el número: `ToastContext.tsx` es el
   toast que usa toda la app y pinta con `bg-emerald-600`/`bg-amber-600`, fuera
   del sistema de tokens y por debajo de AA (3.77 / 3.19). Y `src/styles.css`
   **no lo importa nadie** — es un sistema de diseño oscuro entero, muerto, que
   redefine `.card`, `.input`, `.btn-primary` y `.badge-*` con otros valores.
3. **Color nunca como única señal de estado.** Todo estado lleva label y
   punto o icono, además del color.
4. **No reasignar `.btn-mini-clay` / `.btn-mini-sage` sin revisar sus call
   sites.** Hoy apuntan a `var(--danger)` (ROJO) y `var(--success)` —
   repintarlos al clay/sage reales convertiría botones "Eliminar" en botones
   de contexto comercio. Es el caso concreto del criterio 15 del spec: un
   cambio de token no puede cambiar la semántica en silencio.
5. **El texto de color es siempre el token `*-strong`**; sobre cualquier
   superficie `*-soft` el texto es `--zulu-black`. Sale de medir contraste,
   no de gusto (spec §4.3/§4.4).

### Qué NO hacer todavía

No migrar pantallas al sistema nuevo de a una. El orden es tokens y
primitives (V2) → shell (V3) → pantallas (V4+). Repintar una pantalla suelta
antes de eso deja el producto con dos sistemas conviviendo, que es
exactamente lo que esta corriente viene a terminar.

---

## Interacción — modal, panel o ruta dedicada (convención aplicada, no aspiracional)

Estado real después de `docs/auditoria-modales.md` (auditoría UX,
25/08/2026 — segunda opinión externa traída por el dueño, verificada
contra el código real): el dashboard dependía demasiado de `<Modal>` para
un ERP — 12 archivos lo usaban, incluyendo entidades con perfiles extensos
(Clientes, Usuarios, Reservas, Estadías) comprimidas en un overlay de
`max-w-md` sin URL propia, breadcrumbs, ni guardia de cambios sin guardar.
El detalle completo — inventario, evidencia por dominio, orden de
migración — vive en ese documento; acá solo la regla que un cambio nuevo
tiene que respetar.

**Tres niveles de interacción, elegí según el caso:**
1. **Modal breve** — confirmaciones, alta mínima (2-4 campos), acciones
   reversibles de una sola intención. Ejemplo vigente: "Nuevo cliente" en
   `dashboard/clientes/page.tsx`.
2. **Panel lateral o sheet** — inspección rápida desde una tabla, cuando
   el contenido es acotado y no necesita navegación profunda. Sin caso
   migrado todavía en el repo — no uses `<Modal>` por default para esto,
   evaluar un sheet antes.
3. **Ruta dedicada `/dashboard/{entidad}/[id]`** — detalle, edición
   extensa, historial, relaciones, flujos de varios pasos. Página única
   con secciones editables in-place (cards con su propio form + botón
   "Guardar"), **sin ruta `/edit` separada** — patrón ya usado en
   `ordenes/[id]/page.tsx` y `clientes/[id]/page.tsx` (breadcrumb
   "← {Entidad}", estados `loading`/`notFound`, cards con
   `.detail-card-header`/`.detail-card-body`). Seguí ese patrón para toda
   entidad nueva, no inventes uno distinto.

**Antes de agregar o extender un `<Modal>` que edite una entidad con más
de ~4 campos, relaciones (tags, tarifas, sub-recursos) o historial** — no
lo hagas. Migrala a ruta dedicada con el patrón de arriba, como parte del
mismo cambio.

**Backlog de migración pendiente** (orden sugerido por la auditoría, ver
`docs/auditoria-modales.md` para el motivo de cada una): Usuarios,
Reservas, Estadías, Recursos, Housekeeping, Productos (falta la página
base `[id]/page.tsx` — hoy solo tiene `receta/` y `variantes/` adentro),
Turnos.

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
