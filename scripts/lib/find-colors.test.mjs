/**
 * Pruebas del detector de color crudo.
 *
 * Cubre los casos que el dueño pidió al aprobar V2.6.1: comentarios,
 * strings, template literals, CSS real, inline styles, variables CSS,
 * rgba() con alfa y color-mix(). Cada bloque nombra el punto ciego que
 * evita, no sólo lo que hace.
 *
 * Runner: `node --test` (viene con Node, sin dependencias nuevas).
 * Correr con:  npm run test:visual
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarColores } from './find-colors.mjs';
import { scan, conservarSolo } from './scan-source.mjs';

const textos = (hits) => hits.map((h) => h.texto);
const css = (s) => buscarColores(s, 'css');
const js = (s) => buscarColores(s, 'js');

// ── El falso negativo real: cuatro fases de cian neón invisibles ────────
test('CSS: detecta rgba() en una regla, que es el caso que se escapó', () => {
  const src = `.zulu-mark { filter: drop-shadow(0 0 7px rgba(0,224,255,0.24)); }`;
  assert.deepEqual(textos(css(src)), ['rgba(']);
});

test('CSS: rgba() con alfa en una sombra compuesta también cuenta', () => {
  const src = `.btn:hover { box-shadow: 0 0 0 3px var(--x), 0 0 14px rgba(0, 224, 255, 0.32); }`;
  assert.equal(css(src).length, 1);
});

test('CSS: hex en una regla que consume color', () => {
  assert.deepEqual(textos(css(`.a { color: #B42318; }`)), ['#B42318']);
});

// ── La regla de fondo: los literales viven en la capa de tokens ─────────
test('CSS: declarar una custom property con un literal está permitido', () => {
  const src = `:root { --zulu-danger: #B42318; --accent-dim: rgba(0,224,255,0.10); }`;
  assert.deepEqual(css(src), []);
});

test('CSS: la exención es sólo para la declaración, no para el resto', () => {
  const src = `:root { --ok: #B42318; }\n.mal { background: #B42318; }`;
  const hits = css(src);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 2, 'debe señalar la regla, no la declaración');
});

test('CSS: una declaración multilínea sigue siendo declaración', () => {
  const src = `:root {\n  --grad:\n    rgba(0,0,0,0.2);\n}`;
  assert.deepEqual(css(src), []);
});

test('CSS: var() con fallback de color crudo NO se exime', () => {
  // Es el caso de V2.3: el fallback pinta de verdad si el token falta.
  const src = `.a { color: var(--tok, #ff6b6b); }`;
  assert.deepEqual(textos(css(src)), ['#ff6b6b']);
});

// ── Comentarios: el falso positivo que hacía reescribir la prosa ────────
test('CSS: un comentario que documenta un hex no dispara', () => {
  const src = `/* Antes eran #ff6b6b y #f87171 -- ver valores-v25. */\n.a { color: var(--danger); }`;
  assert.deepEqual(css(src), []);
});

test('CSS: un comentario con rgba() tampoco dispara', () => {
  assert.deepEqual(css(`/* usaba rgba(255,255,255,0.06) */ .a { color: var(--x); }`), []);
});

test('JS: comentario de línea y de bloque quedan afuera', () => {
  const src = [
    `// el toast.error daba #B42318 sobre #261a1a`,
    `/* y rgba(22,10,10,0.93) de fondo */`,
    `export const x = 1`,
  ].join('\n');
  assert.deepEqual(js(src), []);
});

test('JS: código después de un comentario sigue analizándose', () => {
  const src = `// ojo: #ffffff acá es prosa\nconst c = '#ff0000'`;
  assert.deepEqual(textos(js(src)), ['#ff0000']);
});

// ── Strings y plantillas en TSX ─────────────────────────────────────────
test('JS: un color en un string SÍ cuenta -- ahí es donde pinta', () => {
  assert.deepEqual(textos(js(`<div style={{ color: '#fff' }} />`)), ['#fff']);
});

test('JS: color dentro de un template literal', () => {
  assert.deepEqual(textos(js('const s = `1px solid #D8D8D3`')), ['#D8D8D3']);
});

test('JS: plantilla anidada dentro de una interpolación', () => {
  const src = 'const s = `a ${cond ? `#123456` : ""} b`';
  assert.deepEqual(textos(js(src)), ['#123456']);
});

test('JS: la interpolación es código y se sigue analizando', () => {
  const src = 'const s = `x ${pinta("#abcdef")} y`';
  assert.deepEqual(textos(js(src)), ['#abcdef']);
});

test('JS: una plantilla no arrastra el resto del archivo', () => {
  const src = 'const a = `hola`\nconst b = "#010203"';
  assert.deepEqual(textos(js(src)), ['#010203']);
});

// ── Inline styles y variables CSS desde TSX ─────────────────────────────
test('JS: inline style con rgba() cuenta', () => {
  assert.deepEqual(textos(js(`<div style={{ background: 'rgba(17,17,17,0.5)' }} />`)), ['rgba(']);
});

test('JS: declarar una variable CSS inline está permitido', () => {
  assert.deepEqual(js(`<div style={{ '--zulu-x': '#B8892E' }} />`), []);
});

test('JS: usar var() en inline style no dispara', () => {
  assert.deepEqual(js(`<div style={{ color: 'var(--zulu-danger)' }} />`), []);
});

// ── Exclusión explícita: texto para una persona, no un valor de CSS ─────
test('JS: un placeholder con "#123" no es un color', () => {
  assert.deepEqual(js(`<input placeholder="Ej: OC #123, referencia interna" />`), []);
});

test('JS: la exclusión no tapa el resto de la línea', () => {
  const src = `<input placeholder="Ej: OC #123" style={{ color: '#ff0000' }} />`;
  assert.deepEqual(textos(js(src)), ['#ff0000']);
});

test('JS: un valor arbitrario de Tailwind en className SÍ cuenta', () => {
  assert.deepEqual(textos(js(`<div className="bg-[#1a1d27] p-4" />`)), ['#1a1d27']);
});

// ── Formatos que el repo todavía no usa, pero que no deben ser un hueco ─
test('color-mix() se detecta aunque hoy no aparezca en el repo', () => {
  assert.deepEqual(textos(css(`.a { color: color-mix(in srgb, red, blue); }`)), ['color-mix(']);
});

test('hsl(), hsla(), oklch() y hwb() se detectan', () => {
  const src = `.a{color:hsl(1,2%,3%)}.b{color:hsla(1,2%,3%,.4)}.c{color:oklch(.5 .1 20)}.d{color:hwb(1 2% 3%)}`;
  assert.equal(css(src).length, 4);
});

// ── Precisión: no inventar matches ──────────────────────────────────────
test('no confunde un id de CSS ni una entidad con un hex', () => {
  assert.deepEqual(css(`#app { color: var(--x); }`), []);
});

test('no toma un hex de 5 dígitos como color de 3 o 4', () => {
  assert.deepEqual(css(`.a { content: var(--x); } /* #abcde */`), []);
});

test('reporta la línea real del archivo, no la del texto filtrado', () => {
  const src = `/* comentario\n   largo\n   de tres líneas */\n.a { color: #123456; }`;
  assert.equal(css(src)[0].line, 4);
});

// ── El escáner en sí ────────────────────────────────────────────────────
test('scan: una división no se confunde con un regex', () => {
  const regiones = scan('const r = (a) / 2 // fin', 'js');
  assert.equal(regiones.filter((r) => r.type === 'comment').length, 1);
});

test('scan: un // adentro de un regex no abre un comentario', () => {
  const src = 'const re = /https:\\/\\/x/; const c = "#aabbcc"';
  assert.deepEqual(textos(js(src)), ['#aabbcc']);
});

test('conservarSolo no mueve las posiciones', () => {
  const src = `/* xx */\n.a { color: #123456; }`;
  assert.equal(conservarSolo(src, 'css', ['code']).length, src.length);
});

test('en CSS un color adentro de un string es texto, no color', () => {
  assert.deepEqual(css(`.a::after { content: "#ff0000"; }`), []);
});
