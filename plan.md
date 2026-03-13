# Runtime Recovery Plan

This document tracks the active repair effort for real model execution on the
current macOS development machine.

## Current Findings

1. `node-pty` fails immediately under the active Node 24 runtime, including for
   trivial commands such as `/bin/echo`.
2. `claude` and `gemini` do not behave reliably when launched from
   `spawn(..., stdio: pipe)` in this environment.
3. `codex` does work on the existing direct pipe path.
4. Unit and integration tests currently pass without covering these real
   transport failures.

## Accepted Strategy

- Keep PTY execution only when a real PTY health probe passes.
- Use a TTY-backed captured execution path for `claude` and `gemini`.
- Keep `codex` on the current direct pipe path.
- Fail fast for `claude` and `gemini` when neither PTY nor a controlling TTY is
  available.
- Do not add new CLI flags or config keys in this phase.

## Phase 1: Documentation First

1. Create `CLAUDE.md` as the repo-local runtime operations guide.
2. Replace the previous architecture-heavy `plan.md` with this live recovery
   plan.
3. Record the validation commands required after any transport change.

## Phase 2: Runtime Transport Repair

1. Add a cached PTY health probe.
2. Route `claude` and `gemini` through a TTY-backed captured transport that:
   - inherits the current terminal
   - redirects engine output to a temporary file
   - tails the file incrementally
   - parses structured output instead of trusting raw preamble noise
3. Keep `codex` on the existing pipe-based transport.
4. Update PTY fallback so it uses the repaired engine transport instead of the
   currently hanging pipe path for `claude` and `gemini`.

## Acceptance Criteria

The following commands must complete successfully without hanging:

```bash
npm run build
npm test
node dist/index.js "Reply with exactly the single word OK" -e codex -r codex --auto --threshold 9
node dist/index.js "Reply with exactly the single word OK" -e claude -r codex --auto --threshold 9
node dist/index.js "Reply with exactly the single word OK" -e gemini -r codex --auto --threshold 9
```

Expected results:

- `codex` still works
- `claude` works without relying on `node-pty`
- `gemini` works without relying on `node-pty`
- `claude` and `gemini` fail quickly with an actionable error when no
  controlling TTY is available

## Deferred Work

These items are intentionally out of scope for this batch:

- manual mode improvements
- orchestrator placeholder cleanup
- broader docs/help polish beyond runtime compatibility
- deeper daemon and multi-agent follow-up work
