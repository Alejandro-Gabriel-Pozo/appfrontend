import { useEffect, useState } from 'react';
import { api, ApiError, type OccupancySummary, type ReservationDto, type ResourceDto } from '../lib/api';
import { useAuth } from '../lib/auth';
import { StatusBadge } from '../components/StatusBadge';

function last30Days(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

export function Dashboard() {
  const { user } = useAuth();
  const [resources, setResources] = useState<ResourceDto[] | null>(null);
  const [reservations, setReservations] = useState<ReservationDto[] | null>(null);
  const [summary, setSummary] = useState<OccupancySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [res, reservs] = await Promise.all([
          api.get<ResourceDto[]>('/api/resources'),
          api.get<ReservationDto[]>('/api/reservations'),
        ]);
        if (cancelled) return;
        setResources(res);
        setReservations(reservs);

        if (user?.role !== 'WAITER') {
          const { startDate, endDate } = last30Days();
          const s = await api.get<OccupancySummary>(
            `/api/reports/summary?startDate=${startDate}&endDate=${endDate}&limit=5`,
          );
          if (!cancelled) setSummary(s);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el panorama.');
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [user?.role]);

  const pending = reservations?.filter((r) => r.status === 'PENDING').length ?? 0;
  const confirmed = reservations?.filter((r) => r.status === 'CONFIRMED').length ?? 0;
  const recent = reservations?.slice(0, 6) ?? [];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Panorama</h1>
          <p>Estado general de recursos y reservas</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Recursos activos</div>
          <div className="kpi-value">{resources?.length ?? '—'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Reservas pendientes</div>
          <div className="kpi-value">{pending}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Reservas confirmadas</div>
          <div className="kpi-value">{confirmed}</div>
        </div>
        {summary && (
          <div className="kpi-card">
            <div className="kpi-label">Ocupación prom. (30d)</div>
            <div className="kpi-value">{summary.averageOccupancy.toFixed(0)}%</div>
          </div>
        )}
      </div>

      {summary && summary.topOccupied.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Más ocupados (30 días)</h2>
          {summary.topOccupied.map((s) => (
            <div key={s.resourceId} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 13 }}>{s.resourceName}</span>
              <div className="occupancy-bar" style={{ width: 120 }}>
                <div className="occupancy-bar-fill" style={{ width: `${s.occupancyRate}%` }} />
              </div>
              <span style={{ fontSize: 12, width: 36, textAlign: 'right' }}>{s.occupancyRate.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Reservas recientes</h2>
        {recent.length === 0 ? (
          <div className="empty-state">Todavía no hay reservas cargadas.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Recurso</th>
                <th>Cliente</th>
                <th>Inicio</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{r.resource.name}</td>
                  <td>{r.customer.fullName}</td>
                  <td className="mono">{new Date(r.startTime).toLocaleString('es-AR')}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
