import { useState, type FormEvent } from 'react';
import { api, ApiError, type OccupancyReportRow } from '../lib/api';

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function Occupancy() {
  const [range, setRange] = useState(defaultRange);
  const [rows, setRows] = useState<OccupancyReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runReport(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const startDate = new Date(`${range.start}T00:00:00`).toISOString();
      const endDate = new Date(`${range.end}T23:59:59`).toISOString();
      const data = await api.get<OccupancyReportRow[]>(
        `/api/reports/occupancy?startDate=${startDate}&endDate=${endDate}`,
      );
      setRows(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo generar el reporte.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Ocupación</h1>
          <p>Reporte diario de ocupación por recurso</p>
        </div>
      </div>

      <form className="toolbar" onSubmit={runReport}>
        <div className="field" style={{ margin: 0 }}>
          <label>Desde</label>
          <input type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} required />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Hasta</label>
          <input type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} required />
        </div>
        <button className="btn" disabled={loading}>
          {loading ? 'Generando…' : 'Generar reporte'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {rows !== null && (
        <div className="card">
          {rows.length === 0 ? (
            <div className="empty-state">Sin datos de ocupación en ese período.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Recurso</th>
                  <th>Ocupación</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="mono">{row.date}</td>
                    <td>{row.resourceName}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="occupancy-bar" style={{ width: 80 }}>
                          <div className="occupancy-bar-fill" style={{ width: `${row.occupancyRate}%` }} />
                        </div>
                        <span>{row.occupancyRate.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
