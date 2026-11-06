import { randomUUID } from 'node:crypto';
import type { Store } from '../../portal/store';
import {isAntiAgingAiTask,isFeedbackRating,isFeedbackReason,type AntiAgingAiFeedback,type AntiAgingAiTelemetryEvent} from '@mgt/domain';

const bounded=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000\u007f]/.test(value);
const date=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const VALIDATIONS=['passed','blocked','citation_failed','schema_failed'] as const;

export function publicAntiAgingAiEvent(event:unknown):AntiAgingAiTelemetryEvent|null{
  if(!event||typeof event!=='object'||Array.isArray(event))return null;
  const value=event as Partial<AntiAgingAiTelemetryEvent>;
  const latency_ms=value.latency_ms,cost_cents=value.cost_cents,validation=value.validation;
  if(!bounded(value.response_id,200)||!isAntiAgingAiTask(value.task)||typeof latency_ms!=='number'||!Number.isInteger(latency_ms)||latency_ms<0||latency_ms>3600000||typeof cost_cents!=='number'||!Number.isFinite(cost_cents)||cost_cents<0||cost_cents>1000000||typeof validation!=='string'||!VALIDATIONS.includes(validation as typeof VALIDATIONS[number])||!date(value.created_at))return null;
  return{response_id:value.response_id,task:value.task,latency_ms,cost_cents,validation:validation as AntiAgingAiTelemetryEvent['validation'],created_at:value.created_at};
}

export function publicAntiAgingAiFeedback(feedback:unknown):AntiAgingAiFeedback|null{
  if(!feedback||typeof feedback!=='object'||Array.isArray(feedback))return null;
  const value=feedback as Partial<AntiAgingAiFeedback>;
  if(!bounded(value.response_id,200)||!isAntiAgingAiTask(value.task)||!isFeedbackRating(value.rating)||(value.reason!==undefined&&!isFeedbackReason(value.reason))||(value.comment!==undefined&&(typeof value.comment!=='string'||value.comment.length>500))||!date(value.created_at))return null;
  return{response_id:value.response_id,task:value.task,rating:value.rating,...(value.reason?{reason:value.reason}:{}),...(value.comment!==undefined?{comment:value.comment}:{}),created_at:value.created_at};
}

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
