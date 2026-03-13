# loop

> Iterative Multi-Engine AI Orchestration CLI

Combine **Claude**, **Gemini**, and **Codex** in a quality-scored iteration loop. One engine executes, another reviews. Repeat until perfect.

```bash
npm install -g @lawrence369/loop-cli
```

## What It Does

```
┌─────────────┐     ┌─────────────┐
│   Executor   │────▶│   Reviewer   │
│  (Claude)    │◀────│  (Gemini)    │
└─────────────┘     └─────────────┘
       │                    │
       │    Score < 8?      │
       │◀───Feedback────────│
       │                    │
       │    Score ≥ 8?      │
       │────APPROVED───────▶│
```

You give it a task. The **executor** engine produces output. The **reviewer** engine scores it (1-10) and provides feedback. If the score doesn't meet the threshold, the feedback is fed back to the executor. This continues until the output is approved or max iterations are reached.

## Quick Start

```bash
# Interactive guided setup
loop

# Direct execution
loop "Refactor the auth module to use JWT" -e claude -r gemini

# Auto mode with custom threshold
loop "Write comprehensive tests for utils/" -e gemini -r claude --auto --threshold 9

# Pass flags to the executor CLI
loop "Build the API endpoints" -e claude --pass --model opus
```

## Features

- **Multi-engine**: Claude CLI, Gemini CLI, Codex CLI — mix and match
- **Quality-scored iteration**: Automatic review loop with configurable threshold (1-10)
- **File-based event bus**: Append-only JSONL, crash-safe, zero external dependencies
- **Multi-agent orchestration**: Background daemon with IPC for coordinating agent teams
- **Skills system**: Executable markdown (`SKILL.md`) auto-injected into agent prompts
- **Interactive TUI**: Beautiful guided setup + real-time monitoring dashboard
- **Terminal adapters**: Terminal.app, iTerm2, tmux, built-in PTY
- **Decision tracking**: Architectural decisions persisted across sessions
- **Local-first**: Everything runs on your machine. No cloud services, no databases.

## Commands

```bash
loop [task]              # Run iteration loop (interactive if no task)
loop daemon start        # Start background daemon
loop daemon stop         # Stop daemon
loop daemon status       # Check daemon status
loop bus send <message>  # Send a message on the event bus
loop bus check <id>      # Check for pending bus messages
loop bus status          # Show event bus status
loop chat                # Open real-time dashboard
loop plan show           # Show current iteration plan
loop plan clear          # Clear plan
loop ctx add <title>     # Add architectural decision
loop ctx list            # List decisions
loop ctx resolve <id>    # Resolve a decision
loop skills list         # List available skills
loop skills add <name>   # Add a new skill
```

## Options

| Flag | Description |
|------|-------------|
| `-e, --executor <engine>` | Executor engine: `claude` \| `gemini` \| `codex` |
| `-r, --reviewer <engine>` | Reviewer engine: `claude` \| `gemini` \| `codex` |
| `-n, --iterations <num>` | Max iterations (default: 3) |
| `-d, --dir <path>` | Working directory |
| `-v, --verbose` | Stream real-time output |
| `--auto` | Auto mode — skip manual conversation |
| `--pass <args...>` | Pass native flags to executor CLI |
| `--threshold <num>` | Approval score threshold, 1-10 (default: 9) |

## How It Works

1. **Configuration**: Reads `.loop/config.json` from your project (or uses defaults)
2. **Engine selection**: Picks executor + reviewer from config or CLI flags
3. **Iteration loop**:
   - Executor receives the task (with prior feedback, if any)
   - Executor produces output via PTY-based CLI session
   - Output is sent to the reviewer with the LoopMessage v1 protocol
   - Reviewer scores (1-10) and provides structured feedback
   - If score meets threshold or "APPROVED" keyword: done
   - Otherwise: feedback → executor → next iteration
4. **Event bus**: All messages logged to append-only JSONL for crash recovery
5. **Skills**: Relevant `SKILL.md` files injected into agent prompts for context

## Configuration

Create `.loop/config.json` in your project:

```json
{
  "defaultExecutor": "claude",
  "defaultReviewer": "gemini",
  "maxIterations": 3,
  "threshold": 9,
  "mode": "manual",
  "launchMode": "auto",
  "autoResume": false,
  "skillsDir": ".loop/skills",
  "verbose": false
}
```

## Requirements

- Node.js 18+
- At least one AI CLI tool installed:
  - [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli)
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli)
  - [Codex CLI](https://github.com/openai/codex)

## Install from Source

```bash
git clone https://github.com/lawrence3699/loop.git
cd loop
npm install
npm run build
npm pack
npm install -g ./lawrence369-loop-cli-*.tgz
```

## Validate A Local Global Install

Use the packed tarball when verifying runtime fixes so the globally installed
`loop` binary is exercising the same build you just produced.

```bash
npm run build
npm test
npm pack
npm install -g ./lawrence369-loop-cli-*.tgz

cd ~
loop "Reply with exactly the single word OK" -e codex -r codex --auto --threshold 9
loop "Reply with exactly the single word OK" -e claude -r codex --auto --threshold 9
loop "Reply with exactly the single word OK" -e gemini -r codex --auto --threshold 9
```

## License

MIT
