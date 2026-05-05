# AGENTS

## Local Execution Policy
- Do not start or run local services from Codex.
- Do not run commands like `npm run dev`, `npm run start`, `npm run start:dev`, `pnpm dev`, `yarn dev`, or `docker compose up`.
- Do not run `npm run` commands by default.
- Only run read-only commands by default.
- If build or test commands are needed, ask for explicit user confirmation first.
