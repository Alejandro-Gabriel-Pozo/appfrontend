# Índice de documentación — appfrontend-main

- **Fecha:** 2026-08-28
- **Para qué:** este repo acumulaba documentos sin un punto de entrada. El backend tiene
  `app-main/docs/indice-conocimiento.md`; esto es el equivalente de este lado, acotado a lo
  que vive acá. No duplica contenido: enlaza.
- **Regla:** un documento nuevo en `docs/` se agrega a la tabla en el mismo cambio. Un
  documento superado se marca en su propio encabezado y su fila dice por qué se conserva.

---

## Vigentes

| Documento | Qué es | Estado |
|---|---|---|
| [sistema-diseno-zulu-hub.md](sistema-diseno-zulu-hub.md) | **Fuente de verdad visual.** Paleta con contrastes medidos, tipografía, shell, componentes, fases V1–V7 y criterios de aceptación | Normativo. **0 de 7 fases ejecutadas** — el código no lo refleja en nada todavía, ver abajo |
| [zulu-hub-sketch.html](zulu-hub-sketch.html) | Boceto de referencia: los 3 contextos (reservas/brass, comercio/clay, Superadmin/técnico) sobre el mismo shell. Autocontenido, se abre con doble click | Referencia. **No es el boceto original del dueño**, que no estaba en ningún repo — es una traducción de la especificación; si aparece el original, lo reemplaza |
| [auditoria-visual-v1-2026-08-29.md](auditoria-visual-v1-2026-08-29.md) | **Entregable de la Fase V1.** Los 53 usos de `var(--accent)` clasificados por rol, inventario de hex y clases Tailwind crudas, alias engañosos, tokens que faltan y orden de migración para V2 | Auditoría cerrada. **No cambió código**: V1 es auditar y documentar |
| [auditoria-modales.md](auditoria-modales.md) | Cuándo modal, cuándo panel, cuándo ruta dedicada `/dashboard/{entidad}/[id]` | Convención aplicada. Backlog de migración vivo |
| [roadmap-migracion-refine.md](roadmap-migracion-refine.md) | Qué pantallas usan Refine, qué falta y qué queda afuera a propósito | Roadmap vivo |

## Superados (se conservan como registro)

| Documento | Por qué se conserva |
|---|---|
| [sistema-diseno-bastion.md](sistema-diseno-bastion.md) | Superado dos veces: por la guía ZULU del 23/08 (navy + cian) y por `sistema-diseno-zulu-hub.md` del 28/08. Se conserva porque el sistema vigente **recupera el mecanismo de Bastión** —un color por vertical, brass reservas / clay comercio— que ZULU había descartado explícitamente. Entender por qué se fue y por qué volvió necesita este documento. **Los hexes NO se recuperan**: son distintos y están elegidos con contraste medido |

---

## Estado de la corriente visual: no empezó

**1 de 7 fases ejecutadas** (V1, auditoría — no cambia código). **Ninguna pantalla migrada.
Ningún token cambiado.** Lo que se ve en producción sigue siendo el sistema navy + cian.

El entregable de V1 es [auditoria-visual-v1-2026-08-29.md](auditoria-visual-v1-2026-08-29.md).
Su hallazgo principal condiciona toda la V2: **`--accent` no es un token de acento, son
siete trabajos distintos con un solo nombre**, y solo 9 de sus 53 usos son color de contexto
de módulo. Hay que partirlo antes de repintarlo.

El orden es **tokens/primitives (V2) → shell de ZULU Hub (V3) → pantallas prioritarias,
Superadmin incluido (V4/V5) → cobertura restante (V6) → V7, responsive y accesibilidad como
fase propia**. Plan completo y cruce con el backend:
`app-main/docs/plan-separacion-dominios-multirubro-2026-08-28.md` §16.

---

## La brecha que hay que tener presente

Hay una distancia declarada entre el sistema visual normativo y lo que el código hace hoy.
No es deuda encontrada de casualidad: es el punto de partida de las fases V1–V7.

| | Código hoy (`globals.css`, bloque `.zulu`) | Sistema vigente (spec §4) |
|---|---|---|
| Base | Navy `#060a1f` | Blanco / blanco cálido, negro para el shell |
| Acento | Cian `#00e0ff`, único para todo | Cian solo en el plano técnico |
| Color por módulo | No existe | Brass reservas · clay comercio · sage estados |

**Antes de tocar color, tipografía o un componente compartido: leer el spec.** No alcanza
con mirar cómo lo hace la pantalla de al lado — la pantalla de al lado está en el sistema
que se va a reemplazar. Las reglas que ya rigen para código nuevo (cero hex en `.tsx`, cero
clases Tailwind de color crudas, color nunca como única señal, no reasignar
`.btn-mini-clay`/`-sage` sin revisar call sites) están en el `CLAUDE.md` de este repo,
sección "Sistema de diseño".

## Documentos de este proyecto que viven en el otro repo

| Qué | Dónde |
|---|---|
| Plan activo: separación de dominios, multirubro y corriente visual §16 | `app-main/docs/plan-separacion-dominios-multirubro-2026-08-28.md` |
| Índice de conocimiento de ingeniería (ADR, playbooks, runbooks) | `app-main/docs/indice-conocimiento.md` |
| Log de sesión (se lee al empezar cada conversación) | `app-main/docs/pendientes-<fecha más alta>.md` |
| Códigos HTTP y `body.code` que consume `lib/apiErrors.ts` | `app-main/docs/HTTP_CONTRACTS.md` |
