'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { customerAccountApi, extractErrorMessage, type ApiErrorWithStatus } from '@/lib/customerApi'

export default function MiCuentaPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params?.businessSlug as string
  const { clearSession } = useCustomerAuth()

  const [account, setAccount] = useState<{ id: string; fullName: string; email: string } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    customerAccountApi.me()
      .then(setAccount)
      .catch(err => setError(extractErrorMessage(err)))
  }, [])

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await customerAccountApi.deleteAccount()
      finishDeletion()
    } catch (err: unknown) {
      const e = err as ApiErrorWithStatus
      // La cuenta ya estaba eliminada u ya no existe — desde la perspectiva
      // del usuario, el resultado deseado (quedar deslogueado) es el mismo.
      if (e.code === 'ALREADY_DELETED' || e.code === 'NOT_FOUND') {
        finishDeletion()
      } else {
        setError(extractErrorMessage(err))
        setConfirmOpen(false)
        setDeleting(false)
      }
    }
  }

  function finishDeletion() {
    clearSession()
    router.replace(`/portal/${slug}/login`)
  }

  return (
    <div className="page-content" style={{ maxWidth: '32rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi cuenta</h1>
          <p className="page-subtitle">Tus datos de cliente</p>
        </div>
      </div>

      {error && <div className="alert alert-danger mb-6">{error}</div>}

      {account && (
        <div className="card p-5 space-y-4 mb-6">
          <div>
            <div className="label">Nombre</div>
            <div className="text-sm">{account.fullName}</div>
          </div>
          <div>
            <div className="label">Email</div>
            <div className="text-sm">{account.email}</div>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Eliminar mi cuenta</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
          Esta acción es irreversible desde tu lado: perdés el acceso y no vas a poder volver a iniciar sesión con este email.
        </p>
        <button onClick={() => setConfirmOpen(true)} className="btn-danger">Eliminar mi cuenta</button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Eliminar cuenta"
        description="¿Seguro que querés eliminar tu cuenta? No vas a poder deshacer esta acción."
        confirmLabel="Sí, eliminar"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
