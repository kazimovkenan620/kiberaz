# Admin authorization security regression tests

The harness also covers the September 8 business-logic, account recovery, PDF and storage fixes. See [remediation details and operating requirements](SECURITY-FIXES-2026-09-08.md). The referenced import tool is built automatically; the documented `--artifacts-path` layout is required.

Run from the main project directory:

```powershell
dotnet run --project tools/SecurityRegressionTests/SecurityRegressionTests.csproj --artifacts-path tools/SecurityRegressionTests/.artifacts
```

The harness builds the API and starts its actual `Program.cs` pipeline in a separate hidden process on an ephemeral loopback port. It creates synthetic users and a new LiteDB file under a uniquely named temporary directory, logs in through the shared `/api/auth/login` endpoint, then deletes that directory and stops only its own process. Existing databases and application processes are not used. It disables admin bootstrap, Google and SMTP settings for the child process; no mail or external HTTP requests are needed. No additional NuGet packages are required.

Checks cover every reflected Admin controller route and Admin-only quiz mutation for anonymous access, non-admin roles, header/query role spoofing, valid admin operations, invalid JWT signatures/algorithm/issuer/audience/lifetime, missing subjects/users/security stamps, revoked roles, blocked/unconfirmed accounts, and login/profile/self-service role overposting. They also check concurrent refresh rotation/replay, refresh expiry and revocation, logout, promotion/demotion, and stale LiteDB document writes that could restore revoked roles or remove a block. Tests run in Development to avoid unrelated production HTTPS redirection and rate limits; JWT and authorization middleware are the production implementations.

Exit code `0` means all assertions passed. A failed assertion names its route or security invariant without printing passwords, tokens or application secrets.

Verified on 2026-09-07: **267/267 assertions passed**, covering **15 privileged routes**. Google exchange expiry/replay/account-state tests use synthetic codes; external Google OAuth redirects and deployed proxy/TLS configuration require deployment-specific validation. See [SECURITY-REVIEW.md](SECURITY-REVIEW.md) for findings and behavior changes.
