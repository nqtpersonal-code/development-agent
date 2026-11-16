# .NET review checklist

Look only at the lines the change adds or touches, plus the places that call them. Report what you can show (file:line and how it fails), not what looks unusual.

## Async
- [ ] No `.Result`, `.Wait()` or `.GetAwaiter().GetResult()` on a task inside request code: it can freeze the thread pool or deadlock.
- [ ] No `async void` except event handlers; its exceptions cannot be caught by the caller.
- [ ] A method that accepts a `CancellationToken` passes it on to every awaited call that takes one; new endpoints take one from the request.
- [ ] Independent awaits are not run one after another when they could run together (`Task.WhenAll`), and `Task.Run` is not used to wrap work that is already async.

## Nullability and types
- [ ] New `!` (null-forgiving), `#nullable disable` or `#pragma warning disable` lines have a reason that holds; each hides a possible `NullReferenceException`.
- [ ] `FirstOrDefault`/`SingleOrDefault` results are checked before use; `Single` is not used where several rows are possible.
- [ ] Money is `decimal`, not `double`; times that cross systems are UTC or `DateTimeOffset`, not local `DateTime`.

## Dependency injection and lifetime
- [ ] A singleton does not hold a scoped service (a `DbContext` captured in a singleton or a static field).
- [ ] `HttpClient` comes from `IHttpClientFactory` or a shared instance, not `new HttpClient()` per call.
- [ ] A new service is registered with the lifetime the project uses for similar ones.

## Authorization and request pipeline
- [ ] Every new endpoint or page handler has the same authorization as its neighbours (`[Authorize]`, a policy, `.RequireAuthorization()` on minimal APIs); any added `[AllowAnonymous]` is intended.
- [ ] Authentication runs before authorization in the middleware order; a moved or added middleware does not change that.
- [ ] Input is bound to a request model, not straight to a database entity (extra properties would be set by the caller); validation attributes or checks exist.
- [ ] Razor output is encoded; `@Html.Raw` and `MarkupString` get only trusted content.

## Configuration and secrets
- [ ] No secrets, connection strings or keys in code or in a committed `appsettings*.json`; they come from configuration, user secrets or the environment.
- [ ] New settings have a default or a clear failure when missing, not a `NullReferenceException` later.

## Errors and logging
- [ ] `catch` blocks do not swallow: empty catch, or log-and-continue where the caller needed to know. `catch (Exception)` that returns a default hides real failures.
- [ ] `throw;` (not `throw ex;`) keeps the original stack.
- [ ] Logs do not include personal data, passwords or tokens.
