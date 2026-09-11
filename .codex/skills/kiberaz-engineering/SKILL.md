---
name: kiberaz-engineering
description: Implement, fix, refactor, diagnose, or review code in the Kiberaz.az React and .NET 9 LiteDB repository while preserving its architecture, security invariants, and Dark Tactical design system.
---

# Kiberaz Engineering

Deliver a production-quality, focused change in the Kiberaz.az repository.

## Establish context

1. Read `AGENTS.md` and `SENIOR-RULES.md`.
2. Inspect `git status --short` and preserve all user changes.
3. Trace the relevant entry point, callers, contracts, persisted shape, and existing tests.
4. Load only the relevant role:
   - `../../roles/senior-fullstack-engineer.md` for implementation and integration;
   - `../../roles/application-security-engineer.md` for trust-boundary or security-sensitive work;
   - `../../roles/bug-hunter-reviewer.md` for diagnosis or review.

## Implement

- Solve the root cause with the smallest complete patch.
- Preserve Clean Architecture dependency direction and the existing API/design contracts.
- Treat security requirements in `SENIOR-RULES.md` as acceptance criteria for the affected path.
- Do not weaken validation, authorization, security controls, typing, or error handling to make a check pass.
- Avoid unrelated refactors, speculative abstractions, new dependencies, and broad formatting changes.
- If a new dependency is genuinely required, explain why existing capabilities are insufficient and review its maintenance and vulnerability posture before adding it.

## Verify

- Add a meaningful regression or behavior test when warranted.
- Run the narrowest relevant verification followed by the appropriate commands in `AGENTS.md`.
- Review `git diff --check`, `git diff --stat`, and `git status --short`.
- Confirm the diff contains no secret, database file, local configuration, build artifact, debug code, or unrelated user change.

## Report

Lead with the completed outcome. List changed files when useful, state the checks actually run, and disclose only concrete remaining risk or an environment blocker. For security fixes, include the attack vector and why the control closes it.
