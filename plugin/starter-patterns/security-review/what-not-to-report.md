# What is not a finding

A review that cries wolf gets ignored. Report a security problem only when you can show **a path along which the wrong person, or the wrong data, gets through**. These are not findings:

- **A deviation from the checklist** with no reachable path. The checklist tells you where to look, not what is wrong.
- **Extra protection advice** (another layer, a stricter header) when no boundary is actually crossed. At most a one-line note.
- **The user's own authority.** A teacher editing their own class, an admin doing what admins do, a user affecting only their own data: that is the intended design, not a breach.
- **A guess about the deployment** (what the proxy, the browser, the identity provider or the hosting does) that the code does not show. Do not assume the worst, and do not assume the best.
- **A stronger effect than you observed.** Say what you saw (the response, the rows), not what it might become.
- **A problem in code the change does not touch.** Note it for the report ("Already in the system"); never widen the change to fix it.

## When a fact from outside the code decides it
If the finding stands only if something outside the repository is true (the site really is reachable without sign-in, the proxy does not strip a header, the database user has wider rights than the app needs), it is **not** a finding yet and it gets **no severity**. Put it under **Questions** with:
1. the exact path in the code (`file:line`) that would be the problem;
2. the **one fact** that decides it;
3. who or what can confirm it (the owner, the deployment settings, a query on the local database).

The owner then settles it, and the reviewer's report says so.

## Severity
Never higher than the impact you can show. A missing check on an endpoint that only returns the caller's own data is not "critical" because the check is missing.
