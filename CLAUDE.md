# Runtime Execution Guide

This repository currently targets real interactive terminal usage on macOS.

## Known Runtime Matrix

- `codex`: works with the existing pipe-based execution path
- `claude`: does not behave reliably when launched from `spawn(..., stdio: pipe)` on this machine
- `gemini`: does not behave reliably when launched from `spawn(..., stdio: pipe)` on this machine
- `node-pty`: currently fails to spawn even trivial commands under the active Node 24 runtime on this machine

## Chosen Repair Strategy

- Keep the existing PTY path only when a real PTY health probe passes
- Prefer a TTY-backed captured execution path for `claude` and `gemini`
- Do not rely on unit/integration green status alone for runtime changes
- Validate every transport change with real model smoke tests

## Required Validation

Run all of these after transport changes:

```bash
npm run build
npm test
node dist/index.js "Reply with exactly the single word OK" -e codex -r codex --auto --threshold 9
node dist/index.js "Reply with exactly the single word OK" -e claude -r codex --auto --threshold 9
node dist/index.js "Reply with exactly the single word OK" -e gemini -r codex --auto --threshold 9
```

## Scope Guardrails

- First repair batch is runtime-only
- Do not expand scope into manual-mode UX changes
- Do not expand scope into daemon/orchestrator cleanup unless a runtime change requires it
- Do not introduce new CLI flags or config keys in this batch

## Deferred Follow-Up

- Manual mode improvements
- Orchestrator placeholder work
- Broader README/help polish beyond what is required for the runtime repair
