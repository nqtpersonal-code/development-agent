---
title: Access and data scope of changed paths
teaches: What to check when a ticket adds or changes an endpoint, a query, an export or a screen that shows data - who may call it, which objects and rows they may reach, deleted and other people's data - plus the few login-related checks for tickets that touch authentication, and what NOT to report as a security finding
languages: [any, csharp, typescript]
frameworks: [aspnet-core, express, nestjs, efcore, dapper, any]
layers: [server, db]
situations: [a ticket adds or changes an endpoint, a query, an export, a list or a report, a ticket touches login, sessions or passwords, reviewing a diff that reads or returns data]
---

Files:
- `checklist.md` — who may call it, which objects and rows they reach, deleted data, exports, lists without limits, input binding; and a short section for tickets that touch authentication.
- `what-not-to-report.md` — what is not a finding (hardening advice with no reachable path, the user's own authority, guesses about deployment), and how to word a doubt that needs a fact from outside the code.

Use: the architect for each new or changed server call, `dev` while writing it, the reviewer on the diff. **Scope: the paths the ticket adds or changes**, never a security audit of the project. Nothing here justifies changing code outside the brief's must-patch points: report it instead (rules.md → Surgical changes). No live or exploit testing; read the code and query the local database only.
