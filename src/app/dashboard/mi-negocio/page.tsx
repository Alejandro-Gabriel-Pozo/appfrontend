'use client'
import { useState, useEffect, useCallback } from 'react'
import { businessHoursApi, businessProfileApi, afipCredentialsApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { OperatingWindow, AfipCredentialsStatus } from '@/lib/types'

// ─── Sistema de diseño "Bastión" (docs/sistema-diseno-bastion.md) ────────────
// Sin módulo propio — acento brass por defecto (sección 6 del doc).

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Identidad del negocio (punto 5/E5, 15/08/2026): nombre + contacto que ve
// el cliente en el mail de reserva confirmada, en vez de un remitente
// genérico de la plataforma (A2.9 — esto es config por tenant).
function BusinessIdentitySection() {
  const { toast } = useToast()
  const [displayName, setDisplayName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  // HH:MM — el input type="time" no quiere segundos; el backend acepta
  // HH:MM o HH:MM:SS (timeOnly, request.schemas.ts), así que no hace falta
  // agregarlos acá.
  const [checkInTime, setCheckInTime] = useState('14:00')
  const [checkOutTime, setCheckOutTime] = useState('11:00')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const profile = await businessProfileApi.get()
        setDisplayName(profile.displayName ?? '')
        setContactEmail(profile.contactEmail ?? '')
        setCheckInTime(profile.defaultCheckInTime.slice(0, 5))
        setCheckOutTime(profile.defaultCheckOutTime.slice(0, 5))
      } catch (err) {
        toast(extractErrorMessage(err), 'error')
      } finally {
        setLoading(false)
      }
    })
  }, [toast])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await businessProfileApi.update({
        displayName: displayName.trim() || null,
        contactEmail: contactEmail.trim() || null,
        defaultCheckInTime: checkInTime,
        defaultCheckOutTime: checkOutTime,
      })
      toast('Identidad del negocio guardada', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card p-4 h-32 skeleton" />

  return (
    <div className="card p-4">
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Identidad del negocio</p>
      <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
        Así se identifica tu negocio en los mails que reciben tus clientes (ej. confirmación de reserva).
      </p>
      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="label">Nombre para mostrar</label>
          <input
            type="text" className="input" value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Ej. Hotel Los Álamos"
          />
        </div>
        <div>
          <label className="label">Email de contacto (reply-to)</label>
          <input
            type="email" className="input" value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
            placeholder="contacto@tunegocio.com"
          />
        </div>
        <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex-1">
            <label className="label">Check-in estándar</label>
            <input
              type="time" className="input" value={checkInTime}
              onChange={e => setCheckInTime(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            <label className="label">Check-out estándar</label>
            <input
              type="time" className="input" value={checkOutTime}
              onChange={e => setCheckOutTime(e.target.value)}
              required
            />
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Hora de pared que usan Reservas/Estadías por defecto. Un huésped puede pedir
          un horario distinto (early check-in / late check-out) desde el detalle de su
          reserva — queda pendiente de aprobación de recepción.
        </p>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <span className="spinner" /> : 'Guardar'}
        </button>
      </form>
    </div>
  )
}

// Perfil fiscal del negocio EMISOR (19/08/2026, Facturación Electrónica AFIP
// Fase 1 -- app-main/docs/pendientes-2026-08-18.md punto P). Todo opcional:
// sin esto cargado no se puede emitir un comprobante AFIP, pero el resto del
// sistema sigue funcionando igual (reservas, POS, etc.) sin depender de ello.
function FiscalProfileSection() {
  const { toast } = useToast()
  const [legalName, setLegalName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [taxIdType, setTaxIdType] = useState('')
  const [taxCondition, setTaxCondition] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressState, setAddressState] = useState('')
  const [addressPostalCode, setAddressPostalCode] = useState('')
  const [addressCountry, setAddressCountry] = useState('')
  const [salesPoint, setSalesPoint] = useState<number | ''>('')
  const [ivaRate, setIvaRate] = useState<number | ''>(21)
  const [pricesIncludeIva, setPricesIncludeIva] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const profile = await businessProfileApi.get()
        setLegalName(profile.legalName ?? '')
        setTaxId(profile.taxId ?? '')
        setTaxIdType(profile.taxIdType ?? '')
        setTaxCondition(profile.taxCondition ?? '')
        setAddressLine1(profile.fiscalAddressLine1 ?? '')
        setAddressCity(profile.fiscalAddressCity ?? '')
        setAddressState(profile.fiscalAddressState ?? '')
        setAddressPostalCode(profile.fiscalAddressPostalCode ?? '')
        setAddressCountry(profile.fiscalAddressCountry ?? '')
        setSalesPoint(profile.afipSalesPoint ?? '')
        setIvaRate(profile.defaultIvaRate)
        setPricesIncludeIva(profile.pricesIncludeIva)
      } catch (err) {
        toast(extractErrorMessage(err), 'error')
      } finally {
        setLoading(false)
      }
    })
  }, [toast])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await businessProfileApi.update({
        legalName: legalName.trim() || null,
        taxId: taxId.trim() || null,
        taxIdType: taxIdType.trim() || null,
        taxCondition: taxCondition.trim() || null,
        fiscalAddressLine1: addressLine1.trim() || null,
        fiscalAddressCity: addressCity.trim() || null,
        fiscalAddressState: addressState.trim() || null,
        fiscalAddressPostalCode: addressPostalCode.trim() || null,
        fiscalAddressCountry: addressCountry.trim() || null,
        afipSalesPoint: salesPoint === '' ? null : salesPoint,
        defaultIvaRate: ivaRate === '' ? 0 : ivaRate,
        pricesIncludeIva,
      })
      toast('Datos fiscales guardados', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card p-4 h-32 skeleton" />

  return (
    <div className="card p-4">
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Datos fiscales (AFIP)</p>
      <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
        Necesarios para emitir comprobantes electrónicos AFIP. Sin esto cargado, el resto
        del sistema sigue funcionando normalmente.
      </p>
      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="label">Razón social</label>
          <input
            type="text" className="input" value={legalName}
            onChange={e => setLegalName(e.target.value)}
            placeholder="Ej. Hotel Los Álamos SRL"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="label">CUIT</label>
            <input
              type="text" className="input" value={taxId}
              onChange={e => setTaxId(e.target.value)}
              placeholder="20-XXXXXXXX-X"
            />
          </div>
          <div className="flex-1">
            <label className="label">Tipo de documento</label>
            <input
              type="text" className="input" value={taxIdType}
              onChange={e => setTaxIdType(e.target.value)}
              placeholder="CUIT"
            />
          </div>
        </div>
        <div>
          <label className="label">Condición frente al IVA</label>
          <input
            type="text" className="input" value={taxCondition}
            onChange={e => setTaxCondition(e.target.value)}
            placeholder="Responsable Inscripto"
          />
        </div>
        <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <label className="label">Domicilio fiscal</label>
          <input
            type="text" className="input mb-2" value={addressLine1}
            onChange={e => setAddressLine1(e.target.value)}
            placeholder="Calle y número"
          />
          <div className="flex gap-2">
            <input
              type="text" className="input" value={addressCity}
              onChange={e => setAddressCity(e.target.value)}
              placeholder="Localidad"
            />
            <input
              type="text" className="input" value={addressState}
              onChange={e => setAddressState(e.target.value)}
              placeholder="Provincia"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <input
              type="text" className="input" value={addressPostalCode}
              onChange={e => setAddressPostalCode(e.target.value)}
              placeholder="Código postal"
            />
            <input
              type="text" className="input" value={addressCountry} maxLength={2}
              onChange={e => setAddressCountry(e.target.value.toUpperCase())}
              placeholder="AR"
              style={{ maxWidth: '5rem' }}
            />
          </div>
        </div>
        <div>
          <label className="label">Punto de venta AFIP</label>
          <input
            type="number" className="input" min={1} value={salesPoint}
            onChange={e => setSalesPoint(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="1"
            style={{ maxWidth: '8rem' }}
          />
        </div>
        <div className="flex gap-3 items-end pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div>
            <label className="label">IVA general (%)</label>
            <input
              type="number" className="input" min={0} max={100} step="0.01" value={ivaRate}
              onChange={e => setIvaRate(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ maxWidth: '8rem' }}
            />
          </div>
          <label className="flex items-center gap-2 text-xs pb-2" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={pricesIncludeIva} onChange={e => setPricesIncludeIva(e.target.checked)} />
            Los precios ya incluyen IVA
          </label>
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <span className="spinner" /> : 'Guardar'}
        </button>
      </form>
    </div>
  )
}

// Certificado AFIP (19/08/2026, Fase 2 -- conexión real WSAA/WSFEv1). El
// cert/clave nunca vuelven del backend una vez guardados (repositorio
// cifrado, endpoint de status solo expone configured/environment) -- por
// eso acá no hay "cargar valores existentes" en los textareas, solo un
// indicador de estado y la posibilidad de reemplazar o borrar.
function AfipCertificateSection() {
  const { toast } = useToast()
  const [status, setStatus] = useState<AfipCredentialsStatus | null>(null)
  const [notEnabled, setNotEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cert, setCert] = useState('')
  const [key, setKey] = useState('')
  const [environment, setEnvironment] = useState<'homologacion' | 'produccion'>('homologacion')

  // CUIT de autenticación AFIP (schema v25) -- distinto de taxId ("Datos
  // fiscales") cuando AFIP exige un CUIT de testing ficticio para probar en
  // homologación. A diferencia del cert/clave, esto SÍ se puede releer
  // (no es un secreto), así que el input arranca con el valor ya cargado.
  const [afipCuit, setAfipCuit] = useState('')
  const [savingCuit, setSavingCuit] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [credStatus, profile] = await Promise.all([
        afipCredentialsApi.status(),
        businessProfileApi.get(),
      ])
      setStatus(credStatus)
      setAfipCuit(profile.afipCuit ?? '')
      setNotEnabled(false)
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'MODULE_NOT_ENABLED') {
        setNotEnabled(true)
      } else {
        toast(extractErrorMessage(err), 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  async function handleSaveCuit(e: React.FormEvent) {
    e.preventDefault()
    setSavingCuit(true)
    try {
      await businessProfileApi.update({ afipCuit: afipCuit.trim() || null })
      toast(afipCuit.trim() ? 'CUIT de autenticación AFIP guardado' : 'CUIT de autenticación AFIP borrado -- se vuelve a usar el CUIT legal', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSavingCuit(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const result = await afipCredentialsApi.save({ cert, key, environment })
      setStatus(result)
      setCert('')
      setKey('')
      toast('Certificado AFIP guardado', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!confirm('¿Borrar el certificado AFIP cargado? No vas a poder emitir comprobantes hasta cargar uno nuevo.')) return
    try {
      await afipCredentialsApi.clear()
      setStatus({ configured: false, environment: null })
      toast('Certificado AFIP borrado', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  if (loading) return <div className="card p-4 h-32 skeleton" />

  if (notEnabled) {
    return (
      <div className="card p-4">
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Certificado AFIP</p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          El módulo de Facturación Electrónica no está habilitado para este negocio.
        </p>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Certificado AFIP</p>
        {status?.configured && (
          <span className="badge-confirmed">
            Configurado ({status.environment === 'produccion' ? 'producción' : 'homologación'})
          </span>
        )}
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
        Certificado (.crt) y clave privada (.key) del par que generaste junto al CSR y
        presentaste en AFIP. Se guardan cifrados — una vez cargados no se pueden volver
        a ver, solo reemplazar o borrar.
      </p>
      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="label">Ambiente</label>
          <select
            className="input" value={environment}
            onChange={e => setEnvironment(e.target.value as 'homologacion' | 'produccion')}
          >
            <option value="homologacion">Homologación (pruebas)</option>
            <option value="produccion">Producción</option>
          </select>
        </div>
        <div>
          <label className="label">Certificado (.crt)</label>
          <textarea
            className="input" rows={4} value={cert}
            onChange={e => setCert(e.target.value)}
            placeholder="-----BEGIN CERTIFICATE-----"
            style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
          />
        </div>
        <div>
          <label className="label">Clave privada (.key)</label>
          <textarea
            className="input" rows={4} value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="-----BEGIN PRIVATE KEY-----"
            style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving || !cert.trim() || !key.trim()} className="btn-primary">
            {saving ? <span className="spinner" /> : status?.configured ? 'Reemplazar' : 'Guardar'}
          </button>
          {status?.configured && (
            <button type="button" onClick={handleClear} className="btn-ghost">Borrar certificado</button>
          )}
        </div>
      </form>

      {/* CUIT de autenticación AFIP (schema v25) -- form aparte porque pega
          contra businessProfileApi, no afipCredentialsApi: no es un
          secreto, se puede releer y editar sin volver a cargar el cert. */}
      <form onSubmit={handleSaveCuit} className="space-y-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <div>
          <label className="label">CUIT de autenticación (opcional)</label>
          <input
            className="input" value={afipCuit}
            onChange={e => setAfipCuit(e.target.value)}
            placeholder="Vacío = usar el CUIT legal de Datos fiscales"
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Solo si necesitás autenticarte contra AFIP con un CUIT distinto
            al legal — ej. un CUIT de testing en homologación. No cambia
            &quot;Datos fiscales&quot;.
          </p>
        </div>
        <button type="submit" disabled={savingCuit} className="btn-secondary">
          {savingCuit ? <span className="spinner" /> : null}
          Guardar CUIT de autenticación
        </button>
      </form>
    </div>
  )
}

export default function MiNegocioPage() {
  const { toast } = useToast()
  const [windows, setWindows] = useState<OperatingWindow[]>([])
  const [loading, setLoading] = useState(true)
  const [addingDay, setAddingDay] = useState<number | null>(null)
  const [newStart, setNewStart] = useState('09:00')
  const [newEnd, setNewEnd] = useState('18:00')
  const [applyAllDays, setApplyAllDays] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setWindows(await businessHoursApi.list())
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  function openAdd(dayOfWeek: number) {
    setAddingDay(dayOfWeek)
    setNewStart('09:00')
    setNewEnd('18:00')
    setApplyAllDays(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (addingDay === null) return
    setSaving(true)
    try {
      const days = applyAllDays ? [0, 1, 2, 3, 4, 5, 6] : [addingDay]
      let created = 0
      let skipped = 0
      for (const dayOfWeek of days) {
        try {
          await businessHoursApi.create({ dayOfWeek, startTime: newStart, endTime: newEnd })
          created++
        } catch (err) {
          // OPERATING_WINDOW_OVERLAP en "aplicar a todos" — se salta ese día
          // (probablemente ya tiene franja) y se sigue con el resto, en vez
          // de abortar todo por un solo conflicto.
          if (applyAllDays) skipped++
          else throw err
        }
      }
      if (applyAllDays) {
        toast(
          skipped > 0
            ? `Franja aplicada a ${created} día${created === 1 ? '' : 's'} — ${skipped} ya tenía${skipped === 1 ? '' : 'n'} una franja que se superponía`
            : 'Franja aplicada a todos los días',
          'success',
        )
      } else {
        toast('Franja agregada', 'success')
      }
      setAddingDay(null)
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id: string) {
    try {
      await businessHoursApi.remove(id)
      setWindows(w => w.filter(x => x.id !== id))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  return (
    <div className={`bastion`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
    <div style={{ maxWidth: '40rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Mi Negocio</h1>
          <p className="page-subtitle">
            Horario de atención por defecto. Un recurso puntual (ej. un empleado) puede
            tener horario propio que reemplaza a este — se configura en Recursos.
          </p>
        </div>
      </div>

      <div className="mb-6">
        <BusinessIdentitySection />
      </div>

      <div className="mb-6">
        <FiscalProfileSection />
      </div>

      <div className="mb-6">
        <AfipCertificateSection />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(7)].map((_, i) => <div key={i} className="h-14 rounded-lg skeleton" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {DAYS.map((label, dayOfWeek) => {
            const dayWindows = windows.filter(w => w.dayOfWeek === dayOfWeek)
            return (
              <div key={dayOfWeek} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
                  <button onClick={() => openAdd(dayOfWeek)} className="btn-ghost text-xs">+ Agregar franja</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dayWindows.length === 0 && (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Cerrado</p>
                  )}
                  {dayWindows.map(w => (
                    <span key={w.id} className="badge-confirmed" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {w.startTime.slice(0, 5)}–{w.endTime.slice(0, 5)}
                      <button onClick={() => handleRemove(w.id)} aria-label="Quitar franja">×</button>
                    </span>
                  ))}
                </div>
                {addingDay === dayOfWeek && (
                  <form onSubmit={handleAdd} className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex items-end gap-2">
                      <div>
                        <label className="label">Desde</label>
                        <input type="time" className="input" value={newStart} onChange={e => setNewStart(e.target.value)} required />
                      </div>
                      <div>
                        <label className="label">Hasta</label>
                        <input type="time" className="input" value={newEnd} onChange={e => setNewEnd(e.target.value)} required />
                      </div>
                      <button type="submit" disabled={saving} className="btn-primary">
                        {saving ? <span className="spinner" /> : 'Guardar'}
                      </button>
                      <button type="button" onClick={() => setAddingDay(null)} className="btn-secondary">Cancelar</button>
                    </div>
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={applyAllDays} onChange={e => setApplyAllDays(e.target.checked)} />
                      Aplicar este horario a todos los días de la semana
                    </label>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
    </div>
  )
}
