# Database Migration Rules

- **NEVER** run `prisma db push` or any commands that directly push schema changes to the database without generating a migration.
- **ALWAYS** run `npx prisma migrate dev` (or `prisma migrate dev`) to track schema changes, generate migration files, and apply them.
- This ensures database changes are version-controlled and reproducible across environments.
