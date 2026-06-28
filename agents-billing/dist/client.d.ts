import type { FetchLike, PaymentStatus, PaymentStatusClient, PaymentStatusClientConfig, PaymentStatusQueryArgs } from "./types.js";
export declare function createPaymentStatusClient(config: PaymentStatusClientConfig): PaymentStatusClient;
export declare function getPaymentStatus(args: PaymentStatusQueryArgs): Promise<PaymentStatus>;
