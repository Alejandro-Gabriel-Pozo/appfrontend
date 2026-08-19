'use client'
import { apiFetch } from '../http'
import type { DeadLetterEvent } from './types'

export const systemApi = {
  getDeadLetter: () => apiFetch<{ count: number; events: DeadLetterEvent[] }>('/api/system/outbox/dead-letter'),
  retry: (id: number) => apiFetch<void>(`/api/system/outbox/${id}/retry`, { method: 'POST' }),
}
