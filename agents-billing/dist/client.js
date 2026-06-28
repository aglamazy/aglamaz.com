const STATUS_PATH = "/api/billing/status";
function normalizeBaseUrl(baseUrl) {
    const trimmed = (baseUrl ?? "").trim();
    if (!trimmed)
        return "";
    return trimmed.replace(/\/+$/, "");
}
function buildStatusUrl(args) {
    const baseUrl = normalizeBaseUrl(args.baseUrl);
    const url = `${baseUrl}${STATUS_PATH}`;
    return `${url}?customer=${encodeURIComponent(args.customer)}`;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isPaymentStatusKind(value) {
    return value === "one_time" || value === "recurring";
}
function parsePaymentStatus(value) {
    if (!isRecord(value)) {
        throw new Error("agents-billing: billing status response must be an object");
    }
    if (typeof value.customer !== "string" || !value.customer) {
        throw new Error("agents-billing: billing status is missing customer");
    }
    if (!isPaymentStatusKind(value.kind)) {
        throw new Error("agents-billing: billing status is missing kind");
    }
    if (typeof value.amount_ils !== "number" || !Number.isFinite(value.amount_ils)) {
        throw new Error("agents-billing: billing status is missing amount_ils");
    }
    if (typeof value.currency !== "string" || !value.currency) {
        throw new Error("agents-billing: billing status is missing currency");
    }
    if (typeof value.period_start !== "string" || !value.period_start) {
        throw new Error("agents-billing: billing status is missing period_start");
    }
    if (typeof value.period_length_days !== "number" ||
        !Number.isFinite(value.period_length_days)) {
        throw new Error("agents-billing: billing status is missing period_length_days");
    }
    if (typeof value.paid_through !== "string" || !value.paid_through) {
        throw new Error("agents-billing: billing status is missing paid_through");
    }
    if (value.tier !== undefined && typeof value.tier !== "string") {
        throw new Error("agents-billing: billing status tier must be a string");
    }
    return {
        customer: value.customer,
        kind: value.kind,
        amount_ils: value.amount_ils,
        currency: value.currency,
        period_start: value.period_start,
        period_length_days: value.period_length_days,
        paid_through: value.paid_through,
        ...(value.tier ? { tier: value.tier } : {}),
    };
}
async function requestPaymentStatus(args) {
    if (!args.customer) {
        throw new Error("agents-billing: customer is required");
    }
    if (!args.readToken) {
        throw new Error("agents-billing: readToken is required");
    }
    const fetchImpl = args.fetch ?? fetch;
    const res = await fetchImpl(buildStatusUrl(args), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${args.readToken}`,
            Accept: "application/json",
        },
    });
    if (!res.ok) {
        let body = "";
        try {
            body = await res.text();
        }
        catch {
            body = "";
        }
        throw new Error(`agents-billing: billing status request failed (${res.status} ${res.statusText})${body ? `: ${body}` : ""}`);
    }
    return parsePaymentStatus(await res.json());
}
export function createPaymentStatusClient(config) {
    return {
        getPaymentStatus() {
            return requestPaymentStatus(config);
        },
    };
}
export async function getPaymentStatus(args) {
    return requestPaymentStatus(args);
}
