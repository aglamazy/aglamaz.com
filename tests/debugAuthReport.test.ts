// TEMP famcircle#179: the open debug endpoint must store only whitelisted, small, token-free
// fields. Remove with src/utils/debugAuthReport.ts.
import assert from 'node:assert/strict';
import { parseDebugAuthReport, DEBUG_AUTH_REPORT_MAX_BYTES } from '../src/utils/debugAuthReport';

const base = { outcome: 'fail', why: 'missing_cookie', path: '/app', clientTs: '2026-11-04T19:40:00.000Z' };

function ok() {
  const r = parseDebugAuthReport(JSON.stringify({ ...base, httpStatus: 401, displayMode: 'browser', visibility: 'visible', online: true, msSinceNavStart: 812.4 }));
  assert.ok(r.ok);
  assert.deepEqual(r.report, { ...base, httpStatus: 401, displayMode: 'browser', visibility: 'visible', online: true, msSinceNavStart: 812 });
}

function unknownFieldsDropped() {
  const r = parseDebugAuthReport(JSON.stringify({ ...base, cookie: 'refresh_token=abc', extra: 1 }));
  assert.ok(r.ok);
  assert.equal('cookie' in r.report, false);
  assert.equal('extra' in r.report, false);
}

function tokenShapedRefused() {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.c2lnbmF0dXJlc2ln';
  const r = parseDebugAuthReport(JSON.stringify({ ...base, path: `/app?t=${jwt}` }));
  assert.ok(!r.ok && r.status === 400 && /token/.test(r.error));
}

function oversizeRefused() {
  const r = parseDebugAuthReport(JSON.stringify({ ...base, path: 'x'.repeat(DEBUG_AUTH_REPORT_MAX_BYTES) }));
  assert.ok(!r.ok && r.status === 413);
}

function badShapesRefused() {
  for (const raw of ['not json', '[]', 'null', JSON.stringify({ ...base, outcome: 'maybe' }), JSON.stringify({ ...base, why: 7 }),
    JSON.stringify({ ...base, httpStatus: '401' }), JSON.stringify({ ...base, online: 'yes' }), JSON.stringify({ ...base, why: 'w'.repeat(65) })]) {
    const r = parseDebugAuthReport(raw);
    assert.ok(!r.ok && r.status === 400, `should refuse: ${raw.slice(0, 60)}`);
  }
}

// famcircle#204: the /app shell's reasons must pass the same whitelist, with a real /app path.
function appPathReasonsAccepted() {
  for (const why of ['app_path_no_user', 'app_path_check_error']) {
    const r = parseDebugAuthReport(JSON.stringify({ ...base, why, path: '/app?login=1&why=missing_cookie' }));
    assert.ok(r.ok, why);
    assert.equal(r.report.why, why);
  }
}

for (const t of [ok, unknownFieldsDropped, tokenShapedRefused, oversizeRefused, badShapesRefused, appPathReasonsAccepted]) {
  t();
  console.log(`✓ ${t.name}`);
}
