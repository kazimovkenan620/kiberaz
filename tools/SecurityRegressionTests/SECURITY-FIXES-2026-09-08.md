# Security remediation — 2026-09-08

Scope: the current working tree at `C:\Users\User\Desktop\kiberaz`, including pre-existing edits. No production database was opened or changed for verification. No deployment or running application restart was performed.

## Changes

| Finding | Enforcement |
| --- | --- |
| Anonymous storage exhaustion | `UploadService`: exclusive cross-process storage lock, actual-byte input bounds, total bytes/file-count limits, free-disk reserve, removal of only a failed operation's newly created partial file. Existing files count toward quota. |
| Active PDF filter bypass | `SafePdf`: parse normalized names and compressed objects; reject scripts, automatic actions, attachments, forms, encryption and unsupported actions; rewrite accepted structure. `PdfProcessSanitizer`: a separate process, 10-second deadline, 256 MiB managed heap cap, 512 MiB working-set watchdog, bounded input/output, no inherited application secrets. |
| Legacy PDF bypass | `UploadController` validates existing PDFs on download. The ASP.NET static-file path excludes PDF files; accepted syllabus documents download as attachments with sandbox CSP. |
| Quiz replay / score inflation | `QuizService`: transactional first-answer claim; repeated practice answers remain usable but produce no new scored record. `QuizSecurity` selects earliest result before period filtering, including historical duplicates; `UserService` uses the same scoring projection. Stored history is not deleted. |
| Public answer oracle against exams | `QuizQuestion.IsExamOnly`: false for existing public questions. Both public listing and direct submit exclude private questions. New exam sessions select private questions only. API creation and the importer reject normalized text crossing banks, including deleted historical public questions. |
| Exposed legacy exam snapshots | New sessions carry a security version. Legacy sessions are displayed closed and reject join/answer/submit; no new trusted grade is generated on expiry. Historical data is preserved. |
| Targeted recovery lockout | Invalid reset tokens no longer mutate the target account. Existing reset-only locks do not reject a valid recovery token. The HTTP requester rate limit remains. |
| Registration collision oracle | Nickname collision checking is independent of candidate email. Every attempt is counted; Identity duplicate races and SMTP failures do not expose a separate email-collision response. |
| Email confirmation race | Verify the old-mailbox token, then commit the new email, unconfirmed flag, security stamp and session revocation in one concurrency-checked write. Failed writes are reported. The new mailbox must still confirm ownership. |
| Dependency CVEs | Lockfile resolves `browserslist` 4.28.9 (CVE-2026-73088 / CVE-2026-73089 fixed from 4.28.7); transitive data dependencies updated. Added PDFsharp 6.2.4 for structured PDF parsing. |

## Operating settings and compatibility

- Default upload budget: **1 GiB total**, **2,000 files**, **2 GiB free-space reserve**. Configure `Uploads:MaxTotalBytes`, `Uploads:MaxFiles`, `Uploads:MinFreeBytes` (environment variables use `__`). A full/busy store returns 503; existing files are not automatically deleted. Monitor usage and review/remove obsolete files through an authorized maintenance process. These limits prevent growth beyond the configured budget, not all denial of new uploads.
- A reverse proxy must forward `/uploads/syllabus/*` to the API. Do not expose the upload directory directly through IIS/Nginx/CDN aliases: that would bypass the PDF controller. Existing cached PDFs must be purged when deploying the fix.
- The API's framework-dependent publish must include its `.runtimeconfig.json`, `.deps.json`, PDFsharp dependencies and a usable `dotnet` host. The worker exits before application configuration/Identity/database initialization. This is resource isolation, not an OS security sandbox.
- Anonymous course proposals and photo/PDF uploads remain supported. Static PDFs, including modern compressed-object PDFs, remain supported. Active/encrypted/form PDFs are deliberately rejected; download is attachment-only.
- Existing practice questions remain public and are **not** recycled into a private bank. New exam questions must be genuinely new. Admin `POST /api/quiz/questions` accepts `isExamOnly: true`. The existing import JSON accepts the same property on each question. Omitted/false means public practice.
- Existing exposed exam sessions require replacement with sessions using private questions. No private question content was invented or written to the real database during this task.
- The first answer per account/question is the scored answer. Later attempts remain practice. Historical replayed rows remain in storage but do not inflate ranking/progress.

## Private question import

Use the existing question JSON schema (`categoryId`, `difficulty`, `question`, `correctKey`, four `options` with `key`, `text`, `explanation`) and add `"isExamOnly": true`. Do not reuse previously published questions.

Validate against the intended database before importing:

```powershell
dotnet run --project tools/ImportQuestionsTool -- --db <database-path> --file <private-questions.json> --dry-run
dotnet run --project tools/ImportQuestionsTool -- --db <database-path> --file <private-questions.json>
```

Import operations above are deployment/maintenance instructions; they were not run against the real database.

## Verification

```powershell
dotnet run --project tools/SecurityRegressionTests/SecurityRegressionTests.csproj --artifacts-path tools/SecurityRegressionTests/.artifacts
dotnet build Kiberaz.sln --artifacts-path tools/SecurityRegressionTests/.artifacts -v minimal
dotnet build tools/ImportQuestionsTool/ImportQuestionsTool.csproj --artifacts-path tools/SecurityRegressionTests/.artifacts -v minimal
dotnet list Kiberaz.sln package --vulnerable --include-transitive --no-restore --format json
cd kiberaz-ui
npm run build
npm audit --json --ignore-scripts
```

The harness uses isolated synthetic databases and a hidden ephemeral loopback API. Account-service tests use captured email, never SMTP. PDF fixtures use inert script text and never execute it. Coverage includes concurrent quiz replay, historical period deduplication, correct-first-answer control, public private-bank exclusion for anonymous/user/admin callers, cross-bank API/import rejection, idempotent and dry-run import, private exam grading, legacy rejection, real anonymous reset requests, valid recovery despite old lock, reset replay, old/new mailbox confirmation, upload quota/actual byte limits, encoded/compressed active PDFs, encrypted/malformed files, safe compressed PDF control, real upload and legacy download paths.

Production TLS/proxy/CDN behavior, mail delivery, deployed .NET runtime patch state and OS sandboxing were not tested.
