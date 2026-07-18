import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type ReservationDto, type ResourceDto } from '../lib/api';
import { useAuth } from '../lib/auth';
import { StatusBadge } from '../components/StatusBadge';

interface NewReservationForm {
  resourceId: string;
  customerName: string;
  customerEmail: string;
  startTime: string;
  endTime: string;
  details: string;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyForm(resources: ResourceDto[]): NewReservationForm {
  const now = new Date();
  const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return {
    resourceId: resources[0]?.id ?? '',
    customerName: '',
    customerEmail: '',
    startTime: toLocalInput(now),
    endTime: toLocalInput(later),
    details: '',
  };
}

export function Reservations() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RECEPTIONIST';

  const [reservations, setReservations] = useState<ReservationDto[] | null>(null);
  const [resources, setResources] = useState<ResourceDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewReservationForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<ReservationDto[]>('/api/reservations'),
      api.get<ResourceDto[]>('/api/resources'),
    ]).then(([reservs, res]) => {
      if (cancelled) return;
      setReservations(reservs);
      setResources(res);
    }).catch((err) => {
      if (!cancelled) setError(err instanceof ApiError ? err.message : 'No se pudo cargar.');
    });
    return () => { cancelled = true; };
  }, []);

  async function updateStatus(id: string, status: string) {
    try {
      await api.patch(`/api/reservations/${id}`, { status });
      setReservations((prev) => prev?.map((r) => r.id === id ? { ...r, status: status as ReservationDto['status'] } : r) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar.');
    }
  }

  function openModal() {
    setForm(emptyForm(resources));
    setFormError(null);
    setShowModal(true);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError(null);
    try {
      const body = {
        resourceId: form.resourceId,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        details: form.details ? JSON.parse(form.details) : {},
      };
      const created = await api.post<ReservationDto>('/api/reservations', body);
      setReservations((prev) => [created, ...(prev ?? [])]);
      setShowModal(false);
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : err instanceof SyntaxError
          ? 'El campo Detalles debe ser JSON válido o estar vacío.'
          : 'No se pudo crear la reserva.',
      );
    } finally {
      setSaving(false);
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
          <button className="btn" onClick={openModal}>+ Nueva reserva</button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {reservations === null ? (
        <div className="empty-state">Cargando…</div>
      ) : reservations.length === 0 ? (
        <div className="empty-state">No hay reservas todavía.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Recurso</th>
                <th>Cliente</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Estado</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id}>
                  <td>{r.resource.name}</td>
                  <td>
                    <div>{r.customer.fullName}</div>
                    <div className="mono">{r.customer.email}</div>
                  </td>
                  <td className="mono">{new Date(r.startTime).toLocaleString('es-AR')}</td>
                  <td className="mono">{new Date(r.endTime).toLocaleString('es-AR')}</td>
                  <td><StatusBadge status={r.status} /></td>
                  {canManage && (
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {r.status === 'PENDING' && (
                        <button className="btn btn-sm" onClick={() => void updateStatus(r.id, 'CONFIRMED')}>Confirmar</button>
                      )}
                      {r.status === 'CONFIRMED' && (
                        <button className="btn btn-sm" onClick={() => void updateStatus(r.id, 'COMPLETED')}>Completar</button>
                      )}
                      {(r.status === 'PENDING' || r.status === 'CONFIRMED') && (
                        <button className="btn btn-danger btn-sm" onClick={() => void updateStatus(r.id, 'CANCELLED')}>Cancelar</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && form && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nueva reserva</h2>
            <p className="modal-sub">Completá los datos del recurso, cliente y horario.</p>
            {formError && <div className="alert alert-error">{formError}</div>}
            <form onSubmit={handleCreate}>
              <div className="field">
                <label>Recurso</label>
                <select value={form.resourceId} onChange={(e) => setForm({ ...form, resourceId: e.target.value })} required>
                  {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Nombre del cliente</label>
                  <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Email del cliente</label>
                  <input type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} required />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Inicio</label>
                  <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
                </div>
                <div className="field">
                  <label>Fin</label>
                  <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
                </div>
              </div>
              <div className="field">
                <label>Detalles (JSON, opcional)</label>
                <textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder='{"guests": 2}' />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn" disabled={saving}>{saving ? 'Guardando…' : 'Crear reserva'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
