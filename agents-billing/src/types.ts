export type PaymentStatusKind = "one_time" | "recurring";

/**
 * Wire contract returned by Aglamazo's billing status endpoint.
 *
 * The package is intentionally read-only: no push/webhook signing, no SLA
 * rules, and no quota policy.
 */
export interface PaymentStatus {
  customer: string;
  kind: PaymentStatusKind;
  amount_ils: number;
  currency: string;
  period_start: string;
  period_length_days: number;
  paid_through: string;
  tier?: string;
}

export interface PaymentStatusClientConfig {
  /**
   * Base URL for Aglamazo. May be absolute or relative. Defaults to the
   * current origin when omitted.
   */
  baseUrl?: string;
  /** Shared read token used to authorize the GET request. */
  readToken: string;
  /** Customer key to request. */
  customer: string;
  /** Fetch implementation, primarily for tests. */
  fetch?: FetchLike;
}

export interface PaymentStatusClient {
  getPaymentStatus(): Promise<PaymentStatus>;
}

export interface PaymentStatusQueryArgs {
  baseUrl?: string;
  readToken: string;
  customer: string;
  fetch?: FetchLike;
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface FetchLike {
  (
    input: string,
    init?: {
      method?: string;
      headers?: Record<string, string>;
    },
  ): Promise<FetchResponseLike>;
}
