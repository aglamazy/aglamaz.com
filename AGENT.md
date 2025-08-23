# Errors
✅ Handle local side effects (e.g. set loading=false, set error message in state).
✅ Rethrow or return false indicator after local handling so callers can decide what to do (redirect, retry, etc.).
❌ Don’t swallow errors by catching without rethrowing — this prevents upstream code from knowing something failed.
Rule of thumb: Use try/catch only if you can add value (logging, cleanup, updating state). Always rethrow unless you have fully resolved the error.