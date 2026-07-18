import { useEffect, useState } from 'react';
import { api, ApiError, type ResourceDto } from '../lib/api';

interface AvailabilityResult {
  resourceId: string;
  available: boolean;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Resources() {
  const [resources, setResources] = useState<ResourceDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const [range, setRange] = useState(() => {
    const now = new Date();
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return { start: toLocalInput(now), end: toLocalInput(later) };
  });

  useEffect(() => {
    api.get<ResourceDto[]>('/api/resources')
      .then(setResources)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los recursos.'));
  }, []);

  async function checkAvailability(resourceId: string) {
    setChecking(resourceId);
    setResult(null);
    setError(null);
    try {
      const startTime = new Date(range.start).toISOString();
      const endTime = new Date(range.end).toISOString();
      const res = await api.get<AvailabilityResult>(
        `/api/resources/${resourceId}/availability?startTime=${startTime}&endTime=${endTime}`,
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo verificar disponibilidad.');
    } finally {
      setChecking(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Recursos</h1>
          <p>Cabañas, mesas, spa y tours disponibles para reservar</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="toolbar">
        <div className="field" style={{ margin: 0 }}>
          <label>Verificar disponibilidad desde</label>
          <input
            type="datetime-local"
            value={range.start}
            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
          />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Hasta</label>
          <input
            type="datetime-local"
            value={range.end}
            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
          />
        </div>
      </div>

      {resources === null ? (
        <div className="empty-state">Cargando…</div>
      ) : resources.length === 0 ? (
        <div className="empty-state">No hay recursos cargados todavía.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio base</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="mono">{r.categoryId}</td>
                  <td>${r.basePrice.toLocaleString('es-AR')}</td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={checking === r.id}
                      onClick={() => void checkAvailability(r.id)}
                    >
                      {checking === r.id ? 'Verificando…' : 'Ver disponibilidad'}
                    </button>
                  </td>
                  <td>
                    {result?.resourceId === r.id && (
                      <span className={`badge ${result.available ? 'badge-confirmed' : 'badge-cancelled'}`}>
                        {result.available ? 'Disponible' : 'Ocupado'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
