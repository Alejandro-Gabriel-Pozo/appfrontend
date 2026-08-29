/**
 * check-visual-debt.mjs — cerca eléctrica de la corriente visual
 *
 * Pedido del dueño al aprobar V1 (29/08/2026): que no queden usos residuales
 * de `var(--accent)`, `.bastion`, hex crudos en `.tsx` ni overlays blancos sin
 * token explícito, y que `.btn-mini-clay` esté revisado call site por call site.
 *
 * ## Cómo funciona
 * Dos tipos de regla:
 *   - `max: 0`      -> deuda YA saldada. Si vuelve a aparecer, falla.
 *   - `max: <n>`    -> deuda conocida, con techo. Puede bajar, nunca subir.
 *     El número sale de la auditoría V1 y de la fase que lo va a saldar.
 *
 * Mismo criterio que `EXPECTED_AUTHORIZE_CALL_SITES` en el backend: es un
 * contador contra un número fijo, no un sistema que interpreta código. Si
 * rompe, o saldaste deuda (bajá el techo en el mismo cambio) o la agregaste.
 *
 * Uso:  npm run lint:visual
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const IGNORE = new Set(['node_modules', '.next', 'dist']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(SRC);
const read = (f) => readFileSync(f, 'utf8');
const isTsx = (f) => f.endsWith('.tsx') || f.endsWith('.ts');
const isCss = (f) => f.endsWith('.css');

/** Cuenta ocurrencias de `re` en los archivos que pasan `filter`. */
function count(re, filter) {
  const hits = [];
  for (const f of files.filter(filter)) {
    const lines = read(f).split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const _ of line.matchAll(re)) {
        hits.push(`${relative(SRC, f).split(sep).join('/')}:${i + 1}  ${line.trim().slice(0, 100)}`);
      }
    });
  }
  return hits;
}

const REGLAS = [
  {
    nombre: 'var(--accent) en pantallas',
    fase: 'saldada en V2.1',
    max: 0,
    hits: () => count(/var\(--accent/g, isTsx),
    ayuda: 'Usá el token semántico que corresponda al ROL (link, foco, contexto de módulo, ' +
           'cromo de formulario, superficie seleccionada, técnico, estado). Ver globals.css.',
  },
  {
    nombre: 'var(--accent) en reglas CSS',
    fase: 'saldada en V2.1',
    max: 0,
    // Se permite SOLO en el bloque de definiciones (`--zulu-x: var(--accent)`)
    // y en el scope .zulu, que redefine el propio --accent.
    hits: () => count(/var\(--accent/g, isCss)
      .filter((h) => !/--(zulu|accent)[a-z-]*:\s*var\(--accent/.test(h)),
    ayuda: 'Ninguna regla debe usar --accent directo: pasá por el token semántico.',
  },
  {
    nombre: 'clase .bastion residual',
    fase: 'a saldar en V2.4',
    max: 1,
    hits: () => count(/\bbastion\b/gi, (f) => isTsx(f) || isCss(f)),
    ayuda: 'Sistema superado. Borrar la clase y sus comentarios.',
  },
  {
    nombre: 'hex crudo en .ts/.tsx',
    fase: 'a saldar en V2.3',
    max: 19,
    hits: () => count(/#[0-9a-fA-F]{3,8}\b/g, isTsx)
      // "Ej: OC #123" vive dentro de un placeholder de texto, no es un color.
      // No filtrar por "#seguido de dígito": eso descartaba #7f1d1d y #060a1f.
      .filter((h) => !/placeholder=/.test(h)),
    ayuda: 'Si falta un token, agregalo al sistema — no un hex en la pantalla.',
  },
  {
    nombre: 'overlay blanco sin token (rgba(255,255,255,α))',
    fase: 'saldada en V2.2',
    max: 0,
    // Se permite SOLO la definición del tint, que es el único lugar que
    // declara de qué lado está el fondo.
    hits: () => count(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,/g, (f) => isTsx(f) || isCss(f))
      .filter((h) => !/--zulu-overlay-tint/.test(h)),
    ayuda: 'Blanco translúcido SOLO funciona sobre fondo oscuro; al invertir la polaridad ' +
           'desaparece en silencio. Usar un token de overlay que sepa de qué lado está el fondo.',
  },
  {
    nombre: 'alias engañoso .btn-mini-clay / -sage',
    // 40 call sites reales, medidos — no los 2 de globals.css. La primera
    // corrida de esta cerca corrigió una estimación mía de 8.
    fase: 'a revisar call site por call site en V2.4',
    max: 40,
    hits: () => count(/btn-mini-(clay|sage)/g, (f) => isTsx(f) || isCss(f)),
    ayuda: 'Hoy apuntan a --danger (ROJO) y --success. Repintarlos al clay/sage reales ' +
           'convierte botones "Eliminar" en botones de contexto comercio. Revisar cada uso ' +
           'ANTES de reasignar (criterio 15 de la especificación).',
  },
];

let fallo = false;
console.log('Deuda visual — corriente ZULU Hub\n');

for (const r of REGLAS) {
  const hits = r.hits();
  const n = hits.length;
  const ok = n <= r.max;
  const estado = n === 0 ? '  OK  ' : ok ? ' TECHO' : ' FALLA';
  console.log(`[${estado}] ${r.nombre.padEnd(46)} ${String(n).padStart(3)} / ${String(r.max).padEnd(3)}  (${r.fase})`);
  if (!ok) {
    fallo = true;
    console.log(`\n         ${r.ayuda}\n`);
    for (const h of hits.slice(0, 15)) console.log(`         ${h}`);
    if (hits.length > 15) console.log(`         … y ${hits.length - 15} más`);
    console.log('');
  } else if (n < r.max) {
    console.log(`         ↓ bajó de ${r.max} a ${n}: actualizá el techo en este mismo cambio.`);
  }
}

console.log('');
if (fallo) {
  console.log('La deuda visual creció. Ver el detalle arriba.');
  process.exit(1);
}
console.log('Sin deuda visual nueva.');
