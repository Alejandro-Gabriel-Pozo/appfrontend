/**
 * Prueba de la exclusión de `*.test.ts`/`*.test.tsx` de la regla
 * "color crudo en pantallas" — ver `es-pantalla-visual.mjs` para el porqué.
 *
 * Runner: `node --test` (viene con Node, sin dependencias nuevas).
 * Correr con:  npm run test:visual
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esPantallaVisual } from './es-pantalla-visual.mjs';

test('.tsx y .ts de aplicación cuentan como pantalla', () => {
  assert.equal(esPantallaVisual('src/app/dashboard/page.tsx'), true);
  assert.equal(esPantallaVisual('src/lib/business-context/numero-operativo.ts'), true);
});

test('.test.ts y .test.tsx NO cuentan — un test no renderiza ni pinta nada', () => {
  assert.equal(esPantallaVisual('src/lib/business-context/numero-operativo.test.ts'), false);
  assert.equal(esPantallaVisual('src/lib/apiErrors.test.ts'), false);
  assert.equal(esPantallaVisual('src/app/dashboard/page.test.tsx'), false);
});

test('otras extensiones quedan afuera, como antes', () => {
  assert.equal(esPantallaVisual('src/app/globals.css'), false);
  assert.equal(esPantallaVisual('src/lib/business-context/sources.mjs'), false);
});
