# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-10

### Fixed

- Shared plan async/sync contract mismatch: all plan functions now properly awaited
- Shared plan field name drift: `reviewerScore`/`reviewerApproved` → `score`/`approved`
- Agent launcher IPC socket path: `daemon.sock` → `loop.sock` to match daemon
- Agent launcher IPC message format: aligned to UPPERCASE types + nested `data` object
- Daemon start/stop/status: real background daemon with PID file and IPC-based status
- Placeholder IPC handlers (LAUNCH_AGENT, RESUME_AGENTS, LAUNCH_GROUP, STOP_GROUP) now return explicit "not implemented" errors
- README: config field names, default values, and command list aligned with actual CLI
- CLI version string now matches package.json

### Added

- Multi-turn manual mode: readline-based follow-up prompting between PTY sessions
- Daemon entry script for proper background process management
- 33 new regression tests (315 total across 26 test files)

## [0.1.2] - 2026-03-10

### Fixed

- Fix `posix_spawnp failed` crash: `@clack/prompts` placeholder text was leaking as actual CLI arguments
- Add try-catch around PTY spawn with clear error message when engine CLI is not found
- Add automatic fallback to non-interactive `engine.run()` when PTY spawn fails

## [0.1.0] - 2026-03-10

### Added

- Iterative execution loop: executor produces output, reviewer scores (1-10), feedback fed back until approved
- Multi-engine support: Claude CLI, Gemini CLI, Codex CLI via unified `Engine` interface
- File-based event bus: append-only JSONL event streaming, crash-safe, zero external dependencies
- Background daemon: agent lifecycle management with Unix domain socket IPC
- Agent wrappers: `lclaude`, `lgemini`, `lcodex` — transforms CLI agents into loop participants
- Skills system: executable markdown (SKILL.md) auto-injected into agent prompts
- Interactive TUI: `@clack/prompts` guided setup + `blessed` real-time monitoring dashboard
- Terminal adapters: pluggable backends for Terminal.app, iTerm2, tmux, PTY emulation
- Shared plan management: cross-session iteration context with architectural decision tracking
- Configuration cascade: project-level `.loop/config.json` with sensible defaults
- 282 tests across 23 test files with full pass rate
