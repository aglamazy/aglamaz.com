// TEMP famcircle#179 (Agla 2026-11-04, msg 105659): the Android Chrome reopen forces a new
// Google login and the refresh failure's cause is unknown. /auth/gate reports every refresh
// attempt here so a real device shows why. Remove with the debug route once the cause is known.
//
// This endpoint is open (no auth), so the body is whitelisted field by field, capped in size,
// and anything shaped like a JWT is refused: a report never carries a cookie or token value.

export const DEBUG_AUTH_REPORT_MAX_BYTES = 2048;

export interface DebugAuthReportInput {
  why: string;
  outcome: 'ok' | 'fail';
  path: string;
  clientTs: string;
  httpStatus?: number;
  displayMode?: string;
  visibility?: string;
  online?: boolean;
  msSinceNavStart?: number;
}

/** What the server adds from the request itself (yes/no only, never a value). */
export interface DebugAuthReportServerFacts {
  ua: string;
  host: string;
  accessCookiePresent: boolean;
  cookieCount: number;
}

export type ParseResult =
  | { ok: true; report: DebugAuthReportInput }
  | { ok: false; status: 400 | 413; error: string };

const JWT_SHAPE = /[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;

function shortString(v: unknown, field: string, max: number): string {
  if (typeof v !== 'string') throw new Error(`${field} must be a string`);
  if (v.length > max) throw new Error(`${field} longer than ${max}`);
  if (JWT_SHAPE.test(v)) throw new Error(`${field} looks like a token`);
  return v;
}

/** Parses the raw request text into a report, or says why it is refused. */
export function parseDebugAuthReport(raw: string): ParseResult {
  if (Buffer.byteLength(raw, 'utf8') > DEBUG_AUTH_REPORT_MAX_BYTES) {
    return { ok: false, status: 413, error: `body over ${DEBUG_AUTH_REPORT_MAX_BYTES} bytes` };
  }
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed;
  } catch {
    return { ok: false, status: 400, error: 'body must be a JSON object' };
  }
  try {
    if (body.outcome !== 'ok' && body.outcome !== 'fail') throw new Error("outcome must be 'ok' or 'fail'");
    const report: DebugAuthReportInput = {
      why: shortString(body.why, 'why', 64),
      outcome: body.outcome,
      path: shortString(body.path, 'path', 512),
      clientTs: shortString(body.clientTs, 'clientTs', 40),
    };
    if (body.httpStatus !== undefined) {
      if (!Number.isInteger(body.httpStatus)) throw new Error('httpStatus must be an integer');
      report.httpStatus = body.httpStatus as number;
    }
    if (body.displayMode !== undefined) report.displayMode = shortString(body.displayMode, 'displayMode', 32);
    if (body.visibility !== undefined) report.visibility = shortString(body.visibility, 'visibility', 16);
    if (body.online !== undefined) {
      if (typeof body.online !== 'boolean') throw new Error('online must be a boolean');
      report.online = body.online;
    }
    if (body.msSinceNavStart !== undefined) {
      if (typeof body.msSinceNavStart !== 'number' || !Number.isFinite(body.msSinceNavStart)) {
        throw new Error('msSinceNavStart must be a number');
      }
      report.msSinceNavStart = Math.round(body.msSinceNavStart);
    }
    return { ok: true, report };
  } catch (err) {
    return { ok: false, status: 400, error: (err as Error).message };
  }
}
