# Sistema de diseño — ZULU Hub

- **Fecha:** 2026-08-28
- **Estado:** especificación aceptada por el dueño. **Sin implementar: 0 de 7 fases
  ejecutadas, ninguna pantalla migrada, ningún token cambiado.** Lo que se ve en
  producción sigue siendo el bloque `.zulu` navy + cian de `globals.css`.
- **Reemplaza a:** `sistema-diseno-bastion.md` (histórico) y **al bloque `.zulu` actual de
  `src/app/globals.css`** (guía del 23/08/2026 — ver §1, conflicto explícito).
- **Corriente de trabajo:** Fases V1–V7, parte del plan activo
  (`app-main/docs/plan-separacion-dominios-multirubro-2026-08-28.md` §16).
- **Etiquetas:** `diseño` `sistema-visual` `convencion`

> **ZULU es monocromático en su estructura y expresivo en sus señales.**
> Blanco y negro son la infraestructura. El color es el significado.

---

## 1. ⚠️ Esto revierte la decisión visual del 23/08/2026

**Antes de ejecutar nada, hay que tener esto claro.** La guía ZULU del 23/08 —también
aportada por el dueño— está escrita literalmente en `globals.css:645-656` y dice lo
**contrario** de esta especificación en los tres ejes principales:

| Eje | Guía ZULU del 23/08 (implementada) | Especificación del 28/08 (esta) |
|---|---|---|
| Base | **Navy oscuro** (`--zulu-navy-0: #060a1f`) | **Blanco / blanco cálido** (`#FFFFFF` / `#F5F4EF`), negro para el shell |
| Acento primario | **Cian único** (`--zulu-neon: #00e0ff`) para todo el dashboard | Cian **restringido** al plano técnico; nunca el primario global |
| Color por módulo | **No existe.** Cita textual: *"a diferencia de Bastión (brass/clay por módulo) acá no hay modificador de color por vertical; PMS vs. POS se distingue por vocabulario, no por acento"* | **Brass para reservas, clay para comercio** — modificador por vertical, que es el mecanismo de Bastión |

Es decir: esta especificación **restaura el mecanismo de color de Bastión bajo la
nomenclatura ZULU**, y da vuelta la polaridad de oscuro a claro. No es un retoque ni una
extensión de lo que hay: es un reemplazo del sistema de tokens.

`brass`/`clay`/`sage` **no existen hoy** como colores. Lo único que sobrevive con esos
nombres son dos alias de utilidad que apuntan a otra cosa
(`globals.css:754-755`): `.btn-mini-sage → var(--success)` y `.btn-mini-clay → var(--danger)`.
Un `btn-mini-clay` hoy es **rojo de peligro**, no el clay `#B96145` de comercio. Reasignar
esos nombres sin revisarlos uno por uno cambiaría el significado de botones existentes —
"Eliminar" pasaría de rojo a terracota de comercio.

**Decisión registrada:** el dueño reafirmó esta especificación el 28/08/2026 con el
enunciado completo. Se ejecuta. Esta sección queda como registro de que el cambio fue
deliberado y no un olvido de la guía anterior.

---

## 2. Estado real medido (28/08/2026) — insumo de la Fase V1

No es una estimación: son conteos sobre `appfrontend-main/src`.

| Métrica | Valor | Qué implica |
|---|---:|---|
| Páginas/layouts `.tsx` bajo `app/` | 53 | Universo total a migrar |
| Pantallas que optan al scope `.zulu` | 34 | Repintan solas al cambiar el bloque `.zulu`… si el token equivalente existe |
| Usos de `var(--accent*)` en `.tsx` | 53 en 31 archivos | Cada uno es un lugar donde hoy aparece cian y hay que decidir si es brass, clay, sage, neutro o técnico |
| Usos de `var(--accent*)` en `globals.css` | 20 | El acento está cableado en las primitives, no solo en las páginas |
| Hex hardcodeados en `.ts`/`.tsx` | 21 en 10 archivos | Deuda directa contra el criterio 6 |
| Clases Tailwind de color crudas (`bg-slate-800`, `text-emerald-400`…) | 69 en 10 archivos | Concentradas en Superadmin, que nunca se migró |
| Clases CSS definidas en `globals.css` | 82 | Superficie de primitives a consolidar en la Fase V2 |
| Clase `.bastion` | todavía referenciada en comentarios | Limpieza pendiente |

**Lectura:** los 53 usos de `var(--accent)` son el trabajo real. El cambio de paleta no es
buscar y reemplazar — cada uno de esos 53 usos es una decisión de a qué contexto pertenece
esa pantalla. Eso es exactamente lo que produce la Fase V1.

**Boceto de referencia:** [`zulu-hub-sketch.html`](zulu-hub-sketch.html), en este mismo
directorio. **No es el boceto original del dueño** —ese no estaba en ninguno de los dos
repos (búsqueda por nombre y por extensión, 28/08/2026)— sino una traducción de esta
especificación a HTML autocontenido, hecha para que el criterio de aceptación 1 sea
verificable y para que la Fase V2 tenga contra qué comparar. Si aparece el original, lo
reemplaza y esta nota se borra.

---

## 3. Identidad

ZULU Hub es una **terminal operacional multirubro**. Técnica por su estructura, no por usar
navy y cian.

La marca visible es siempre **ZULU Hub**. No hay marca separada por rubro: ni para
hotelería, ni restaurantes, barberías, spas, consultorios o deportes. La base visual es
neutral y monocromática; el color entra como señal de contexto, estado y acción.

---

## 4. Paleta

### 4.1 Base

```css
:root {
  --zulu-black:      #111111;  /* shell, navegación, encabezados fuertes, acciones oscuras */
  --zulu-graphite:   #242424;  /* superficies oscuras secundarias y paneles */
  --zulu-gray:       #6B6B6B;  /* texto secundario, metadatos, desactivados */
  --zulu-line:       #D8D8D3;  /* bordes, divisiones, líneas de estructura */
  --zulu-white:      #FFFFFF;  /* cards, formularios, superficies principales */
  --zulu-warm-white: #F5F4EF;  /* fondos de trabajo con menor dureza visual */
}
```

### 4.2 Semánticos — tres niveles por familia

El dueño separó (28/08/2026) **token de superficie** y **token fuerte de texto**, justamente
para que el color se pueda usar sin romper accesibilidad. Cada familia semántica tiene tres:

```css
:root {
  /* reservas, recursos, hospedaje, agenda, atención */
  --zulu-brass:           #B8892E;  /* señal: fondo, borde, icono, barra */
  --zulu-brass-strong:    #805F19;  /* TEXTO sobre superficie clara */
  --zulu-brass-soft:      #F2E7C8;  /* superficie suave */

  /* comercio, POS, menú, órdenes, inventario */
  --zulu-clay:            #B96145;
  --zulu-clay-strong:     #944E37;
  --zulu-clay-soft:       #F2DDD5;

  /* disponible, confirmado, listo, completado, correcto */
  --zulu-sage:            #6E927B;
  --zulu-sage-strong:     #4F765F;
  --zulu-sage-soft:       #E1ECE4;

  /* acciones destructivas — INDEPENDIENTE de clay (§4.5) */
  --zulu-danger:          #B42318;
  --zulu-danger-strong:   #B42318;  /* ya pasa AA texto; no hace falta una variante */
  --zulu-danger-soft:     #FBE9E7;

  /* API, telemetría, integraciones, logs, admin técnica */
  --zulu-cyan-technical:  #39C6D8;  /* SOLO sobre superficie oscura */
  --zulu-cyan-deep:       #1F6D77;  /* la variante para superficie clara (§4.5) */
}
```

Los tres niveles no son decorativos: **`*` es señal, `*-strong` es texto, `*-soft` es
superficie.** Confirmado por el dueño el 28/08/2026 y validado por medición (§4.3).

### 4.3 Contraste medido (WCAG 2.1), no estimado

Calculado el 28/08/2026 sobre los hex reales. **Esto no es una guía general: son los números
de esta paleta**, y de acá salen tres reglas duras.

| Token | vs `#FFFFFF` | vs `#F5F4EF` | vs `#111111` |
|---|---|---|---|
| `brass` | 3.16 · AA grande/UI | **2.87 · insuficiente** | 5.98 · AA texto |
| `brass-strong` | **5.88 · AA texto** | **5.34 · AA texto** | 3.21 · AA grande/UI |
| `clay` | 4.32 · AA grande/UI | 3.92 · AA grande/UI | 4.37 · AA grande/UI |
| `clay-strong` | **6.17 · AA texto** | **5.60 · AA texto** | 2.72 · insuficiente |
| `danger` `#B42318` | **6.57 · AA texto** | **5.97 · AA texto** | 2.87 · insuficiente |
| `cyan-deep` `#1F6D77` | **5.98 · AA texto** | **5.43 · AA texto** | 3.10 · AA grande/UI |
| `sage` | 3.47 · AA grande/UI | 3.15 · AA grande/UI | 5.45 · AA texto |
| `sage-strong` | **5.14 · AA texto** | **4.66 · AA texto** | 3.68 · AA grande/UI |
| `cyan-technical` | **2.05 · insuficiente** | **1.86 · insuficiente** | 9.21 · AAA texto |
| `gray` | 5.33 · AA texto | 4.84 · AA texto | 3.54 · AA grande/UI |

Texto sobre las superficies suaves:

| Par | Ratio | |
|---|---|---|
| `brass-strong` sobre `brass-soft` | 4.77 | AA texto ✅ |
| `sage-strong` sobre `sage-soft` | **4.24** | ❌ no llega a AA texto (4.5) |
| `clay-strong` sobre `clay-soft` | 4.72 | AA texto ✅ |
| `brass` sobre `brass-soft` | 2.56 | ❌ |
| `sage` sobre `sage-soft` | 2.86 | ❌ |
| **`--zulu-black` sobre cualquier `*-soft`** | 14.5–15.6 | AAA ✅ |

### 4.4 Reglas que salen de la medición

1. **El token de texto es siempre `*-strong`.** `brass`, `clay` y `sage` a secas **nunca**
   son color de texto sobre superficie clara. Son fondo, borde, icono o barra.
2. **`brass` no se usa sobre `--zulu-warm-white`** ni siquiera como borde o icono: 2.87 no
   llega al mínimo de 3 para elementos no textuales. Sobre blanco puro pasa raspando (3.16).
   Si el fondo de trabajo es warm-white, la señal brass va con `brass-strong`.
3. **El texto sobre CUALQUIER `*-soft` es `--zulu-black`** — confirmado por el dueño el
   28/08/2026, y la medición explica por qué conviene la regla uniforme: `sage-strong` sobre
   `sage-soft` da 4.24 y se queda a 0.26 de AA, mientras brass y clay sí pasarían. Una regla
   igual para las cuatro familias evita tener que recordar cuál sí y cuál no: **la superficie
   tiñe, el texto es negro.**
4. **`cyan-technical` nunca sobre blanco.** 2.05 es inservible incluso para UI. Sobre
   superficie clara se usa `--zulu-cyan-deep #1F6D77` (5.98); `#39C6D8` queda para negro y
   grafito, donde da 9.21.

### 4.5 Los tres huecos, cerrados (28/08/2026)

**`clay-strong` = `#944E37`** — confirmado. Sin él, comercio no podía escribir texto en su
propio color (clay a secas da 4.32 sobre blanco) mientras reservas sí. 6.17 / 5.60 / 4.72
sobre clay-soft: pasa AA texto en los tres.

**Rojo destructivo = `#B42318`, independiente de clay** — confirmado. Verificado en los dos
ejes que importan:

| | Resultado |
|---|---|
| Contraste sobre blanco / blanco cálido | 6.57 / 5.97 — **AA texto en ambos** |
| Distinguibilidad de `clay` (ΔE CIE76) | **28.3** — "claramente distinto" (>25) |
| Distinguibilidad de `clay-strong` | **33.4** |
| Hue | 4° vs 14° de clay |

La preocupación era real —"eliminar" y "comercio" no pueden parecerse, o el criterio 15 se
rompe solo— y queda descartada con medición, no a ojo. `#B42318` ya pasa AA como texto, así
que `--zulu-danger-strong` es el mismo valor: no hace falta una variante más oscura.

⚠️ **Lo único que falta del rojo:** 2.87 sobre `--zulu-black`. El shell es negro, así que un
botón destructivo *dentro del sidebar o de un panel grafito* necesita una variante clara. No
hay ningún caso hoy; anotarlo para cuando aparezca en vez de inventar el token ahora.

**Cian: `#39C6D8` queda restringido a superficie oscura** (2.05 sobre blanco es inservible
incluso para UI) y gana una variante para superficie clara: **`--zulu-cyan-deep #1F6D77`**,
5.98 / 5.43 — AA texto. Es la opción "variante oscura específica" que pidió el dueño, para
que el plano técnico pueda aparecer en una pantalla blanca sin romper accesibilidad ni
ascender el cian a acento general.

### 4.6 Reglas de uso

**Brass es el contexto de reservas y recursos, no "hotel".** Aplica a habitaciones, sillas,
mesas, boxes, canchas y consultorios cuando la pantalla pertenece a ese contexto.

**Clay es el contexto de comercio, no "restaurante".** Aplica a POS, productos, menú,
órdenes, consumos e inventario.

**Sage es transversal:** resultado positivo o estado disponible. No pertenece a ningún rubro.

**El cian no es el color de botones, links, foco ni acciones comunes.** Queda reservado al
plano técnico. Esto es el cambio de mayor superficie respecto de hoy (§2).

**El color nunca es la única señal de estado.** Siempre acompañado de texto, icono, etiqueta
o cambio de estructura.

**No hay colores arbitrarios por tenant.** La configuración elige entre tokens aprobados
(`BRASS`/`CLAY`/`SAGE`/`NEUTRAL`), nunca un hex libre. El cian **no es asignable** por
configuración.

### 4.7 El sistema de rojo destructivo

Ver §4.5: criterio confirmado (independiente de clay), hex pendiente. El `--danger: #f87171`
actual no sirve — está calibrado para fondo navy y sobre blanco no llega.

---

## 5. Tipografía

```text
Sans   → títulos de interfaz, navegación, labels, botones, formularios
Mono   → precios, horarios, folios, códigos, cantidades, métricas comparables
Serif  → opcional, solo títulos editoriales de alta jerarquía
```

La serif **no** se usa en tablas, formularios, botones, filtros ni mensajes operativos.

Jerarquía a distinguir explícitamente: `Page title` · `Section title` · `Card title` ·
`Body` · `Metadata` · `Label` · `Metric` · `Monospaced operational value`.

---

## 6. Layout y shell

```text
App shell
├── Sidebar            negro o grafito
├── Topbar             tenant / usuario / contexto
└── Main content       blanco o blanco cálido
    ├── Breadcrumbs
    ├── Page header
    ├── Filters / actions
    └── Content grid or table
```

Bordes finos, sombras discretas, superficies bien separadas. **Evitar** glassmorphism,
gradientes, brillos, contenedores anidados y sombras pesadas. Radios sobrios y consistentes,
~8–12 px.

El módulo activo usa una señal de color contextual; **no se pinta toda la navegación**.

**El sidebar muestra solo los módulos efectivos del tenant.** No es una lista global fija —
depende de `BusinessContext.enabledModules`, que entrega la Fase 4 del plan de dominios.

---

## 7. Navegación por contexto

Los labels salen de terminología configurable. **La interfaz nunca infiere el rubro leyendo
el nombre de un recurso.**

| Hotelería | Barbería | Restaurante |
|---|---|---|
| Resumen | Resumen | Resumen |
| **Hospedaje**: Reservas · Habitaciones · Estadías · Housekeeping · Mantenimiento | **Turnos**: Agenda · Servicios · Sillas | **Comercio**: POS · Menú · Órdenes · Mesas · Inventario |
| Clientes | Clientes | Clientes |
| Facturación | Facturación | Facturación |
| Reportes | Equipo · Reportes | Reportes |
| Configuración | Configuración | Configuración |

Las tres son **la misma estructura** con labels y módulos distintos, no tres navegaciones.

---

## 8. Componentes

Sistema a consolidar (Fase V2):

```text
Button · IconButton · Badge · StatusBadge · Card · MetricCard · Panel
Table · DataTable · FilterBar · Input · Select · DatePicker · TimePicker
Tabs · Modal · ConfirmationDialog · Toast
EmptyState · LoadingState · ErrorState · Breadcrumbs · SidebarItem
ResourceCard · ReservationCard · ProductCard · OrderPanel
```

Cada componente consume tokens. **Cero hexadecimales locales** en páginas o componentes.

### 8.1 Botones

| Contexto | Color primario |
|---|---|
| Reservas / recursos | brass |
| Comercio / POS | clay |
| Acción positiva | sage cuando corresponda |
| Plano técnico | cian técnico |
| Acción neutra | negro, o blanco con borde |
| Acción destructiva | rojo semántico explícito (§4.4) |

El cian **no** aparece automáticamente como primario en todas las pantallas.

### 8.2 Estados

Cada estado lleva, como mínimo: **label visible + color de fondo o borde + icono o indicador
+ estado accesible.**

```text
Disponible  → sage        + "Disponible"
Pendiente   → brass suave + "Pendiente"
En proceso  → neutral     + "En proceso"
Bloqueado   → clay o rojo + "Bloqueado"
Confirmado  → sage suave  + "Confirmado"
```

---

## 9. Pantallas prioritarias

**Dashboard** — métricas operativas, actividad reciente, alertas, estados y accesos a los
módulos efectivos. Escaneable, no una cuadrícula de tarjetas decorativas. Valores
comparables en mono. Brass/clay/sage como señales puntuales.

**Reservas y recursos** — primera expresión fuerte de brass: título, filtros de fecha y
estado, acción principal brass, rack o grilla de recursos, tarjetas de reserva, estados
disponible/pendiente/bloqueado. El mismo componente base sirve para habitación, silla, mesa,
box, cancha o consultorio.

**POS y comercio** — primera expresión fuerte de clay: categorías, product cards, precio
monoespaciado, disponibilidad, orden actual, subtotal/total, completar y cancelar. Cómodo
para uso táctil, con el panel de orden visible cuando corresponda.

**CRM** — base monocromática. Legibilidad, historial y contexto de relación. Sin color de
rubro propio.

**Facturación** — sobria, documental, precisa. Líneas, estados, importes monoespaciados,
jerarquía clara. No decorativa.

**Housekeeping y mantenimiento** — estados operativos y acciones rápidas. Sage = listo;
brass = atención; clay o rojo = bloqueo o incidencia.

**Reportes** — tablas, métricas y visualizaciones con tokens ZULU. **Nunca** clasificar
recursos por substring del nombre (ya resuelto en backend: se agrupa por `categoryId`).

**Superadmin** — mismo shell, mayor densidad, señales técnicas discretas. Incluye rubros,
capacidades, presets, terminología, identidad contextual y auditoría a medida que existan.

---

## 10. Responsive

Misma jerarquía visual en desktop y mobile.

| Desktop | Mobile |
|---|---|
| Sidebar persistente | Sidebar colapsable |
| Grid de contenido | Cards apiladas |
| Tablas completas | Tablas → filas/cards cuando haga falta |
| Paneles laterales | Topbar simplificada |

**No ocultar estados importantes por falta de espacio.** En mobile la prioridad es mantener
contexto, estado y acción principal.

---

## 11. Accesibilidad

- El color nunca es la única señal: todo estado lleva texto o icono.
- Focus visible en botones, links, inputs, tabs y elementos interactivos.
- Contraste suficiente sobre blanco, blanco cálido, negro y superficies semánticas.
- Componentes operables con teclado; los modales gestionan foco.
- Mensajes de error asociados al campo correspondiente.

**Medido y resuelto (§4.3/§4.4).** El riesgo era real: `brass` sobre blanco da 3.16 y sobre
warm-white 2.87 — no alcanza para texto ni, en warm-white, para bordes. La separación
señal / `*-strong` que definió el dueño lo resuelve, con tres reglas duras: el texto siempre
usa `*-strong`; sobre superficie `*-soft` el texto es `--zulu-black`; y `cyan-technical` solo
va sobre fondo oscuro. Falta cerrar `clay-strong` y el rojo destructivo (§4.5).

---

## 12. Integración con el contexto del tenant

El frontend recibe el contexto efectivo y construye la experiencia:

```text
módulos visibles · labels de navegación · terminología
color contextual del módulo · iconografía permitida · presets de dashboard
```

```ts
// Evitar
if (industryKey === 'HOTEL') { /* pintar hotel */ }

// Preferir
if (enabledModules.includes('PMS_STAYS')) { /* mostrar módulo PMS */ }
```

El sistema visual sigue siendo ZULU aunque el negocio cambie de rubro.

---

## 13. Fases

> **Marco fijado por el dueño (28/08/2026):** *"La migración visual no es 'aplicar Bastion a
> Superadmin'. Es reemplazar el token layer actual de ZULU por la nueva identidad de ZULU
> Hub, usando las mejores decisiones cromáticas de Bastion bajo la marca ZULU."*

| Fase | Qué | Entregable | Depende de |
|---|---|---|---|
| **V1 — Auditoría** | Inventariar páginas, componentes, colores hardcodeados, tipografías, estados, variantes duplicadas y patrones inconsistentes. Clasificar los 53 usos de `var(--accent)` por contexto destino. Revisar call sites de `.btn-mini-clay`/`-sage` (§1) | Matriz componente → destino visual + lista de deuda visual + lista de alias a reasignar | §2 (medición ya hecha); `zulu-hub-sketch.html` |
| **V2 — Tokens y primitives** | **Reemplazar el token layer**, no extenderlo: los 3 niveles por familia (§4.2), tipografía, spacing, radios, sombras, focus rings y breakpoints. Consolidar Button, Badge, StatusBadge, Card, MetricCard, Table, Input, Select, Modal, Toast, Empty/Loading/ErrorState | Sistema de primitives reutilizable, con las 4 reglas de §4.4 codificadas (no solo documentadas) | V1; `clay-strong` y rojo destructivo confirmados (§4.5) |
| **V3 — App shell del tenant** | Sidebar, topbar, breadcrumbs, navegación dinámica y responsive | Shell funcionando en desktop y mobile | V2; **Fase 4 del plan de dominios** (`BusinessContext`) para el sidebar dinámico |
| **V4 — Flujos principales** | Dashboard, Reservas/Recursos (primera expresión de brass), POS/Comercio (primera de clay) y Configuración | Pantallas prioritarias alineadas con el boceto | V3 |
| **V5 — Superadmin** | **(a)** Shell de Superadmin sobre el mismo sistema, saliendo de Tailwind `slate/*` crudo (69 clases). **(b)** Pantallas de rubros y capacidades, con `implemented` visible como "catalogada / soportada". **(c)** Presets de onboarding y terminología. **(d)** Identidad contextual: elegir `contextColor` de un enum cerrado, nunca un hex libre. **(e)** Auditoría de plataforma (`platform_audit_log`, ya construido) | Experiencia Superadmin integrada al producto, no un panel aparte | V2 para (a); **Fase 5 del plan de dominios** para (b)–(d); Fase 2 ya hecha para (e) |
| **V6 — Cobertura restante** | CRM, Facturación, Housekeeping, Mantenimiento, Reportes, Integraciones | Cobertura visual consistente | V4 |
| **V7 — Verificación responsive y accesible** | Recorrer las pantallas migradas en desktop y mobile; verificar focus visible, operación por teclado, foco en modales, errores asociados al campo, y contraste real de cada par token/superficie efectivamente usado | Checklist por pantalla con evidencia; ningún par por debajo de AA sin excepción escrita | V4 y V5 |

**V1 y V2 no dependen del backend** y pueden arrancar en paralelo a la Fase 3 del plan de
dominios. **V3 y V5(b)–(d) sí dependen** — un sidebar dinámico sin `BusinessContext` sería
una lista hardcodeada más, y las pantallas de rubros/capacidades/presets no se pueden pintar
antes de existir. **V5(a)** (sacar Superadmin de Tailwind crudo) y **V5(e)** (auditoría de
plataforma, ya construida en la Fase 2) sí pueden ir apenas esté V2.

---

## 14. Criterios de aceptación

1. `zulu-hub-sketch.html` se traduce a componentes reales del frontend.
2. El shell global tiene identidad monocromática consistente de ZULU Hub.
3. El sidebar muestra solamente los módulos efectivos del tenant.
4. Brass, clay, sage y cian técnico tienen usos documentados y consistentes.
5. El cian deja de ser el color indiscriminado de todas las acciones principales.
6. No quedan colores hardcodeados fuera del sistema de tokens.
7. Los labels se resuelven mediante terminología configurable.
8. La interfaz no infiere el rubro desde el nombre visible de un recurso.
9. Hotel, restaurante, barbería y spa usan el mismo sistema visual sin parecer productos
   inconexos.
10. Los estados no dependen exclusivamente del color.
11. La interfaz funciona en desktop y mobile.
12. Focus, teclado, contraste y mensajes de error cumplen criterios básicos de accesibilidad.
13. Dashboard, Reservas/Recursos, POS/Comercio, Configuración y Superadmin quedan migrados
    antes de considerar terminada la primera entrega visual.
14. Cada PR visual incluye screenshots o evidencia de las pantallas modificadas.
15. **Las modificaciones visuales no cambian silenciosamente las reglas de negocio ni la
    semántica de los dominios.**

### Nota sobre el criterio 15, con un caso concreto

`.btn-mini-clay` hoy es **rojo de peligro** (§1). Repintarlo a clay `#B96145` sin revisar
sus call sites convertiría botones "Eliminar" en botones de contexto comercio — un cambio
de semántica hecho por un cambio de token. Cada alias reasignado necesita revisión de call
sites, no solo de valor.

### Nota sobre el criterio 14

El agente **no puede hacer login en el panel** (restricción registrada el 28/08/2026 en
`app-main/docs/pendientes-2026-08-28.md`). Los screenshots de pantallas detrás de
autenticación los tiene que producir el dueño, o el agente sobre una sesión que el dueño
haya abierto. Tenerlo en cuenta al planificar la evidencia de cada PR visual.
