'use client'
import { useState } from 'react'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'

/**
 * Modal real dentro del banco — V2.6.2b.
 *
 * Pedido del dueño al aprobar V2.6.2a: "el banco debe renderizar por lo
 * menos un modal real y uno de cada primitive que utilice el overlay".
 *
 * Usa los componentes de producción, no una copia: `Modal` trae el scrim,
 * Escape, click afuera y el bloqueo de scroll; `ConfirmDialog` agrega la
 * acción destructiva, que es donde hay que ver que el `danger` del botón NO
 * se confunda con el velo del fondo -- el scrim es neutro a propósito.
 *
 * El banco es la única forma de abrir un modal sin sesión: los 15 modales
 * escritos a mano viven en pantallas del dashboard, detrás del login.
 */
export default function BancoModal() {
  const [modal, setModal] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  return (
    <>
      <button className="btn btn-primary" onClick={() => setModal(true)}>
        Abrir modal
      </button>
      <button className="btn btn-danger" onClick={() => setConfirmar(true)}>
        Abrir confirmación destructiva
      </button>

      <Modal open={modal} onClose={() => setModal(false)} title="Modal de prueba">
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          El fondo usa <code>--zulu-scrim</code>. Antes eran dos valores
          distintos para lo mismo: navy al 45% en 15 modales escritos a mano y
          negro al 65% acá.
        </p>
        <input className="input" placeholder="Un campo, para ver el foco" />
      </Modal>

      <ConfirmDialog
        open={confirmar}
        onClose={() => setConfirmar(false)}
        onConfirm={() => setConfirmar(false)}
        title="Eliminar recurso"
        description="El scrim es neutro; el rojo es de la acción, no del fondo."
        confirmLabel="Eliminar"
        variant="danger"
      />
    </>
  )
}
