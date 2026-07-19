'use client'
import { useState } from 'react'
import { customersApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { Customer } from '@/lib/types'

export default function ClientesPage() {
  const { toast } = useToast()

  // Búsqueda
  const [email, setEmail] = useState('')
  const [searching, setSearching] = useState(false)
  const [found, setFound] = useState<Customer | null | false>(false) // false = no buscado, null = no encontrado

  // Creación
  const [createForm, setCreateForm] = useState({ fullName: '', email: '' })
  const [creating, setCreating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearching(true)
    try {
      const result = await customersApi.findByEmail(email)
      setFound(result ?? null)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSearching(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const customer = await customersApi.create(createForm)
      toast(`Cliente "${customer.fullName}" creado`, 'success')
      setModalOpen(false)
      setCreateForm({ fullName: '', email: '' })
      // Si el email coincide con la búsqueda, actualizamos el resultado
      if (createForm.email === email) setFound(customer)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Clientes</h1>
          <p className="text-sm text-slate-400 mt-0.5">Buscá clientes por email o creá uno nuevo</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo cliente
        </button>
      </div>

      {/* Búsqueda por email */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-medium text-slate-300 mb-3">Buscar por email</h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="email"
            className="input flex-1"
            value={email}
            onChange={e => { setEmail(e.target.value); setFound(false) }}
            placeholder="cliente@email.com"
            required
          />
          <button type="submit" disabled={searching} className="btn-secondary shrink-0">
            {searching ? <span className="spinner" /> : 'Buscar'}
          </button>
        </form>

        {/* Resultado */}
        {found === null && (
          <div className="mt-4 flex items-center gap-3 p-4 rounded-lg bg-slate-800/50 border border-white/[0.06]">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <div>
              <p className="text-sm text-slate-300">No se encontró ningún cliente con ese email.</p>
              <button onClick={() => { setModalOpen(true); setCreateForm(f => ({ ...f, email })) }} className="text-xs text-emerald-400 hover:text-emerald-300 mt-1">
                ¿Querés crearlo?
              </button>
            </div>
          </div>
        )}

        {found && (
          <div className="mt-4 flex items-center gap-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">
              {found.fullName[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-white">{found.fullName}</p>
              <p className="text-sm text-slate-400">{found.email}</p>
              <p className="text-xs text-slate-600 mt-0.5 font-mono">{found.id}</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal crear cliente */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1d27] rounded-xl border border-white/[0.08] w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="font-semibold text-white">Nuevo cliente</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded text-slate-400 hover:text-white" aria-label="Cerrar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre completo</label>
                <input className="input" value={createForm.fullName} onChange={e => setCreateForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Juan García" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="juan@email.com" required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={creating} className="btn-primary flex-1">
                  {creating ? <span className="spinner" /> : null}
                  Crear cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
