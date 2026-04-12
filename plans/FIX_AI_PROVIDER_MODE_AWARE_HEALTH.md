# Fix Plan: Mode-Aware AI Health and Dashboard Status

1. **Unify AI mode model in backend settings** (`functions/core/settings.js`)
   - Add explicit persisted mode key for AI provider selection with 3 supported values:
     - `off`
     - `ollama`
     - `cloud`
   - Keep backward compatibility with current `ai.enabled`, `ai.ollama_enabled`, and `ai.preferred_provider` values by deriving canonical mode during reads.
   - Ensure defaults and merges preserve persisted mode after refresh/deploy.

2. **Make health endpoint mode-aware** (`functions/api/health-routes.js`)
   - Load canonical AI mode once.
   - If mode=`off`: skip Ollama + cloud AI health checks; do not add AI errors; mark AI services as disabled/not_configured without degrading overall status.
   - If mode=`ollama`: run Ollama health check only; report warning/error only on real Ollama unavailability.
   - If mode=`cloud`: skip Ollama health check; validate cloud/API AI path (Claude key/config) and report only cloud-relevant issues.
   - Update overall health calculation so inactive AI providers never trigger degraded/unhealthy states.

3. **Align AI router execution with canonical mode** (`functions/core/ai-router.js`)
   - Respect mode=`off` by returning `source: 'none'` without provider probes.
   - Respect mode=`ollama` by only attempting Ollama.
   - Respect mode=`cloud` by only attempting cloud/API AI.
   - Preserve safe fallback: if active provider unavailable, continue PO workflow with non-blocking skip behavior.

4. **Update Settings UI to expose clear mode selector/toggle behavior** (`frontend/src/pages/Settings.jsx`)
   - Replace ambiguous provider controls with explicit mode selector:
     - AI Off
     - Local Ollama AI
     - Cloud/API AI
   - Keep advanced provider fields visible contextually.
   - Persist canonical mode through `api.updateSettings`.
   - Ensure load path maps legacy settings to new mode without breaking existing deployments.

5. **Update Dashboard/Health UI to show active-mode-only warnings** (`frontend/src/pages/NewDashboard.jsx`, `frontend/src/pages/HealthCheck.jsx`)
   - Display AI status label based on canonical mode.
   - Ensure warning banners reflect only active AI path failures.
   - Hide/neutralize Ollama-specific warning text when mode is cloud or off.

6. **Verify purchase-order workflows remain functional in all modes** (`functions/modules/purchase-order/index.js` + existing flow)
   - Confirm AI unavailability does not block creation/review path.
   - Confirm non-AI workflow continues when mode is off.

7. **Test once after all changes**
   - Frontend + backend tests.
   - Manual mode tests: off / ollama / cloud including persistence across refresh.

8. **Finalize delivery**
   - Self-review changed files.
   - Commit and push.
   - Deploy frontend/backend.
   - Open live app, validate Settings + Dashboard behavior, and capture screenshot evidence.
