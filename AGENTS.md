# Kiberaz.az Codex Instructions

These are the active project instructions for Codex. The user's current request has the highest priority. When instructions do not conflict, follow this file and the task-specific skill or role it routes to.

## Project policy and ground truth

- Read `SENIOR-RULES.md` before substantive implementation work. It contains the project's security invariants and coding contracts.
- Treat repository code, project files, configuration examples, and seed data as ground truth for mutable implementation facts. If they conflict with an older instruction, investigate the drift instead of silently following stale information.
- Keep code comments, API messages, validation messages, and UI copy in Azerbaijani unless the user explicitly requests another language.
- Preserve all user-authored and uncommitted work. Inspect `git status --short` before editing; never reset, discard, overwrite, or reformat unrelated changes.

## Current architecture

- Runtime: .NET 9 with nullable reference types and implicit usings enabled.
- Backend: Clean Architecture with `Kiberaz.Domain`, `Kiberaz.Application`, `Kiberaz.Infrastructure`, and `Kiberaz.Api`.
- Database: LiteDB 5.0.21 through the singleton `LiteDbContext`; this project does not use EF Core, SQL Server, or migrations.
- Identity: ASP.NET Core Identity with custom LiteDB stores.
- API: JWT Bearer authentication, FluentValidation, `ApiResponse<T>`, named rate-limit policies, and centralized exception handling.
- Frontend: React, TypeScript, and Vite under `kiberaz-ui/`.
- Data lifecycle: UTC timestamps and soft deletion through `BaseEntity`.

Changing one of these choices is an architecture decision. Explain the impact and obtain direction before making such a change unless the user explicitly requested it.

## Role routing

Load only the role relevant to the current work:

- Full-stack feature, backend, frontend, or integration: `.codex/roles/senior-fullstack-engineer.md`
- Authentication, authorization, uploads, secrets, abuse prevention, or security-sensitive code: `.codex/roles/application-security-engineer.md`
- Bug diagnosis, regression analysis, or code review: `.codex/roles/bug-hunter-reviewer.md`

Use `.codex/skills/kiberaz-engineering/SKILL.md` for implementation, fixes, refactoring, and review. Use `.codex/skills/quiz-question-engineering/SKILL.md` when converting supplied learning material into quiz seed data.

The old `.claude/commands/mentor.md` mode is intentionally disabled in its source file. Do not activate a mandatory Socratic workflow unless the user explicitly asks for mentoring.

## Engineering workflow

1. Inspect the relevant request path, callers, contracts, tests, and current diff before changing code.
2. Identify the root cause or smallest complete design. Avoid unrelated refactors and speculative abstractions.
3. Implement focused changes that preserve public contracts, layer boundaries, security invariants, and existing visual behavior.
4. Add or update a meaningful test when behavior or a regression boundary changes.
5. Run the narrowest relevant check first, followed by the appropriate project quality gate.
6. Review the final diff for scope, secrets, generated artifacts, debug code, and accidental changes.

Do not stop at a plan when the user asked for implementation. Ask a question only when the missing answer materially changes the result and cannot be safely inferred from repository evidence.

## Non-negotiable invariants

- Never trust identity, role, price, count, ownership, or status supplied by the client. Resolve identity from authenticated claims and re-check business invariants in the service.
- Authentication is default-deny. `[AllowAnonymous]` must be intentional and justified. Authorization and ownership checks must be enforced server-side.
- Preserve the single-administrator invariant implemented through `SystemAccounts`, `ProtectedAccountPolicy`, and startup enforcement. Hidden/protected accounts must remain excluded from user-facing lists, counts, search, rankings, and rosters.
- Do not weaken `OnTokenValidated`, refresh-token rotation, security-stamp checks, CORS allow-lists, middleware order, CAPTCHA fail-closed behavior, or rate limiting to make a test pass.
- Never expose answer keys, hashes, tokens, security stamps, internal moderation state, secrets, or unnecessary PII.
- Never build LiteDB query-expression strings from user input. Use typed predicates.
- Do not `await` while holding a LiteDB synchronization gate or transaction. Complete asynchronous work before entering the guarded synchronous transaction.
- Uploads require extension allow-listing, magic-byte validation, streamed size limits, generated storage names, quota enforcement, and the existing isolated PDF sanitizer path.

## Backend contract

- `Domain`: entities, enums, constants, and business concepts with no LiteDB or web dependencies.
- `Application`: DTOs, interfaces, validators, and use-case contracts with no Infrastructure reference.
- `Infrastructure`: LiteDB access, Identity stores, external integrations, and service implementations.
- `Api`: controllers, filters, middleware, and DI composition.
- Controllers depend on service interfaces, read claims, delegate work, wrap responses in `ApiResponse<T>`, and select accurate HTTP status codes.
- Every request DTO has FluentValidation coverage. Domain entities do not cross the HTTP boundary.
- New endpoints deliberately select authorization and rate-limit behavior and document real response types.
- Use async end to end, inject `TimeProvider`, preserve deliberate DI lifetimes, and let `ExceptionMiddleware` handle unexpected exceptions.

## Frontend and design contract

- Existing visual output is protected unless the user explicitly requests a design change.
- Design tokens in `kiberaz-ui/src/index.css` are read-only unless the user explicitly requests a design-system change.
- New visual components use existing `var(--...)` tokens, their own colocated CSS file, semantic HTML, keyboard support, visible focus, responsive behavior, and reduced-motion handling where relevant.
- Components render UI; services own API calls; shared stateful behavior belongs in hooks; shared models belong in types; utilities remain pure.
- Do not use `any`, unjustified `@ts-ignore`, unsanitized server HTML, or persistent browser storage for access/refresh tokens.
- Frontend authorization is presentation only; the server remains authoritative.

## Quality gates

Run checks proportional to the changed area:

- Backend release build: `dotnet build Kiberaz.sln -c Release --warnaserror`
- Security regression suite: `dotnet run --project tools/SecurityRegressionTests`
- Frontend build: `npm run build` from `kiberaz-ui/`
- Frontend lint: `npm run lint` from `kiberaz-ui/`
- Focused TypeScript check when useful: `npx tsc --noEmit -p tsconfig.app.json` from `kiberaz-ui/`
- Patch hygiene: `git diff --check` and `git status --short`

Do not claim a check passed unless it was run successfully. Distinguish pre-existing failures from regressions introduced by the current change.

## Completion report

Lead with the delivered result. Mention the changed files and verification performed. For security changes, briefly name the attack path and why the fix closes it. Report only concrete residual risks or blocked checks; avoid generic warnings and long tutorials.
