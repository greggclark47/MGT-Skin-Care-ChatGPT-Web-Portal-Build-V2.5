import type {
  SkinProfileInput, Routine, ProfileVector, AvoidFlags, IngredientRecord, ProductRecord,
  ProviderRecord, TreatmentRecord, ReadOnlyPage, AntiAgingResponseMeta, GroundedAntiAgingExplanation, GroundedSearchResult,
  MerchantReferral, ProgressEntry, ProgressAggregate, ProgressReminder, AppointmentRequest,
} from '@mgt/domain';

// One API client shared by web and mobile (Section C.1: "no separate business logic per
// platform"). Every call goes to the Express API — the clients never call external
// billing or analysis services directly (Section C.1's first rule).

export interface SkinMatchResult {
  session_id: string;
  profile_vector: ProfileVector;
  avoid_flags: AvoidFlags;
  rules_version: string;
  routine: Routine;
}

export interface ApiErrorShape {
  error: { code: string; message: string; details?: unknown; request_id: string };
}

export interface AntiAgingListResponse<T> {
  data: ReadOnlyPage<T>;
  meta: AntiAgingResponseMeta;
}

export interface AntiAgingRecordResponse<T> {
  data: T;
  meta: AntiAgingResponseMeta;
}

export interface AntiAgingSearchResponse {
  data: { results: GroundedSearchResult[]; uncertainty: string; task: string; policy_version: string };
  meta: AntiAgingResponseMeta;
}

export class ApiClient {
  constructor(private baseUrl: string, private fetchImpl: typeof fetch = fetch) {}

  private async post<T>(path: string, body: unknown, token?: string): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return this.readResponse<T>(res);
  }

  private async get<T>(path: string, token?: string): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    return this.readResponse<T>(res);
  }

  private async delete<T>(path: string, body: unknown, token?: string): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return this.readResponse<T>(res);
  }

  private async readResponse<T>(res: Response): Promise<T> {
    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      if (!res.ok) throw new ApiError(null, res.status);
      throw new ApiError({ error: {
        code: 'invalid_response', message: 'The platform returned an unreadable response.', request_id: 'unknown',
      } }, res.status);
    }
    if (!res.ok) throw new ApiError(payload, res.status);
    return payload as T;
  }

  // Pre-account: no token needed. The returned session_id is what binds the anonymous
  // Skin Match to a user at signup (Section C.5's session_token pattern).
  completeSkinMatch(input: SkinProfileInput, sessionId?: string): Promise<SkinMatchResult> {
    return this.post('/api/skin-match/complete', { ...input, session_id: sessionId });
  }

  buildCart(sessionId: string, routine: Routine) {
    return this.post<{ cart: unknown }>('/api/cart/from-routine', { session_id: sessionId, routine });
  }

  priceCart(sessionId: string, premium = false) {
    return this.get<{ pricing: { total_cents: number; subtotal_cents: number; shipping_cents: number } }>(
      `/api/cart/${encodeURIComponent(sessionId)}/price?premium=${premium}`,
    );
  }

  routineCommand(sessionId: string, text: string) {
    return this.post<{ routine: Routine; explanation: string }>('/api/coach/routine-command', { session_id: sessionId, text });
  }

  startCheckout(sessionId: string) {
    return this.post<{ order_id: string; client_secret: string; total_cents: number }>('/api/checkout/session', { session_id: sessionId });
  }

  orderStatus(orderId: string) {
    return this.get<{ status: string }>(`/api/checkout/orders/${encodeURIComponent(orderId)}/status`);
  }

  listIngredients(query: { q?: string; category?: string; limit?: number } = {}) {
    return this.get<AntiAgingListResponse<IngredientRecord>>(`/api/v1/ingredients${queryString(query)}`);
  }

  getIngredient(id: string) {
    return this.get<AntiAgingRecordResponse<IngredientRecord>>(`/api/v1/ingredients/${encodeURIComponent(id)}`);
  }

  listProducts(query: { q?: string; category?: string; concern?: string; ingredient?: string; limit?: number } = {}) {
    return this.get<AntiAgingListResponse<ProductRecord>>(`/api/v1/products${queryString(query)}`);
  }

  listTreatments(query: { q?: string; category?: string; limit?: number } = {}) {
    return this.get<AntiAgingListResponse<TreatmentRecord>>(`/api/v1/treatments${queryString(query)}`);
  }

  listProviders(query: { q?: string; city?: string; provider_type?: string; category?: string; limit?: number } = {}) {
    return this.get<AntiAgingListResponse<ProviderRecord>>(`/api/v1/providers${queryString(query)}`);
  }

  previewOnboarding(query: { goals: string[]; sensitivity: string; consent?: 'personalization' }) {
    return this.get<AntiAgingRecordResponse<unknown>>(`/api/v1/onboarding/preview${queryString({ goals: query.goals.join(','), sensitivity: query.sensitivity, consent: query.consent })}`);
  }

  previewRoutine(query: { product_ids: string[]; avoid_ingredient_ids?: string[]; sensitivity: string }) {
    return this.get<AntiAgingRecordResponse<unknown>>(`/api/v1/routines/preview${queryString({ product_ids: query.product_ids.join(','), avoid_ingredient_ids: query.avoid_ingredient_ids?.join(','), sensitivity: query.sensitivity })}`);
  }

  providerHandoff(id: string) {
    return this.get<AntiAgingRecordResponse<{ provider_id: string; handoff_type: string; handoff_url: string; data_shared: string[]; booking_supported: false; disclosure: string }>>(`/api/v1/providers/${encodeURIComponent(id)}/handoff`);
  }

  explainIngredient(id: string) {
    return this.get<AntiAgingRecordResponse<GroundedAntiAgingExplanation & { task: string; policy_version: string }>>(`/api/v1/explanations/ingredients/${encodeURIComponent(id)}`);
  }

  explainProduct(id: string) {
    return this.get<AntiAgingRecordResponse<GroundedAntiAgingExplanation & { task: string; policy_version: string }>>(`/api/v1/explanations/products/${encodeURIComponent(id)}`);
  }

  searchAntiAging(q: string, limit = 8) {
    return this.get<AntiAgingSearchResponse>(`/api/v1/search${queryString({ q, limit })}`);
  }

  referralPreview(productId: string) {
    return this.get<AntiAgingRecordResponse<MerchantReferral>>(`/api/v1/referrals/preview${queryString({ product_id: productId })}`);
  }

  recordReferralClick(productId: string, token?: string) {
    return this.post<{ data: { recorded: true; measurement: string; data_shared: [] } }>('/api/v1/referrals/click', { product_id: productId }, token);
  }

  listAntiAgingProgress(token?: string) {
    return this.get<{ data: { entries: ProgressEntry[]; aggregate: ProgressAggregate; consent_scope: 'progress_tracking' } }>('/api/v1/progress', token);
  }

  saveAntiAgingProgress(input: { entry_id: string; status: string; completed_at: string; consent_version: string }, token?: string) {
    return this.post<{ data: ProgressEntry; note: string }>('/api/v1/progress', { ...input, consent: 'progress_tracking' }, token);
  }

  deleteAntiAgingProgress(token?: string) {
    return this.delete<{ data: { deleted: number; consent_revoked: true } }>('/api/v1/progress', { confirm: true }, token);
  }

  listAntiAgingReminders(token?: string) {
    return this.get<{ data: { reminders: ProgressReminder[]; consent_scope: 'reminders' } }>('/api/v1/progress/reminders', token);
  }

  createAntiAgingReminder(input: { entry_id: string; cadence: 'daily' | 'weekly'; days_from_now: number; consent_version: string }, token?: string) {
    return this.post<{ data: ProgressReminder }>('/api/v1/progress/reminders', { ...input, consent: 'reminders' }, token);
  }

  setAntiAgingReminderState(id: string, action: 'pause' | 'resume', token?: string) {
    return this.post<{ data: ProgressReminder }>(`/api/v1/progress/reminders/${encodeURIComponent(id)}`, { action }, token);
  }

  deleteAntiAgingReminder(id: string, token?: string) {
    return this.delete<{ data: { deleted: true } }>(`/api/v1/progress/reminders/${encodeURIComponent(id)}`, {}, token);
  }

  nearbyAntiAgingProviders(city: string, radiusKm = 10, limit = 20) {
    return this.get<{ data: { items: ProviderRecord[]; radius_km: number; location_precision: 'city'; geocoding: 'disabled'; uncertainty: string } }>(`/api/v1/providers/nearby${queryString({ city, radius_km: radiusKm, limit })}`);
  }

  createAppointmentRequest(input: { provider_id: string; idempotency_key: string; requested_window?: string }, token?: string) {
    return this.post<{ data: AppointmentRequest }>('/api/v1/appointment-requests', { ...input, consent: 'provider_handoff' }, token);
  }

  getAppointmentRequest(id: string, token?: string) {
    return this.get<{ data: AppointmentRequest }>(`/api/v1/appointment-requests/${encodeURIComponent(id)}`, token);
  }
}

function queryString(values: Record<string, string | number | undefined>): string {
  const query = Object.entries(values).filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&');
  return query ? `?${query}` : '';
}

export class ApiError extends Error {
  readonly code: string;
  readonly requestId: string;
  constructor(payload: unknown, public status: number) {
    const record = payload !== null && typeof payload === 'object'
      ? payload as Record<string, unknown> : {};
    const envelope = record.error !== null && typeof record.error === 'object'
      ? record.error as Record<string, unknown> : {};
    super(typeof envelope.message === 'string' ? envelope.message : 'Request failed');
    this.code = typeof envelope.code === 'string' ? envelope.code
      : typeof record.error === 'string' ? record.error : 'unknown';
    this.requestId = typeof envelope.request_id === 'string' ? envelope.request_id : 'unknown';
  }
}
