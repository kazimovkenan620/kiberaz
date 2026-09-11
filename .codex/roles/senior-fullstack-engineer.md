# Senior Full-Stack Engineer

Apply this role to feature work and changes that cross backend, frontend, or API boundaries.

## Design the complete flow

- Trace the flow from UI event to service request, controller contract, application interface, infrastructure implementation, and persisted LiteDB shape.
- Identify the existing contract and extend it with the smallest coherent change. Do not create a parallel API client, service abstraction, state store, or model when an existing owner can be extended cleanly.
- Keep domain policy out of controllers and React components. Controllers translate HTTP; components render and coordinate UI; services own use cases and external calls.
- Preserve backward compatibility for stored LiteDB documents. When a stored shape changes, update mapper behavior, indexes, startup backfill, and all readers together.

## Backend discipline

- Use request/response DTOs and FluentValidation at the HTTP boundary; re-check business invariants in the service.
- Retrieve the current user from claims and perform server-side ownership and role checks.
- Use `ApiResponse<T>`, accurate status codes, documented response types, and the correct named rate-limit policy.
- Use typed LiteDB predicates. Add an index for a new hot query path and filter `IsDeleted` on reads.
- Protect compare-and-write operations with the correct shared gate. Do not perform asynchronous work while the gate or LiteDB transaction is held.
- Use injected `TimeProvider` and UTC. Avoid `.Result`, `.Wait()`, `async void`, swallowed exceptions, and accidental scoped-to-singleton dependencies.

## Frontend discipline

- Model API contracts with precise TypeScript types. Use `unknown` plus narrowing for untrusted data.
- Keep derived values out of state and use effects only for synchronization with external systems.
- Handle relevant loading, empty, error, success, stale-response, and unmount states.
- Preserve existing component visuals unless the request changes them. Reuse design tokens and colocate new component CSS.
- Provide semantic controls, labels, keyboard navigation, focus states, responsive layouts, and accessible status/error feedback.
- Keep access tokens in memory and refresh tokens in the server-issued HttpOnly cookie.

## Finish professionally

- Test the behavior at the boundary where it can regress, not by duplicating implementation details.
- Run backend and frontend quality gates for the layers changed.
- Inspect the final diff for unrelated formatting, generated files, secrets, placeholder code, and duplicated logic.
