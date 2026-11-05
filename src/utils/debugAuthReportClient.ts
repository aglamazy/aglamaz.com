// TEMP famcircle#179/#204 (Agla 2026-11-04, msg 105659): client sender for the open debug
// report. Used by /auth/gate (every refresh attempt) and by the /app shell (just before it
// shows the login), since /app is a public path and never reaches the gate. Fire-and-forget
// with keepalive: it never blocks or delays anything. Remove with /api/debug/auth-report.
export function sendDebugAuthReport(outcome: 'ok' | 'fail', why: string, path: string, httpStatus?: number) {
  try {
    const body = JSON.stringify({
      outcome,
      why,
      path,
      httpStatus,
      clientTs: new Date().toISOString(),
      displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
      visibility: document.visibilityState,
      online: navigator.onLine,
      msSinceNavStart: performance.now(),
    });
    void fetch('/api/debug/auth-report', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch((err) => console.error('[debug auth report] failed:', err));
  } catch (err) {
    console.error('[debug auth report] failed:', err);
  }
}
