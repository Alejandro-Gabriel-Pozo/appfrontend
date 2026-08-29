/**
 * scan-source.mjs — separa código activo de comentarios y strings.
 *
 * Existe por un punto ciego concreto (29/08/2026): el guard de deuda visual
 * buscaba hex crudos con una expresión regular sobre el archivo entero. Eso
 * tenía dos problemas opuestos que se compensaban mal:
 *
 *   1. Falsos POSITIVOS: matcheaba sus propios comentarios y la
 *      documentación. La respuesta había sido reescribir los comentarios
 *      para que no dispararan el filtro -- o sea, adaptar la prosa a la
 *      herramienta.
 *   2. Falsos NEGATIVOS, mucho peor: todo el cian neón sobrevivió a cuatro
 *      fases escrito como `rgba(0,224,255,0.24)`, que ningún filtro miraba.
 *      Se descubrió recién midiendo el CSS servido en producción.
 *
 * La salida es una lista de regiones con su tipo. Blanquear una región
 * conserva las posiciones exactas (mismos saltos de línea, misma longitud),
 * así los números de línea que reporta el guard siguen siendo los del
 * archivo original.
 */

/** @typedef {{type:'code'|'comment'|'string'|'template', start:number, end:number}} Region */

const ANTES_DE_REGEX = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const PALABRAS_ANTES_DE_REGEX = ['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'yield'];

/**
 * ¿Una `/` acá abre un literal de expresión regular, o es una división?
 * Heurística estándar: mira el último carácter significativo. Si es un
 * identificador, un número o un cierre, es división; si no, arranca regex.
 * Importa sólo para no confundir el `//` de adentro de un regex con un
 * comentario.
 */
function esInicioDeRegex(src, i) {
  for (let j = i - 1; j >= 0; j--) {
    const c = src[j];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') continue;
    if (ANTES_DE_REGEX.has(c)) return true;
    if (/[A-Za-z0-9_$)\]]/.test(c)) {
      // `return /re/` y `typeof /re/` son regex pese a terminar en letra.
      const palabra = src.slice(Math.max(0, j - 10), j + 1).match(/[A-Za-z_$]+$/);
      return palabra ? PALABRAS_ANTES_DE_REGEX.includes(palabra[0]) : false;
    }
    return false;
  }
  return true;
}

/**
 * @param {string} src
 * @param {'css'|'js'} lang
 * @returns {Region[]}
 */
export function scan(src, lang) {
  /** @type {Region[]} */
  const out = [];
  let i = 0;
  let inicioCodigo = 0;
  // Pila de plantillas: cada `${` abre código anidado que puede contener
  // otra plantilla. Sin esto una plantilla adentro de una interpolación
  // se lee mal y arrastra el resto del archivo.
  const pilaTpl = [];

  const cerrarCodigo = (fin) => {
    if (fin > inicioCodigo) out.push({ type: 'code', start: inicioCodigo, end: fin });
  };
  const push = (type, start, end) => {
    out.push({ type, start, end });
    inicioCodigo = end;
  };

  /** Avanza dentro de una plantilla hasta `${` o hasta la comilla de cierre. */
  const finDeTramoTpl = (desde) => {
    for (let j = desde; j < src.length; j++) {
      if (src[j] === '\\') { j++; continue; }
      if (src[j] === '$' && src[j + 1] === '{') return { j, interpola: true };
      if (src[j] === '`') return { j, interpola: false };
    }
    return { j: src.length, interpola: false };
  };

  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];

    // ── comentario de bloque (los dos lenguajes)
    if (c === '/' && d === '*') {
      cerrarCodigo(i);
      const cierre = src.indexOf('*/', i + 2);
      const end = cierre === -1 ? src.length : cierre + 2;
      push('comment', i, end);
      i = end;
      continue;
    }

    // ── comentario de línea (sólo JS; en CSS `//` no es comentario)
    if (lang === 'js' && c === '/' && d === '/') {
      cerrarCodigo(i);
      let fin = src.indexOf('\n', i);
      if (fin === -1) fin = src.length;
      push('comment', i, fin);
      i = fin;
      continue;
    }

    // ── literal de expresión regular (sólo JS)
    if (lang === 'js' && c === '/' && esInicioDeRegex(src, i)) {
      let j = i + 1;
      let enClase = false;
      let cerrado = false;
      for (; j < src.length; j++) {
        const e = src[j];
        if (e === '\\') { j++; continue; }
        if (e === '[') enClase = true;
        else if (e === ']') enClase = false;
        else if (e === '/' && !enClase) { cerrado = true; break; }
        else if (e === '\n') break;
      }
      if (cerrado) {
        cerrarCodigo(i);
        push('string', i, j + 1);
        i = j + 1;
        continue;
      }
      i++;                                            // era una división
      continue;
    }

    // ── strings con comillas
    if (c === '"' || c === "'") {
      cerrarCodigo(i);
      let j = i + 1;
      for (; j < src.length; j++) {
        if (src[j] === '\\') { j++; continue; }
        if (src[j] === c) break;
        if (src[j] === '\n' && lang === 'js') break;   // string sin cerrar
      }
      push('string', i, Math.min(j + 1, src.length));
      i = j + 1;
      continue;
    }

    // ── plantillas (sólo JS)
    if (lang === 'js' && c === '`') {
      cerrarCodigo(i);
      const { j, interpola } = finDeTramoTpl(i + 1);
      if (interpola) {
        push('template', i, j + 2);
        pilaTpl.push(1);
        i = j + 2;
      } else {
        push('template', i, Math.min(j + 1, src.length));
        i = j + 1;
      }
      continue;
    }
    if (lang === 'js' && c === '}' && pilaTpl.length) { // vuelve de la interpolación
      cerrarCodigo(i);
      const { j, interpola } = finDeTramoTpl(i + 1);
      if (interpola) {
        push('template', i, j + 2);
        i = j + 2;
      } else {
        push('template', i, Math.min(j + 1, src.length));
        pilaTpl.pop();
        i = j + 1;
      }
      continue;
    }

    i++;
  }
  cerrarCodigo(src.length);
  return out;
}

/**
 * Reemplaza por espacios todo lo que NO sea de los tipos pedidos,
 * conservando los saltos de línea. Las posiciones no se mueven, así que
 * el número de línea de cualquier match sigue siendo el del archivo real.
 */
export function conservarSolo(src, lang, tipos) {
  const dejar = new Set(tipos);
  const buf = src.split('');
  for (const r of scan(src, lang)) {
    if (dejar.has(r.type)) continue;
    for (let k = r.start; k < r.end; k++) {
      if (buf[k] !== '\n') buf[k] = ' ';
    }
  }
  return buf.join('');
}
