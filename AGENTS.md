# page layout
Use one layout for all pages. Header on top and then content.
# Development cycle
For now don't use tests.
After task completion run npx tsc and fix errors
On major change (refactoring) run npx next build and fix errors.
# Errors
✅ Handle local side effects (e.g. set loading=false, set error message in state).
✅ Rethrow or return false indicator after local handling so callers can decide what to do (redirect, retry, etc.).
❌ Don’t swallow errors by catching without rethrowing — this prevents upstream code from knowing something failed.
Rule of thumb: Use try/catch only if you can add value (logging, cleanup, updating state). Always rethrow unless you have fully resolved the error.


# Fallbacks
Don't use! If something is not build correctly, it should fail!

# Css
Use .css files instead of inline styles. Organize the css files wisely.

# i18n
String labels on the UI: use only with t()

# Firebase
if you adding a new query, let me know if I need to create the index in firbase (will be in backend log)