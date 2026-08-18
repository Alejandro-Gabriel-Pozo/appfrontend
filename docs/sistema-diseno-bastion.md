# Sistema de diseño "Bastión" — Guía para Claude Code

Sistema visual a usar en pantallas nuevas del dashboard admin (`src/app/dashboard/**`).
No reemplaza automáticamente el diseño oscuro que ya tienen las pantallas migradas a
Refine (Categorías, Productos) — se aplica pantalla por pantalla, a pedido explícito,
citando este documento.

## Cómo usarlo

Pegarle este archivo completo a Claude Code al pedir una pantalla nueva, con:

> Seguí el sistema de diseño Bastión (`docs/sistema-diseno-bastion.md`).
> Pantalla a crear: [nombre]
> Módulo: [PMS → acento brass] o [POS → acento clay]
> Contenido real que debe mostrar: [...]
> Mantené el mismo sidebar, misma tipografía (Fraunces/IBM Plex Sans/IBM Plex Mono),
> mismos radios de borde y misma paleta de la tabla de la sección 1.

---

## 1. Paleta de colores

| Nombre | Hex | Uso |
|---|---|---|
| Ink (tinta) | `#14213D` | Sidebar, textos de máxima jerarquía |
| Ink Soft | `#1E2C4F` | Hover/estado activo sobre sidebar |
| Parchment (pergamino) | `#FAF7F0` | Fondo general de la app |
| Card | `#FFFFFF` | Fondo de tarjetas y paneles |
| Brass (bronce) | `#B8935F` | Acento principal PMS/hotel, línea activa en nav |
| Brass Soft | `#E8D9C3` | Fondo de chips "pendiente" |
| Sage (salvia) | `#6B8F71` | Estado positivo/disponible |
| Sage Bg | `#E7EEE6` | Fondo de chips positivos |
| Clay (terracota) | `#C1553D` | Acento principal POS/gastronomía, alertas |
| Clay Bg | `#F5E4DF` | Fondo de chips de alerta/ocupado |
| Slate | `#5B6478` | Texto secundario |
| Line | `#E7E2D8` | Bordes y separadores |
| Text | `#1C2333` | Texto principal |

Regla: **Brass** es el acento de módulos de hospedaje/PMS (alojamiento, estadías,
housekeeping, reservas). **Clay** es el acento de módulos gastronómicos/POS
(órdenes, productos, cuentas corrientes). Ambos conviven porque comparten el mismo
sidebar tinta y fondo pergamino — no se usan al mismo tiempo como color principal en
una sola pantalla, salvo para estados (sage/clay como semáforo).

## 2. Tipografía

- **Display / títulos**: `Fraunces` (serif, pesos 300/500/600) — `h1`, títulos de
  sección, valores de KPI grandes, monto total.
- **Cuerpo / UI**: `IBM Plex Sans` (400/500/600) — texto general, botones, labels,
  nombres de producto.
- **Datos / cifras**: `IBM Plex Mono` (400/500) — precios, códigos de habitación,
  horarios, fechas, cualquier dato tabular.

```html
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

## 3. Layout base

```
┌──────────┬──────────────────────────────┬─────────────┐
│          │                              │             │
│ SIDEBAR  │   CONTENIDO PRINCIPAL         │  PANEL      │
│ oscuro   │   (fondo parchment)           │  LATERAL    │
│ (ink)    │                               │  opcional   │
│          │                               │  (card)     │
└──────────┴──────────────────────────────┴─────────────┘
```

- **Sidebar**: fondo `--ink`, ancho fijo (230px con labels, o 88px versión
  ícono-solo para pantallas operativas rápidas como POS). Ítem activo con
  `box-shadow: inset 3px 0 0 var(--brass)` o fondo sólido de acento si es
  contexto POS.
- **Contenido principal**: fondo `--parchment`, padding generoso (28-40px),
  max-width para no estirar en pantallas anchas.
- **Panel lateral** (cuando aplica: ticket, detalle de reserva, resumen): fondo
  `--card`, borde izquierdo `1px solid var(--line)`, ancho fijo entre 320-340px.

## 4. Componentes reutilizables

### Cards / KPI
- `border-radius: 14-16px`, borde `1px solid var(--line)`, sin sombra dura
  (opcional sombra sutil solo en hover).
- Las KPI cards llevan una barra de acento de 3px a la izquierda (`::before`).
- Valor grande en Fraunces, label pequeño en mayúsculas con letter-spacing arriba.

### Chips de estado
- `border-radius: 100px` (pill), texto 10-11px, siempre par fondo-claro +
  texto-oscuro del mismo color (nunca texto blanco sobre pastel).
- Semántica de color: sage = positivo/disponible, clay = ocupado/alerta,
  brass = pendiente/atención, gris (`#EEF0F5` / `#8A93AD`) = neutro/en proceso.

### Botones
- `border-radius: 12px`, padding `15px`, sin bordes.
- Primario: fondo de acento del módulo (brass en PMS, clay en POS), texto blanco.
- Secundario/ghost: fondo `--parchment`, borde `1px solid var(--line)`, texto
  `--slate`.

### Tablas
- Sin bordes verticales. Solo `border-bottom: 1px solid var(--line)` en filas
  y header.
- Header en mayúsculas, 10.5px, `--slate`.
- Hover de fila: fondo `#FBF9F4`.

### Grids táctiles (POS)
- Tarjetas de producto: imagen/ícono arriba en bloque de color pastel, nombre,
  precio en mono, tag pequeño en sage.
- `aspect-ratio` fijo para que el grid no salte al cargar contenido.

### Motivo "rack" (PMS)
- Grid de fichas de color (una por habitación/recurso), cada una con número +
  estado + micro-punto de color en la esquina. Reemplaza al calendario
  horizontal genérico — es el elemento señal del sistema.

## 5. Principios generales

1. **Un acento por módulo**: brass para hospedaje, clay para gastronomía. No
   mezclar como color principal en la misma pantalla.
2. **Mono para todo lo que sea un dato que alguien vaya a leer rápido y
   comparar** (precios, horarios, códigos).
3. **Serif solo para jerarquía alta** (h1, valores destacados) — nunca en
   párrafos largos ni en botones.
4. **Los estados siempre son color de fondo pastel + texto oscuro del mismo
   tono**, nunca solo texto de color sobre blanco (para que se puedan escanear
   como bloques desde lejos, clave en operación de mostrador).
5. **Responsive**: el sidebar colapsa a fila horizontal en mobile (<900px) y
   se ocultan los labels de navegación, dejando solo íconos.

## 6. Mapeo de módulos del dashboard real → acento

Referencia rápida contra el nav real de `dashboard/layout.tsx` (no inventar
módulos nuevos — usar los `moduleKey` que ya gatea el backend):

| Pantalla | `moduleKey` (si aplica) | Acento |
|---|---|---|
| Recursos, Categorías, Reservas | — (core, sin gate) | Brass |
| Estadías | `ALOJAMIENTO` | Brass |
| Housekeeping | `HOUSEKEEPING` | Brass |
| Órdenes, Productos | `POS_RESTAURANTE` | Clay |
| Cuentas Corrientes | `CUENTAS_CORRIENTES` | Clay |
| Clientes, Usuarios, Mi Negocio, Admin, Reportes | — / `REPORTES` | Neutro (sin acento de módulo — usar brass por defecto si hace falta uno) |

## 7. Estado de adopción

Bastión se aplica pantalla por pantalla, a pedido explícito — el resto del
dashboard sigue con el tema oscuro original (`#0c0e14`/`#13151e`, acento
esmeralda `#10b981`). El shell (sidebar/topbar de `dashboard/layout.tsx`) NO
está migrado — es compartido por las 15 pantallas, decisión confirmada con
el dueño el 18/08/2026 (ver `feedback_technical_vs_organizational_decisions`
en memoria si aplica un criterio similar a futuro). Actualizar esta lista
cada vez que una pantalla nueva se sume.

- [x] **Reservas** (18/08/2026) — acento brass, tabla + 2 modales.
- [x] **Housekeeping** (18/08/2026) — acento brass, patrón "rack" (grid de
      fichas por recurso en vez de tabla) + modal de detalle/acciones.
- [ ] Órdenes, Estadías, Recursos, Servicios, Categorías, Productos,
      Clientes, Usuarios, Cuentas Corrientes, Reportes, Mi Negocio, Admin
