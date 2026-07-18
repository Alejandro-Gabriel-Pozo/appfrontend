import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type ReservationDto, type ResourceDto } from '../lib/api';
import { useAuth } from '../lib/auth';
import { StatusBadge } from '../components/StatusBadge';

const MANAGER_ROLES = ['ADMIN', 'RECEPTIONIST'];

export function Reservations() {
  const { user } = useAuth();
  const canManage = user ? MANAGER_ROLES.includes(user.role) : false;

  const [reservations, setReservations] = useState<ReservationDto[] | null>(null);
  const [resources, setResources] = useState<ResourceDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function loadReservations() {
    try {
      const data = await api.get<ReservationDto[]>('/api/reservations');
      setReservations(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las reservas.');
    }
  }

  useEffect(() => {
    void loadReservations();
    api.get<ResourceDto[]>('/api/resources').then(setResources).catch(() => undefined);
  }, []);

  async function runAction(id: string, action: 'confirm' | 'cancel' | 'complete') {
    setBusyId(id);
    setError(null);
    try {
      await api.post<ReservationDto>(`/api/reservations/${id}/${action}`);
      await loadReservations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Reservas</h1>
          <p>Gestioná el ciclo de vida de cada reserva</p>
        </div>
        {canManage && (
          <button className="btn" onClick={() => setShowModal(true)}>
            Nueva reserva
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        {reservations === null ? (
          <div className="empty-state">Cargando…</div>
        ) : reservations.length === 0 ? (
          <div className="empty-state">Todavía no hay reservas cargadas.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Recurso</th>
                <th>Cliente</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id}>
                  <td>{r.resource.name}</td>
                  <td>
                    {r.customer.fullName}
                    <div className="mono" style={{ fontSize: 11 }}>{r.customer.email}</div>
                  </td>
                  <td className="mono">{new Date(r.startTime).toLocaleString('es-AR')}</td>
                  <td className="mono">{new Date(r.endTime).toLocaleString('es-AR')}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {canManage && r.status === 'PENDING' && (
                        <button className="btn btn-sm" disabled={busyId === r.id} onClick={() => void runAction(r.id, 'confirm')}>
                          Confirmar
                        </button>
                      )}
                      {(r.status === 'CONFIRMED') && (
                        <button className="btn btn-sm" disabled={busyId === r.id} onClick={() => void runAction(r.id, 'complete')}>
                          Completar
                        </button>
                      )}
                      {canManage && (r.status === 'PENDING' || r.status === 'CONFIRMED') && (
                        <button className="btn btn-sm btn-danger" disabled={busyId === r.id} onClick={() => void runAction(r.id, 'cancel')}>
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <NewReservationModal
          resources={resources}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); void loadReservations(); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: nueva reserva
// ---------------------------------------------------------------------------

interface NewReservationModalProps {
  resources: ResourceDto[];
  onClose: () => void;
  onCreated: () => void;
}

function NewReservationModal({ resources, onClose, onCreated }: NewReservationModalProps) {
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? '');
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('new');
  const [customerId, setCustomerId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [details, setDetails] = useState('{}');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function ensureCustomer(): Promise<{ id: string; fullName: string; email: string }> {
    if (customerMode === 'existing') {
      if (!customerId.trim()) throw new Error('Ingresá el ID del cliente existente.');
      if (!fullName.trim() || !email.trim()) {
        throw new Error('Completá nombre y email del cliente (la API los requiere aunque el ID ya exista).');
      }
      return { id: customerId.trim(), fullName: fullName.trim(), email: email.trim() };
    }
    // Cliente nuevo — se crea vía el registro público con una contraseña temporal.
    // El cliente puede cambiarla después iniciando sesión en el portal propio.
    const tempPassword = `Temp-${Math.random().toString(36).slice(2, 10)}!`;
    const result = await api.post<{ customer: { id: string; fullName: string; email: string } }>(
      '/api/customer/register',
      { fullName: fullName.trim(), email: email.trim(), password: tempPassword },
    );
    return result.customer;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!resourceId) { setError('Seleccioná un recurso.'); return; }
    if (!start || !end) { setError('Completá el rango de fechas.'); return; }

    let parsedDetails: Record<string, unknown>;
    try {
      parsedDetails = details.trim() ? JSON.parse(details) : {};
    } catch {
      setError('El campo "detalles" debe ser JSON válido, ej: {}');
      return;
    }

    setSubmitting(true);
    try {
      const customer = await ensureCustomer();
      await api.post('/api/reservations', {
        resourceId,
        customer,
        startTime: new Date(start).toISOString(),
        endTime: new Date(end).toISOString(),
        details: parsedDetails,
      });
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError('No se pudo crear la reserva.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nueva reserva</h2>
        <p className="modal-sub">Completá los datos del recurso, cliente y horario.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Recurso</label>
            <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} required>
              <option value="" disabled>Elegí un recurso</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>{r.name} — {r.categoryId}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Cliente</label>
            <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, fontSize: 13 }}>
                <input type="radio" checked={customerMode === 'new'} onChange={() => setCustomerMode('new')} />
                Cliente nuevo
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, fontSize: 13 }}>
                <input type="radio" checked={customerMode === 'existing'} onChange={() => setCustomerMode('existing')} />
                Ya existe (tengo el ID)
              </label>
            </div>
          </div>

          {customerMode === 'existing' && (
            <div className="field">
              <label>ID del cliente</label>
              <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="cust-..." required />
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label>Nombre completo</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Inicio</label>
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
            </div>
            <div className="field">
              <label>Fin</label>
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
            </div>
          </div>

          <div className="field">
            <label>Detalles (JSON, opcional según categoría)</label>
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} spellCheck={false} />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
