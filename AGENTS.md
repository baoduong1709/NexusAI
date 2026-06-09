# AGENTS

## Local Execution Policy
- The agent is granted full permission to run build, test, code generation (like Prisma generate), and package installation commands freely without asking for explicit user confirmation first.
- Do not run persistent local development servers (like `npm run dev`, `npm run start`, `pnpm dev`, `yarn dev`) or background docker services unless explicitly requested by the user.
- NEVER automatically restart or rerun `npm run dev` (or similar dev server commands) after modifying code; assume the user is managing it and hot reload is handling the changes.

