export type PaymentStatusKind = "one_time" | "recurring";
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
    baseUrl?: string;
    readToken: string;
    customer: string;
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
    (input: string, init?: {
        method?: string;
        headers?: Record<string, string>;
    }): Promise<FetchResponseLike>;
}
