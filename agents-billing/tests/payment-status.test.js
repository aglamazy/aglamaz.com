import test from "node:test";
import assert from "node:assert/strict";

import {
  createPaymentStatusClient,
  getPaymentStatus,
} from "../dist/index.js";

test("getPaymentStatus calls the billing status endpoint with bearer token", async () => {
  const calls = [];
  const status = {
    customer: "ilan-oz",
    kind: "recurring",
    amount_ils: 499,
    currency: "ILS",
    period_start: "2026-06-01T00:00:00.000Z",
    period_length_days: 30,
    paid_through: "2026-07-01T00:00:00.000Z",
    tier: "pro",
  };

  const client = createPaymentStatusClient({
    baseUrl: "https://aglamazo.example/",
    customer: "ilan-oz",
    readToken: "read-token",
    fetch: async (input, init) => {
      calls.push({ input, init });
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async json() {
          return status;
        },
        async text() {
          return JSON.stringify(status);
        },
      };
    },
  });

  const result = await client.getPaymentStatus();
  assert.deepEqual(result, status);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, "https://aglamazo.example/api/billing/status?customer=ilan-oz");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.headers.Authorization, "Bearer read-token");
});

test("getPaymentStatus rejects malformed payloads", async () => {
  await assert.rejects(
    () =>
      getPaymentStatus({
        baseUrl: "https://aglamazo.example",
        customer: "ilan-oz",
        readToken: "read-token",
        fetch: async () => ({
          ok: true,
          status: 200,
          statusText: "OK",
          async json() {
            return { customer: "ilan-oz" };
          },
          async text() {
            return "{}";
          },
        }),
      }),
    /missing kind/,
  );
});

test("getPaymentStatus surfaces HTTP failures", async () => {
  await assert.rejects(
    () =>
      getPaymentStatus({
        customer: "ilan-oz",
        readToken: "read-token",
        fetch: async () => ({
          ok: false,
          status: 403,
          statusText: "Forbidden",
          async json() {
            return { error: "denied" };
          },
          async text() {
            return "denied";
          },
        }),
      }),
    /403 Forbidden/,
  );
});
