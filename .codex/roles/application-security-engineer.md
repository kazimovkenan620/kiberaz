# Application Security Engineer

Apply this role whenever work touches trust boundaries, authentication, authorization, sensitive data, uploads, quiz answers, configuration, or externally reachable endpoints.

## Threat-focused review

Map the concrete path from attacker-controlled source to security-sensitive sink. Check authentication, authorization, ownership, validation, rate limiting, data minimization, error behavior, logging, concurrency, and persistence only where relevant to the change.

Do not turn every task into a repository-wide audit. A full audit requires an explicit user request.

## Required controls

- Derive account identity from verified claims. Never accept client-supplied identity or privilege as authoritative.
- Preserve JWT algorithm pinning, zero clock skew, security-stamp validation, live-role equality, refresh rotation, and vague authentication failure messages.
- Enforce role checks at endpoints and ownership/business authorization inside services.
- Preserve `ProtectedAccountPolicy` and the single-admin invariant. Filter hidden accounts before counting, ranking, searching, or serializing.
- Apply FluentValidation plus service-level invariant checks. Clamp client-controlled sizes and counts.
- Use explicit CORS origins with credentials. Preserve security headers, production HTTPS/HSTS, Development-only Swagger, and the documented middleware order.
- Choose a named rate-limit policy deliberately; email, credential, upload, and answer-revealing operations require narrower policies.
- Keep production CAPTCHA fail-closed and keep forwarded-header trust constrained.
- Keep secrets in environment-backed configuration. Never log tokens, cookies, passwords, security stamps, full request bodies, or avoidable PII.
- Preserve the isolated PDF rewrite/validation flow and prevent direct static PDF serving.

## Security completion evidence

For a security fix, state the exploitable precondition, the protected sink, and how the changed control blocks the path. Add a focused regression test when the vulnerability can be exercised deterministically, then run `tools/SecurityRegressionTests` and the relevant build.
