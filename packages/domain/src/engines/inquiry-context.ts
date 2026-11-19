export type InquiryRole = 'user';

export interface InquiryTurn { role: InquiryRole; text: string; }
export interface ConsolidatedInquiry {
  latest: string;
  turns: number;
  repeated: boolean;
  topics: string[];
  summary: string;
  routing_text: string;
}

const MAX_TURNS = 6;
const MAX_TURN_LENGTH = 600;
const TOPICS: Array<[string, RegExp]> = [
  ['account', /sign[ -]?in|profile|privacy|export|delete|account/i],
  ['routine', /routine|regimen|step|simplif|travel|sequence/i],
  ['products', /product|ingredient|serum|moistur|retailer|shop|buy/i],
  ['billing', /payment|billing|charge|invoice|subscription|membership/i],
  ['support', /help|portal|not working|question|problem/i],
];

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  return text.length >= 1 && text.length <= MAX_TURN_LENGTH ? text : null;
}

export function consolidateInquiry(latest: string, history: unknown): ConsolidatedInquiry {
  const current = clean(latest) || '';
  const prior = Array.isArray(history)
    ? history.map(item => typeof item === 'string' ? item : (item as { role?: unknown; text?: unknown })?.role === 'user' ? (item as { text?: unknown }).text : null).map(clean).filter((item): item is string => !!item).slice(-MAX_TURNS)
    : [];
  const turns = [...prior, current].filter(Boolean);
  const normalized = turns.map(item => item.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim());
  const latestNormalized = normalized[normalized.length - 1] || '';
  const latestWords = new Set(latestNormalized.split(' ').filter(word => word.length > 3));
  const repeated = normalized.slice(0, -1).some(item => {
    if (item === latestNormalized || item.includes(latestNormalized) || latestNormalized.includes(item)) return true;
    const priorWords = item.split(' ').filter(word => word.length > 3);
    return priorWords.some(word => latestWords.has(word) || (word.startsWith('simpl') && latestNormalized.includes('simpl')));
  });
  const topics = TOPICS.filter(([, pattern]) => turns.some(item => pattern.test(item))).map(([topic]) => topic);
  const summary = topics.length ? `Recent inquiry context: ${topics.join(', ')}${repeated ? '; this question repeats or refines an earlier inquiry.' : '.'}` : 'No prior topic context was detected.';
  const routing_text = prior.length ? `${summary}\nLatest user inquiry: ${current}` : current;
  return { latest: current, turns: turns.length, repeated, topics, summary, routing_text };
}
