import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Create default roles
  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: {
      name: "Admin",
      permissions: [
        "user:create",
        "user:read",
        "user:update",
        "user:delete",
        "role:create",
        "role:read",
        "role:update",
        "role:delete",
        "project:create",
        "project:read",
        "project:update",
        "project:delete",
        "task:create",
        "task:read",
        "task:update",
        "task:delete",
        "task:approve_ai",
        "document:upload",
        "document:delete",
        "ai:analyze",
      ],
    },
  });

  const pmRole = await prisma.role.upsert({
    where: { name: "PM" },
    update: {},
    create: {
      name: "PM",
      permissions: [
        "project:create",
        "project:read",
        "project:update",
        "task:create",
        "task:read",
        "task:update",
        "task:approve_ai",
        "document:upload",
        "ai:analyze",
        "user:read",
      ],
    },
  });

  const leadRole = await prisma.role.upsert({
    where: { name: "Lead" },
    update: {},
    create: {
      name: "Lead",
      permissions: [
        "project:read",
        "task:create",
        "task:read",
        "task:update",
        "task:approve_ai",
        "document:upload",
        "ai:analyze",
        "user:read",
      ],
    },
  });

  await prisma.role.upsert({
    where: { name: "Developer" },
    update: {},
    create: {
      name: "Developer",
      permissions: ["project:read", "task:read", "task:update"],
    },
  });

  await prisma.role.upsert({
    where: { name: "Designer" },
    update: {},
    create: {
      name: "Designer",
      permissions: ["project:read", "task:read", "task:update"],
    },
  });

  await prisma.role.upsert({
    where: { name: "Tester" },
    update: {},
    create: {
      name: "Tester",
      permissions: ["project:read", "task:read", "task:update"],
    },
  });

  // Create admin user
  const hashedPassword = await bcrypt.hash("Admin@123", 10);
  await prisma.user.upsert({
    where: { email: "admin@nexusai.com" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@nexusai.com",
      password: hashedPassword,
      roleId: adminRole.id,
      skills: ["management", "planning"],
    },
  });

  console.log("Seed completed!");
  console.log("Admin login: admin@nexusai.com / Admin@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
