/**
 * es-pantalla-visual.mjs — filtro de la regla "color crudo en pantallas".
 *
 * Extraído de `check-visual-debt.mjs` (01/09/2026) porque un test real —
 * `numero-operativo.test.ts`, que prueba el fallback `#123` de D6 — quedó
 * atrapado por el `isTsx` genérico: el escáner mira el TEXTO de los
 * strings a propósito (`find-colors.mjs`), y un string como `'#123'` es un
 * hex de 3 dígitos sintácticamente válido aunque no pinte nada.
 *
 * La regla se llama "en PANTALLAS": un `*.test.ts`/`*.test.tsx` no renderiza
 * y no puede pintar un color. Esta exclusión es SOLO de esta regla — las
 * demás (`.bastion` residual, `var(--accent)`, overlays) siguen mirando
 * `.ts`/`.tsx` sin filtrar, porque esas sí pueden aparecer en código que un
 * test importa o referencia legítimamente.
 */

/** `true` si el archivo es candidato a la regla de color crudo en pantallas. */
export function esPantallaVisual(rutaRelativa) {
  return (
    (rutaRelativa.endsWith('.tsx') || rutaRelativa.endsWith('.ts')) &&
    !rutaRelativa.endsWith('.test.ts') &&
    !rutaRelativa.endsWith('.test.tsx')
  );
}
