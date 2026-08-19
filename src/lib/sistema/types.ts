// ─── Salud del outbox (dead-letter, A9.5/A8.7 — 15/08/2026) ──────────────────
export interface DeadLetterEvent {
  id: number
  eventType: string
  aggregateType: string
  aggregateId: string
  occurredAt: string
  failedAt: string
  retryCount: number
  lastError: string | null
}
