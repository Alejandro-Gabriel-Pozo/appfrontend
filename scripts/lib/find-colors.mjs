/**
 * find-colors.mjs — encuentra colores crudos en código activo.
 *
 * El criterio no es "no hay colores": los colores tienen que existir en
 * algún lado. Es **dónde**:
 *
 *   > Un color literal sólo puede aparecer declarando una custom property
 *   > (`--zulu-danger: #B42318`). Ninguna regla que consume color puede
 *   > escribirlo directo -- tiene que pasar por `var(--token)`.
 *
 * Esa es la regla que el guard viejo no sabía expresar. Buscaba hex sueltos
 * y por eso dejaba pasar `filter: drop-shadow(0 0 7px rgba(0,224,255,0.24))`,
 * que es exactamente el caso que importa: una regla pintando con un color
 * que el sistema de tokens ya no reconoce.
 */

import { conservarSolo } from './scan-source.mjs';

/**
 * Formatos de color. Se listan todos los que CSS acepta hoy, no sólo los
 * que el repo usa: el punto ciego anterior fue justamente un formato que
 * nadie estaba mirando.
 */
const FORMATOS = [
  ['hex', /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g],
  ['rgb', /\brgba?\s*\(/g],
  ['hsl', /\bhsla?\s*\(/g],
  ['color-mix', /\bcolor-mix\s*\(/g],
  ['lab/lch', /\b(?:lab|lch|oklab|oklch)\s*\(/g],
  ['hwb', /\bhwb\s*\(/g],
];

/** `--foo:` inmediatamente antes del match, dentro de la misma declaración. */
function enDeclaracionDeTokenCss(codigo, idx) {
  let ini = 0;
  for (let k = idx - 1; k >= 0; k--) {
    const c = codigo[k];
    if (c === ';' || c === '{' || c === '}') { ini = k + 1; break; }
  }
  return /^\s*--[\w-]+\s*:/.test(codigo.slice(ini, idx));
}

/** En JS/TSX un token se declara como propiedad de objeto: `'--foo': '#fff'`. */
function enDeclaracionDeTokenJs(src, idx) {
  const desdeLinea = src.lastIndexOf('\n', idx) + 1;
  return /['"]--[\w-]+['"]\s*:/.test(src.slice(desdeLinea, idx));
}

/**
 * Atributos JSX que llevan texto para una persona, no un valor de CSS.
 * `placeholder="Ej: OC #123"` tiene un `#123` que es un número de orden y
 * además es un hex de 3 dígitos válido. Es una exclusión EXPLÍCITA y corta
 * a propósito: la alternativa era adivinar si un string "parece" un valor
 * de CSS, que es la clase de filtro frágil que ya falló una vez.
 */
const ATRIBUTOS_DE_TEXTO = /\b(?:placeholder|title|alt|aria-label|aria-description)\s*=/;

function enTextoParaHumanos(src, idx) {
  const desdeLinea = src.lastIndexOf('\n', idx) + 1;
  const antes = src.slice(desdeLinea, idx);
  const m = antes.match(ATRIBUTOS_DE_TEXTO);
  if (!m) return false;
  // Sólo si el string de ese atributo sigue abierto en el match: si ya
  // cerró, lo que viene después es otro atributo y sí hay que mirarlo.
  const desdeAtributo = antes.slice(m.index + m[0].length);
  const comillas = (desdeAtributo.match(/["']/g) || []).length;
  return comillas === 1;
}

/**
 * @param {string} src
 * @param {'css'|'js'} lang
 * @param {{incluirDeclaracionesDeToken?: boolean}} [opts]
 * @returns {{line:number, col:number, texto:string, formato:string, linea:string}[]}
 */
export function buscarColores(src, lang, opts = {}) {
  // En CSS un color vive en el código; lo que haya adentro de un string
  // (`content: "#hashtag"`) es texto, no color.
  // En JS/TSX es al revés: el color casi siempre ES un string
  // (`style={{ color: '#fff' }}`), así que hay que mirarlos.
  const tipos = lang === 'css' ? ['code'] : ['code', 'string', 'template'];
  const activo = conservarSolo(src, lang, tipos);

  const lineas = src.split(/\r?\n/);
  const offsets = [];
  let acc = 0;
  for (const l of src.split('\n')) { offsets.push(acc); acc += l.length + 1; }
  const lineaDe = (idx) => {
    let lo = 0, hi = offsets.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (offsets[m] <= idx) lo = m; else hi = m - 1; }
    return lo;
  };

  const hits = [];
  for (const [formato, re] of FORMATOS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(activo)) !== null) {
      if (lang === 'js' && enTextoParaHumanos(src, m.index)) continue;
      const esToken = lang === 'css'
        ? enDeclaracionDeTokenCss(activo, m.index)
        : enDeclaracionDeTokenJs(src, m.index);
      if (esToken && !opts.incluirDeclaracionesDeToken) continue;
      const i = lineaDe(m.index);
      hits.push({
        line: i + 1,
        col: m.index - offsets[i] + 1,
        texto: m[0],
        formato,
        linea: (lineas[i] || '').trim().slice(0, 100),
      });
    }
  }
  return hits.sort((a, b) => a.line - b.line || a.col - b.col);
}
