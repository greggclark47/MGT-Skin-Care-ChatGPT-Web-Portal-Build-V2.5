import { randomUUID } from 'node:crypto';
import type { Store } from '../../portal/store';
import type { AntiAgingAiFeedback, AntiAgingAiTelemetryEvent } from '@mgt/domain';

export interface AntiAgingAiTelemetry {
  recordEvent(event: AntiAgingAiTelemetryEvent, actor: string): Promise<void>;
  recordFeedback(feedback: AntiAgingAiFeedback, actor: string): Promise<void>;
}
export class StoreAntiAgingAiTelemetry implements AntiAgingAiTelemetry {
  constructor(private readonly store: Store) {}
  async recordEvent(event: AntiAgingAiTelemetryEvent, actor: string) {
    await this.store.tx(records => records.put('anti_aging_ai_events', randomUUID(), { ...event, actor }));
  }
  async recordFeedback(feedback: AntiAgingAiFeedback, actor: string) {
    await this.store.tx(records => records.put('anti_aging_ai_feedback', randomUUID(), { ...feedback, actor }));
  }
}

export class NoopAntiAgingAiTelemetry implements AntiAgingAiTelemetry {
  async recordEvent(_event: AntiAgingAiTelemetryEvent, _actor: string) {}
  async recordFeedback(_feedback: AntiAgingAiFeedback, _actor: string) {}
}
