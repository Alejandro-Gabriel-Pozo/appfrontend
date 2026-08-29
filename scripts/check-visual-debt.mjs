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
 * ## V2.6.1 — por qué este archivo cambió
 * Las reglas de color se buscaban con expresiones regulares sobre el texto
 * plano del archivo. Eso fallaba en las dos direcciones:
 *
 *   - Falsos POSITIVOS: el guard matcheaba sus propios comentarios y la
 *     documentación. Se venía resolviendo reescribiendo la prosa para no
 *     disparar el filtro, o sea acomodando el texto a la herramienta.
 *   - Falsos NEGATIVOS, que es lo grave: la regla de hex decía 0 y era
 *     mentira. Los 21 colores crudos que hay en las pantallas están
 *     escritos como `rgba()` y ninguna regla los miraba. Lo mismo en CSS:
 *     el cian neón sobrevivió a V2.2, V2.3, V2.4 y V2.5 dentro de
 *     `drop-shadow(... rgba(0,224,255,0.24))`. Se descubrió recién
 *     midiendo el CSS servido en producción, que es el peor momento.
 *
 * Ahora esas dos reglas pasan por `lib/find-colors.mjs`, que separa código
 * activo de comentarios y strings con un escáner (`lib/scan-source.mjs`) en
 * vez de filtros cada vez más específicos. Tiene pruebas propias:
 * `npm run test:visual`.
 *
 * Mismo criterio que `EXPECTED_AUTHORIZE_CALL_SITES` en el backend: es un
 * contador contra un número fijo, no un sistema que interpreta código. Si
 * rompe, o saldaste deuda (bajá el techo en el mismo cambio) o la agregaste.
 *
 * Uso:  npm run lint:visual
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { buscarColores } from './lib/find-colors.mjs';
import { conservarSolo } from './lib/scan-source.mjs';

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

/**
 * Como `count`, pero ignorando comentarios (V2.6.2b).
 *
 * Hizo falta porque el patrón se repitió por tercera vez: un comentario que
 * DOCUMENTA la clase recién sacada la vuelve a contar, y el guard falla por
 * su propia explicación. Las dos respuestas anteriores fueron reescribir la
 * prosa; ésta es usar el escáner que ya existe.
 */
function countActivo(re, filter) {
  const hits = [];
  for (const f of files.filter(filter)) {
    const lang = f.endsWith('.css') ? 'css' : 'js';
    const activo = conservarSolo(read(f), lang, lang === 'css' ? ['code'] : ['code', 'string', 'template']);
    activo.split(/\r?\n/).forEach((line, i) => {
      const n = (line.match(re) || []).length;
      for (let k = 0; k < n; k++) {
        hits.push(`${relative(SRC, f).split(sep).join('/')}:${i + 1}  ${line.trim().slice(0, 100)}`);
      }
    });
  }
  return hits;
}

/**
 * Colores crudos vía parser (V2.6.1). A diferencia de `count`, no mira el
 * archivo como texto plano: separa código de comentarios y strings, así
 * documentar un hex en un comentario deja de disparar y un `rgba()` en una
 * regla deja de ser invisible.
 */
function colores(filter, lang) {
  const hits = [];
  for (const f of files.filter(filter)) {
    const rel = relative(SRC, f).split(sep).join('/');
    for (const h of buscarColores(read(f), lang)) {
      hits.push(`${rel}:${h.line}  [${h.formato}]  ${h.linea}`);
    }
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
    fase: 'saldada en V2.4',
    max: 0,
    hits: () => count(/\bbastion\b/gi, (f) => isTsx(f) || isCss(f)),
    ayuda: 'Sistema superado. Borrar la clase y sus comentarios.',
  },
  {
    // V2.6.1: esta regla reemplaza a la vieja "hex crudo en .ts/.tsx", que
    // reportaba 0 y era falso. Sólo miraba hex: los 21 colores que había de
    // verdad en las pantallas estaban escritos como rgba() y pasaban enteros.
    // V2.6.2b bajó de 21 a 4 al pasar los 17 scrims a --zulu-scrim, y
    // V2.6.2c de 4 a 0: el banner de dead-letter pasó a los tokens danger
    // y la sombra de RoomCalendar a --shadow-md. Vuelve a 0: si aparece un
    // color nuevo en una pantalla, falla.
    nombre: 'color crudo en pantallas (.ts/.tsx)',
    fase: 'saldada en V2.6.2c',
    max: 0,
    hits: () => colores(isTsx, 'js'),
    ayuda: 'Si falta un token, agregalo al sistema — no un color en la pantalla.',
  },
  {
    // La regla de fondo: los literales viven en la CAPA DE TOKENS. Una
    // declaración `--zulu-danger: #B42318` está bien; una regla que pinta
    // con un color escrito a mano, no. Es lo que dejó pasar cuatro fases
    // de cian neón en drop-shadow y box-shadow.
    nombre: 'color crudo en reglas CSS (fuera de tokens)',
    // V2.6.2c bajó de 12 a 6, y la decisión sobre los glows de 6 a 4:
    // el halo de la marca pasó a --zulu-brand-glow (excepción sancionada,
    // con nombre) y el del botón primario se eliminó. Los 4 que quedan
    // están todos en styles.css, archivo muerto que se borra en V2.6.2d.
    fase: 'medida en V2.6.1, los 4 restantes se van con styles.css en V2.6.2d',
    max: 4,
    hits: () => colores(isCss, 'css'),
    ayuda: 'Un color literal sólo puede aparecer declarando una custom property. ' +
           'Una regla que consume color pasa por var(--token).',
  },
  {
    nombre: 'overlay blanco sin token — forma rgba()',
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
    // V2.6.2b: la regla de arriba decía "saldada en V2.2" y marcaba 0, pero
    // sólo miraba la forma `rgba(255,255,255,…)`. En Tailwind el MISMO bug
    // se escribe `bg-white/10` o `border-white/[0.06]`, y así hay 24 que
    // nunca vio -- el mismo tipo de punto ciego que V2.6.1 encontró con
    // rgba(). El de `Modal.tsx` era un hover invisible sobre el diálogo
    // blanco. 9 de los 24 están en `styles.css`, que no importa nadie y se
    // borra en V2.6.2d; 6 en superadmin, que se migra en V5(a). Quedan 9
    // vivos y en alcance: ApiSection 3, ResourceLockPicker 3, ApiBlock 2,
    // reportes 1.
    nombre: 'overlay blanco sin token — forma Tailwind',
    // V2.6.2c bajó de 24 a 15 migrando los 9 vivos a --zulu-overlay-NN.
    // Los 15 que quedan: 9 en styles.css (muerto, V2.6.2d) y 6 en
    // superadmin (V5a). Ninguno en alcance hoy.
    fase: 'medida en V2.6.2b, 15 restantes esperan V2.6.2d y V5(a)',
    max: 15,
    hits: () => countActivo(/\b(?:bg|border|ring|divide|from|to|via)-white\/(?:\[[0-9.]+\]|[0-9]+)/g,
                            (f) => isTsx(f) || isCss(f)),
    ayuda: 'Mismo problema que la regla de arriba, otra sintaxis: blanco translúcido ' +
           'sobre fondo claro no se ve. Usar --zulu-overlay-NN, que sigue la polaridad.',
  },
  {
    nombre: 'alias engañoso .btn-mini-clay / -sage',
    // Los 40 call sites se revisaron uno por uno en V2.4 y se renombraron a
    // .btn-mini-danger / -confirm, que es lo que de verdad hacían. Ninguno
    // era contexto de comercio. El techo baja a 0: si el nombre vuelve a
    // aparecer, alguien está reintroduciendo la trampa.
    fase: 'saldada en V2.4',
    max: 0,
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
