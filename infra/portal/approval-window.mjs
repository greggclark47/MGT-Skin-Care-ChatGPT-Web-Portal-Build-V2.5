// Evidence timestamps use unambiguous UTC, with optional millisecond precision.
// Round-tripping rejects impossible dates that Date.parse silently normalizes.
export function utcTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return NaN;
  const ms = Date.parse(value);
  const canonical = value.includes(".") ? value : value.replace("Z", ".000Z");
  return Number.isFinite(ms) && new Date(ms).toISOString() === canonical ? ms : NaN;
}

export function validExecutionWindow(window) {
  if (!window || typeof window !== "object" || Array.isArray(window)) return false;
  const start = utcTimestamp(window.start);
  const end = utcTimestamp(window.end);
  return Number.isFinite(start) && Number.isFinite(end) && end > start && end - start <= 4 * 60 * 60 * 1000;
}

export function sameExecutionWindow(left, right) {
  return validExecutionWindow(left) && validExecutionWindow(right) && left.start === right.start && left.end === right.end;
}

export function executionWithinWindow(executedAt, window) {
  const ms = utcTimestamp(executedAt);
  return validExecutionWindow(window) && Number.isFinite(ms) && ms >= utcTimestamp(window.start) && ms < utcTimestamp(window.end);
}
