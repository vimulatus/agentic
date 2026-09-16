This machine is my Mac.

- Open an HTML file, a PDF or an image with `open <path>`. It goes to the default app.

- `agent-device` drives iOS and Android, the way `agent-browser` drives a browser. Use it for any native feedback loop: `snapshot` for the accessibility tree, `click`/`fill` by selector or ref, `screenshot`, `record`, `network dump`, `logs`, and `test <glob>` for replay suites. `metro prepare` and `metro reload` handle an Expo dev server.
- Postgres runs in Docker, one container per project, `postgres:18-alpine`. Taken so far: `prompter-postgres` on 5432, `e-akhbaar-postgres` on 5433. Give a new project the next free port and its own container. Never point a new project at another project's database.
- `eas` is installed via Homebrew. `wrangler`, `psql` and `neonctl` are not global — take them as project dev dependencies.
