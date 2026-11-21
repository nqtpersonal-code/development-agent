# Access and data scope: checklist for changed paths

Check the endpoints, queries, exports and screens the change adds or touches, and the callers of what it touches. A finding names the path and how the wrong person or the wrong rows get through; see `what-not-to-report.md` for what is not one.

## 1. Who may call it
- [ ] The new or changed endpoint, page handler or job has the **same authorization as its neighbours** that return similar data (attribute, policy, middleware, `.RequireAuthorization()`); an added "allow anonymous" is intended.
- [ ] The check is on the **server**. A hidden button or a client-side guard protects nothing.
- [ ] The role or permission checked is the one the owner described, not a broader one that was easier.

## 2. Which objects and rows they may reach
- [ ] Reading, updating, deleting, listing, counting or exporting **by id** also checks that the object belongs to the caller's school, branch, account or team (whatever the project's scope is). An id from the URL or the body is not proof of ownership.
- [ ] The owner or scope of a new record comes from the **signed-in user**, never from a field the caller sends.
- [ ] The same check holds on every path to the data: single, bulk, import, search, nested relation, background job, report.
- [ ] A **hand-written query** (Dapper, stored procedure, raw SQL, report) applies the same scope and deleted-row filters as the ORM queries on the same table; compare with its sibling queries. A joined or aggregated query is a favourite place to lose the filter.
- [ ] A role or membership that is removed stops working where it is cached (session, token lifetime, in-memory cache, job queue).

## 3. Deleted and hidden data
- [ ] Lookups, searches, list screens, relations followed from other rows, jobs, restore actions and **exports** skip soft-deleted rows, unless showing them is the point.
- [ ] A deleted or archived row cannot be changed or acted on by id.

## 4. Exports and reports
- [ ] An export contains only the rows and columns the caller may see; hidden columns, other scopes' rows and deleted rows are left out. A low-privilege user's export is checked against what the screen shows.
- [ ] Generated files and links are not guessable and are not shared across callers.

## 5. What the response gives away
- [ ] Errors do not tell a caller whether a record they may not see exists ("not found" and "no access" look the same where that matters); lists and counts are not computed over rows the caller cannot see.
- [ ] Error messages, logs and responses carry no stack traces, connection strings, tokens or other people's personal data.

## 6. Input and limits
- [ ] The request is bound to a **request model with only the allowed fields**, not straight onto a database entity: a caller must not be able to set fields like role, owner, price or status by adding them to the body (mass assignment).
- [ ] Lists, searches and exports have a **page size and a maximum**; filters, expansion depth, body and upload size are bounded; one request cannot read or buffer an unbounded set. Expensive work (hashing, parsing, big queries) does not run before the caller is authenticated and the size is checked.
- [ ] Values that reach SQL are parameters (see `dotnet-review/data-access.md`); text reaching HTML is encoded.

## 7. Only when the ticket touches login, sessions or accounts
- [ ] **Cookie-authenticated routes that change data** have an anti-forgery token or an origin check; routes that only read, or that use a bearer token only, do not need one.
- [ ] A session or token is **renewed on login and on a change of rights**, and ends on logout, password change and account disable.
- [ ] A password-reset or invite token is random, tied to one user and action, expires, works once, and old tokens stop working when a new one is issued. Links in emails are built from configured addresses, not from the request's host header.
- [ ] Token validation checks signature, algorithm (fixed on the server), issuer, audience and expiry; nothing is trusted merely because it decodes.
- [ ] Changing or removing a second factor needs a fresh proof; an alternative route cannot bypass it.
- [ ] Secret keys stay on the server: not in the client bundle, not in URLs, not in logs.
