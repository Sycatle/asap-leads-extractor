# Security policy

## Supported versions

Only the `main` branch is actively maintained. Security fixes are applied there.

## Reporting a vulnerability

**Do not open a public GitHub issue.** Email `sycatle@pm.me` with:

- A description of the issue and the impact you anticipate.
- Reproduction steps or a minimal proof of concept.
- Affected commit / version.
- Any suggested fix or mitigation.

You can expect:

- **Acknowledgement** within 7 days.
- **Status update** within 30 days.
- **Coordinated disclosure** within 90 days, or sooner if a fix ships earlier.

If you do not get a reply within 7 days, please send a polite reminder.

## Scope

In scope: code in this repository (worker, web, db, docker setup, default configuration).

Out of scope: vulnerabilities in third-party services (Resend, Anthropic, Pappers, Societe.com), in user-deployed forks, or in dependencies (please report those upstream).

## Safe-harbor

We will not take legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, or service interruption.
- Stop testing and report immediately as soon as a vulnerability is identified.
- Only interact with their own accounts / their own data.
