# Claude Code Game Studios -- Game Studio Agent Architecture

Indie game development managed through 49 coordinated Claude Code subagents.
Each agent owns a specific domain, enforcing separation of concerns and quality.

## Technology Stack

- **Engine**: [CHOOSE: Godot 4 / Unity / Unreal Engine 5]
- **Language**: [CHOOSE: GDScript / C# / C++ / Blueprint]
- **Version Control**: Git with trunk-based development
- **Build System**: [SPECIFY after choosing engine]
- **Asset Pipeline**: [SPECIFY after choosing engine]

> **Note**: Engine-specialist agents exist for Godot, Unity, and Unreal with
> dedicated sub-specialists. Use the set matching your engine.

## Project Structure

@.claude/docs/directory-structure.md

## Engine Version Reference

<!-- ENGINE-REFERENCE-IMPORT: the line below is engine-specific. /setup-engine
     rewrites it to @docs/engine-reference/<engine>/VERSION.md for the chosen
     engine, so a Unity or Unreal project stops loading the Godot reference every
     session. It defaults to Godot (the template's example engine); skills that
     need the pinned version read docs/engine-reference/<engine>/VERSION.md on
     demand regardless of this import. -->
(web game — Three.js/Vite, engine.name unset: no engine reference to import; see the macsong section below)


## Technical Preferences

`project.yaml` at the repo root is the primary config store — engine, specialists,
naming, platform, performance, modes. Skills resolve it via `resolve_config`
(see `.claude/docs/config-resolution.md`).

`.claude/docs/technical-preferences.md` is the **legacy fallback**, read on demand
when a key is absent from `project.yaml`. It is no longer imported here: before
`/setup-engine` runs it is almost entirely `[TO BE CONFIGURED]` placeholders, and
after it runs `project.yaml` holds the real values.

## Coordination Rules

@.claude/docs/coordination-rules.md

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction

See `docs/COLLABORATIVE-DESIGN-PRINCIPLE.md` for full protocol and examples.

> **First session?** If the project has no engine configured and no game concept,
> run `/start` to begin the guided onboarding flow.

## Coding Standards

@.claude/docs/coding-standards.md

## Context Management

Read `.claude/docs/context-management.md` on demand — it is a reference, not
session context. Two of its conventions are load-bearing and cited by name
elsewhere in the repo, so they are restated here rather than lost:

- **`production/session-state/active.md` is the session checkpoint.** The file is
  the memory, not the conversation. Read it first after any compaction, crash, or
  `/clear`.
- **Helpers in `.claude/scripts/` emit observations, never verdicts.** A script
  that scores or judges will eventually contradict a mode or override it cannot
  see. (Cited by `artifact-check.sh` and `adr-dep-graph.sh`.)

## macsong additions (this is the `claude-code-game-studios-macsong` fork)

This session is a **Studio session**: the full CCGS agent team for one game, launched on demand
(from 송갱 or from the AANO agents Pixel/Sonny) with `~/…/claude-code-game-studios-macsong/macsong-tools/studio.sh`.
It is not Pixel or Sonny — their identities live in `~/Projects/personal/AANO/agents/`.

- **Deployment:** agents go up to `git push` only. Vercel / itch.io / Google Play / 앱인토스 releases
  are done by 송갱 — hand over a deploy checklist instead of deploying.
- **Godot checks:** `~/Projects/personal/AANO/shared/game-tools/godot-parse-check.sh .` (`--shaders` when
  shaders changed). Godot exits 0 even when scripts are broken — never judge by exit code or `--import`.
  Godot binary: `/Applications/Godot.app/Contents/MacOS/Godot` (not on PATH).
- **Web games** (Three.js/Vite, `engine.name` unset): screenshots with
  `~/Projects/personal/AANO/shared/game-tools/web-game-shot.mjs`, performance with `web-game-perf.mjs`
  (see `.claude/docs/run-and-observe.md` web row).
- **Shared knowledge:** `~/Projects/personal/AANO/shared/game-dev-knowledge.md` (bug patterns, stack) and
  `game-dev-process.md` (the light process Pixel/Sonny use). Record new bug patterns there too.
- **Language:** reply to 송갱 in Korean, and write new or updated prose in Korean — design docs, stories,
  checklists, the session-state checkpoint, and option labels you present. Keep machine-read tokens in their
  original form: verdicts (`COMPLETE`, `PASS`, `CONCERNS`, `NOT VERIFIED`, `OBSERVED`…), `<!-- … -->` markers,
  YAML keys, template section headings that hooks or skills grep for, file names, and code identifiers.
- **Which process wins:** in this folder the CCGS workflow (`/start`, `/brainstorm`, `/adopt`, stories…)
  replaces the global "개발 순서" (grill-me → brainstorming → BRD → writing-plans). Don't run both.
- **One driver per game:** don't let Pixel/Sonny edit this game directly while a Studio session is working
  on it — hand them the task or wait until the studio is closed.
- **Background agents — stop them when their job is done.** A subagent (Agent tool) or background shell stays
  alive after it finishes — listed under the prompt as `◯ <task> 1h 5m` with a clock still running — because it
  can still receive follow-ups. They are not doing work, but they pile up, look like running jobs, and keep the
  session from ending cleanly. So:
  - As soon as you have an agent's final result and won't send it a follow-up, stop it with **TaskStop**
    (its task/agent id). Same for background shells you no longer need.
  - Before reporting a story/step as done, and before any sign-off, list what is still alive and stop
    everything that isn't genuinely still working; say in one line what you stopped.
  - If a job is still genuinely running at sign-off, say so instead of stopping it silently.
- **Ending a session ("오늘은 여기까지", "다음에 하자", "일단 그만하자", "그만", "끝내자" or any similar sign-off):**
  1. Finish or safely stop the current step (don't leave a file half-edited), then stop leftover background
     agents/shells with TaskStop (see above) — the agent list under the prompt should be empty.
  2. Update `production/session-state/active.md` — create it from `.claude/docs/templates/session-state.md`
     if missing; **overwrite** the CHECKPOINT region (current task, what's done, what's next, open questions,
     files in progress), keep it under ~25 lines.
  3. Reply in Korean with 2–3 lines: what was saved, and that "○○ 스튜디오 이어서 열어줘" resumes it.
  4. If running in a tmux window named `Studio-*`, close it after a short delay so the reply stays readable:
     `W=$(tmux display-message -p -t "$TMUX_PANE" '#W'); case "$W" in Studio-*) nohup sh -c "sleep 8; tmux kill-window -t '$W'" >/dev/null 2>&1 & ;; esac`
  Only for a sign-off to the whole session — "그만" meaning "stop that approach" is not an ending.
