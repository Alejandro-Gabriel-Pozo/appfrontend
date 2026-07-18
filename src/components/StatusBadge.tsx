import type { ReservationStatus } from '../lib/api';

const LABELS: Record<ReservationStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
};

const CLASSES: Record<ReservationStatus, string> = {
  PENDING: 'badge-pending',
  CONFIRMED: 'badge-confirmed',
  CANCELLED: 'badge-cancelled',
  COMPLETED: 'badge-completed',
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return <span className={`badge ${CLASSES[status]}`}>{LABELS[status]}</span>;
}
