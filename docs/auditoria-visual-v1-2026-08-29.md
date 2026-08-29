# Auditoría visual — Fase V1

- **Fecha:** 2026-08-29
- **Fase:** V1 de la corriente visual (`sistema-diseno-zulu-hub.md` §13).
- **Regla de esta fase:** **auditar y documentar. No se tocó ni un token, ni una primitive,
  ni una pantalla.** Cero cambios en `globals.css`, `.tsx` o `tailwind.config.ts`.
- **Entregable:** este documento — matriz de uso → token destino, inventario de deuda y
  orden de migración.
- **Estado de la corriente:** **1 de 7 fases.** Nada migrado.

---

## 0. Lo que hay que saber antes de leer el resto

**`--accent` no es un token de acento. Son siete trabajos distintos con un solo nombre**, y
solo dos de ellos son "color de contexto de módulo".

Esto invalida el atajo obvio de V2 —"apuntar `--accent` a brass y seguir"—: eso pintaría de
brass los focus rings, los checkboxes, todos los hipervínculos, el badge "Activo", los
toasts informativos y el riel de estado del sistema. **`--accent` hay que partirlo antes de
repintarlo.**

Y apareció una deuda que ninguna medición previa había contado: **24 usos de
`rgba(255,255,255,α)`** — blanco translúcido para hovers, bordes y superficies. Funciona
sobre navy; sobre blanco **es invisible**. La inversión de polaridad no es cambiar valores de
tokens: es reescribir cada una de esas 24 reglas. Ver §5.

---

## 1. Los 53 usos de `var(--accent*)` en `.tsx`, clasificados

Clasificados **por rol**, no por pantalla — que es el eje que decide a qué token va cada uno.

| # | Rol | Usos | Token destino | Por qué |
|---|---|---:|---|---|
| A | **Control de formulario nativo** (`accentColor` de checkbox / radio / range) | **17** | `--zulu-black` o un `--control-accent` neutro | Es cromo de formulario, no señal de contexto. Un checkbox no pertenece a reservas ni a comercio |
| B | **Hipervínculo** (`color:` en `<Link>`) | **18** | `--zulu-link` **(token nuevo, no existe)** | Ni brass ni clay: un link a "Registrate" no tiene contexto de módulo. Necesita su propio token, con contraste AA propio |
| C | **Navegación activa del sidebar** | **7** | **contexto del módulo** (brass / clay / sage / neutral) | ✅ El único lugar donde el color de vertical corresponde de verdad |
| D | **Toggle / tab activo** (Reservas, Turnos) | **2** | contexto del módulo | Mismo criterio que C |
| E | **Fila seleccionada / "hoy"** (Cuentas Corrientes, RoomCalendar) | **2** | `*-soft` del contexto | Es superficie, no texto: aplica la regla del negro encima |
| F | **Estado semántico mal expresado** | **3** | **sage / brass según el estado** | Ver §1.1 — acá el color está diciendo algo que no es "acento" |
| G | **Plano técnico** (ApiBlock, TelemetryCard) | **3** | `--zulu-cyan-deep` sobre claro, `--zulu-cyan-technical` sobre oscuro | Es exactamente el plano que la especificación reserva para cian |
| H | **Foco de input** (`.input-sm:focus` inline en Órdenes) | **1** | token de foco neutro | Accesibilidad, no branding |

**Solo 9 de 53 (17 %) son contexto de módulo.** Los otros 44 son cromo, links, estados o
plano técnico que hoy comparten variable por accidente histórico, no por diseño.

### 1.1 Los tres usos del grupo F, que son bugs de semántica, no de color

| Dónde | Qué hace hoy | Qué está diciendo en realidad |
|---|---|---|
| `productos/[id]/variantes/page.tsx` | `priceOverride !== null ? var(--accent) : var(--success)` | "precio propio" vs "hereda del padre". Son dos **estados**, no un acento contra un éxito |
| `dashboard/page.tsx` | `color: var(--accent)` sobre una métrica | Destacado de métrica → tipografía/peso, no color de marca |
| `reportes/page.tsx` | valor del threshold en accent | Valor numérico activo → mono + peso, o contexto |

Repintar estos tres a brass conserva el bug: seguirían usando "el color de la marca" para
expresar un estado. **V2 tiene que decidir el estado, no el color.**

## 2. Los 20 usos de `var(--accent*)` dentro de `globals.css`

Son los que importan más, porque están en las **primitives**: repintarlos cambia todas las
pantallas a la vez.

| Selector | Rol | Token destino |
|---|---|---|
| `:focus-visible` | Anillo de foco global | **Neutro de alto contraste.** Nunca un color de módulo: el foco tiene que verse igual en todas las pantallas (criterio 12) |
| `::selection` | Selección de texto | Neutro |
| `.zulu-mark` | Marca | `--zulu-black` |
| `.sidebar-link.active` (×3) + `.icon` | Nav activo | **contexto del módulo** ✅ |
| `.quick-link-icon` (×2) | Acceso rápido | contexto del módulo |
| `.btn-primary` (×3, incluye hover) | Botón primario | **contexto del módulo** ✅ |
| `.input:focus` (×2) | Foco de campo | Neutro |
| `.badge-active` | Badge "Activo" | **`sage`** — "activo" es un estado positivo, no un acento |
| `.toast.info` (×2) | Toast informativo | Neutro o `cyan-deep` |
| `.system-rail-healthy` / `-syncing` | Riel de estado técnico | `healthy` → **sage**; `syncing` → `cyan-deep` |

**Hallazgo:** `.zulu .btn-primary:hover` tiene `rgba(0, 224, 255, 0.32)` **hardcodeado** — el
cian del sistema viejo incrustado en un glow, fuera del sistema de tokens. Sobrevive a
cualquier cambio de `--accent`.

## 3. Colores hardcodeados en `.ts` / `.tsx`

**19 reales** (la medición previa decía 21: dos eran falsos positivos — `"Ej: OC #123"` y
`"referencia #123"` en placeholders).

| Dónde | Qué | Criticidad |
|---|---|---|
| `dashboard/layout.tsx` — banner de dead-letter del outbox (7 valores: `#fca5a5`, `#9ca3af`, `#e2e4ea`, `#6b7280`, `#7f1d1d`, `#dc2626`, `#fff`) | Una alerta entera pintada a mano, fuera del sistema | 🔴 Es la alerta de que algo falló en producción — tiene que ser el `danger` real |
| `dashboard/layout.tsx:359-360` — splash de carga: `#060a1f` + `#00e0ff` | **Los dos colores del sistema viejo, hardcodeados** | 🔴 Sobreviven al cambio de tokens: la pantalla de carga seguiría siendo navy+cian |
| `Modal.tsx`, `ConfirmDialog.tsx`, `RoomCalendar.tsx` — fallbacks `var(--x, #1a1d27)`, `#cbd5e1`, `#fff`, `#94a3b8` | **Fallbacks de tema oscuro dentro de primitives** | 🔴 Trampa silenciosa: si el token no resuelve, renderiza oscuro sobre claro y nadie lo ve venir |
| `ResourceLockPicker.tsx` — `accentColor: '#10b981'` | Verde suelto | 🟡 |
| `reservas`/`turnos` — `#fff` en toggle activo | Texto sobre acento | 🟡 Depende del token que quede debajo |
| `superadmin/layout.tsx` — `#94a3b8` | Gris de nav | 🟡 |

## 4. Las 69 clases Tailwind de color crudas

| Archivo | Usos |
|---|---:|
| `app/superadmin/page.tsx` | 21 |
| `app/admin/page.tsx` | 11 |
| `components/ApiSection.tsx` | 10 |
| `components/UpgradePrompt.tsx` | 6 |
| `components/ResourceLockPicker.tsx` | 6 |
| `app/superadmin/planes/page.tsx` | 6 |
| `context/ToastContext.tsx` | 4 |
| `app/superadmin/roles-de-fabrica/page.tsx` | 2 |
| `app/dashboard/admin/page.tsx` | 2 |
| `components/ApiBlock.tsx` | 1 |

Familias: `text-slate` (27), `text/bg/border-red` (12), `emerald` (13), `amber`/`yellow` (13),
`bg-slate` (3).

**Dos lecturas:**

1. **51 de 69 (74 %) están en Superadmin y las pantallas técnicas** (`superadmin/*`,
   `admin`, `ApiSection`, `ApiBlock`) — coherente con que Superadmin nunca se migró. Se
   resuelven en **V5(a)**.
2. **Las 18 restantes están en primitives compartidas** (`UpgradePrompt`,
   `ResourceLockPicker`, `ToastContext`) y pesan más que su número: las usan pantallas de
   todos los módulos. Van en **V2**, no en V5.

## 5. 🔴 Hallazgo nuevo: 24 supuestos de fondo oscuro

Ninguna medición previa lo había contado. `rgba(255,255,255,α)` — blanco translúcido — se usa
para hovers, bordes, superficies y scrollbars:

| Dónde | Usos |
|---|---:|
| `app/globals.css` | 8 |
| `dashboard/layout.tsx` | 4 |
| `dashboard/ordenes/[id]/page.tsx` | 4 |
| `superadmin/layout.tsx`, `Modal.tsx`, `RatePlanManager.tsx`, `ScheduleManager.tsx` | 2 c/u |
| **Total** | **24** |

Blanco al 4 % sobre navy da un gris apenas más claro: funciona. Blanco al 4 % **sobre blanco
no existe**. Cada uno de estos 24 es un hover, un borde o una superficie que **desaparece** al
invertir la polaridad — no se rompe ruidosamente, se vuelve invisible.

`globals.css` tiene además **79 literales de color en total** y **3 hex crudos dentro de
reglas** (`#fff`, `#0a0c10`, `#7d8799`), fuera del bloque de tokens.

**Consecuencia para V2:** el trabajo no es "cambiar los valores de los tokens". Es partir
`--accent` en seis, reescribir 24 reglas de translucidez, sacar 19 hex de `.tsx` y 3 de
`globals.css`, y eliminar los fallbacks de tema oscuro de las primitives. El cambio de
paleta es la parte fácil.

## 6. Alias con nombre engañoso

| Alias | Apunta hoy a | Problema |
|---|---|---|
| `.btn-mini-clay` | `var(--danger)` — **rojo** | Con el sistema nuevo, `clay` es comercio. Repintarlo convierte los botones **"Eliminar"** en botones de contexto POS. Criterio 15 de la especificación |
| `.btn-mini-sage` | `var(--success)` — verde | Menos grave (sage ≈ positivo), pero el nombre promete un token que no existe |
| `.badge-active` | `var(--accent-dim)` | "Activo" es sage, no acento |
| `.toast.info` | `var(--accent)` | Informativo no es contexto de módulo |
| `.system-rail-healthy` | `var(--accent)` | "Healthy" es sage |
| `.bastion` | — | Clase muerta: **0 usos en `.tsx`**. Borrar |

**Antes de reasignar cualquiera de estos hay que revisar sus call sites**, uno por uno. Es la
única parte de V2 que puede cambiar comportamiento percibido sin cambiar una línea de lógica.

## 7. Tokens nuevos que las primitives necesitan y hoy no existen

Además de los de la especificación §4.2:

| Token | Para qué | Por qué no alcanza con los que hay |
|---|---|---|
| `--zulu-link` (+ `-hover`, `-visited`) | Los 18 hipervínculos del grupo B | Ni brass ni clay: un link no tiene contexto de módulo. Necesita contraste AA propio sobre blanco y warm-white |
| `--zulu-focus` | `:focus-visible`, `.input:focus` | El foco debe ser idéntico en todas las pantallas; si toma el color del módulo, cambia de pantalla en pantalla |
| `--zulu-control-accent` | Los 17 `accentColor` nativos | Cromo de formulario |
| `--zulu-overlay-hover` / `--zulu-overlay-surface` | Los 24 `rgba(255,255,255,α)` | Un token que sepa de qué lado está el fondo, en vez de asumir oscuro |
| `--zulu-danger-*` | Banner de dead-letter, `.btn-danger`, `alert-danger` | Confirmado `#B42318`; falta cablearlo |
| `--zulu-info` | `.toast.info`, `.badge-post` | Hoy toma `--accent` o `--info` (azul del sistema viejo) |

## 8. Orden de migración propuesto para V2

Ordenado por **cuánto desbloquea**, no por tamaño:

| Paso | Qué | Por qué primero |
|---|---|---|
| **2.1** | **Partir `--accent` en los 6 tokens de §7**, apuntándolos todos a los valores actuales | Cambio **sin efecto visual**: deja el código expresando qué significa cada uso, con la pantalla idéntica. Es el paso que hace posible todo el resto y el más fácil de revisar |
| **2.2** | Reescribir los 24 `rgba(255,255,255,α)` como tokens de overlay | Sigue sin efecto visual mientras el fondo sea oscuro, pero es lo que permite invertir la polaridad después |
| **2.3** | Sacar los 19 hex de `.tsx` y los 3 de `globals.css`; eliminar los fallbacks de tema oscuro de las primitives | Lo que quedaría fuera del sistema y no se repintaría solo |
| **2.4** | Revisar call sites y reasignar los alias engañosos (§6); borrar `.bastion` | Único paso que puede cambiar semántica: va aislado, con su propia revisión |
| **2.5** | **Recién acá: cambiar los valores de los tokens** a la paleta ZULU Hub e invertir la polaridad | Un solo commit revisable, con todo lo anterior ya en su lugar |
| **2.6** | Corregir los 3 estados mal expresados con color (§1.1) | Decisión de producto, no de color |

**2.1 a 2.4 no cambian ni un pixel.** Toda la diferencia visible ocurre en 2.5, en un cambio
acotado y reversible — en vez de un repintado grande donde no se sabe qué se rompió.

## 9. Lo que esta fase NO hizo

Nada de código. Verificado: `git status` limpio en `appfrontend-main` salvo este archivo.

- ❌ No se tocó `globals.css`, ni `tailwind.config.ts`, ni ninguna pantalla.
- ❌ No se creó ni renombró ningún token.
- ❌ No se reasignó ningún alias.
- ❌ No se migró ninguna pantalla.

## 10. Lo que V1 deja abierto para decidir antes de V2

1. **`--zulu-link`**: hex a elegir, con AA sobre blanco y warm-white. No puede ser brass
   (los links aparecen en pantallas de todos los módulos).
2. **`:focus-visible`**: ¿negro, o un token propio? La especificación pide "focus visible" sin
   fijar color.
3. **Los 3 estados del §1.1**: qué debe comunicar cada uno. Es decisión de producto.
4. **`.toast.info` y `.badge-post`**: ¿neutro o `cyan-deep`? Depende de si un toast informativo
   cuenta como "plano técnico".
