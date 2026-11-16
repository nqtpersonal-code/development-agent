---
title: .NET review checklist
teaches: What to check when reviewing or writing a change in an ASP.NET Core / EF Core / Dapper / Razor Pages code base - async mistakes, data access, nullability, authorization, dependency injection, configuration
languages: [csharp]
frameworks: [aspnet-core, efcore, dapper, razor-pages, blazor]
layers: [server, db]
situations: [reviewing a change that touches .cs files, planning a change in a .NET project, a ticket that adds an endpoint, a query or a screen in a .NET project]
---

Files:
- `checklist.md` — the review checklist: async, nullability, dependency injection, authorization and middleware, configuration and secrets, error handling.
- `data-access.md` — EF Core, Dapper and raw SQL: injection, tracking, loading in loops, soft-delete filters, transactions, dates and money.

Use: the reviewer reads it when the diff touches `.cs`, `.cshtml` or `.razor` files; `dev` and the architect read it for .NET changes. These are things to check, not rules to impose: the project's own conventions win, and nothing here justifies a change outside the brief's must-patch points (report it instead). Run the project's own build and its own analyzers or formatter only if it already uses them; never add tooling.
