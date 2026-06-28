# agents-billing

Typed payment-status contract and a thin read client for Aglamazo billing.

## Surface

```ts
import {
  createPaymentStatusClient,
  getPaymentStatus,
  type PaymentStatus,
} from "agents-billing";
```

## Contract

`PaymentStatus` is the wire shape returned by `GET /api/billing/status`:

```ts
type PaymentStatus = {
  customer: string;
  kind: "one_time" | "recurring";
  amount_ils: number;
  currency: string;
  period_start: string;
  period_length_days: number;
  paid_through: string;
  tier?: string;
};
```

The package is intentionally policy-free. It does not sign requests, does not
implement SLA/quota rules, and does not ship the old webhook path.

## Client

```ts
const client = createPaymentStatusClient({
  baseUrl: "https://aglamazo.example",
  customer: "ilan-oz",
  readToken: process.env.BILLING_READ_TOKEN!,
});

const status = await client.getPaymentStatus();
```

You can also call the direct helper:

```ts
const status = await getPaymentStatus({
  baseUrl: "https://aglamazo.example",
  customer: "ilan-oz",
  readToken: process.env.BILLING_READ_TOKEN!,
});
```
