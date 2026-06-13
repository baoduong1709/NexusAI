import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const defaultCompany = await prisma.company.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "NexusAI Default Company",
    },
  });

  // Create default roles
  const adminPermissions = [
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
    "system:config:write",
    "system:config:read",
    "token:read",
  ];

  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {
      permissions: adminPermissions,
    },
    create: {
      name: "Admin",
      permissions: adminPermissions,
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
      permissions: ["project:read", "task:read", "task:update", "document:upload"],
    },
  });

  await prisma.role.upsert({
    where: { name: "Designer" },
    update: {},
    create: {
      name: "Designer",
      permissions: ["project:read", "task:read", "task:update", "document:upload"],
    },
  });

  await prisma.role.upsert({
    where: { name: "Tester" },
    update: {},
    create: {
      name: "Tester",
      permissions: ["project:read", "task:read", "task:update", "document:upload"],
    },
  });

  // Create admin user (Demo)
  const hashedPassword = await bcrypt.hash("Admin@123", 10);
  await prisma.user.upsert({
    where: { email: "admin@nexusai.com" },
    update: {
      isSuperAdmin: false,
    },
    create: {
      name: "Demo Admin",
      email: "admin@nexusai.com",
      password: hashedPassword,
      roleId: adminRole.id,
      companyId: defaultCompany.id,
      isSuperAdmin: false,
      skills: ["management", "planning"],
    },
  });

  // Create real Super Admin user
  const superAdminPassword = await bcrypt.hash("SuperAdmin@123", 10);
  await prisma.user.upsert({
    where: { email: "superadmin@nexusai.com" },
    update: {
      isSuperAdmin: true,
    },
    create: {
      name: "Super Admin",
      email: "superadmin@nexusai.com",
      password: superAdminPassword,
      roleId: adminRole.id,
      companyId: defaultCompany.id, // Assign to default company just in case some APIs need it
      isSuperAdmin: true,
      skills: ["system management", "security"],
    },
  });

  const devRole = await prisma.role.findUnique({ where: { name: "Developer" } });
  const designerRole = await prisma.role.findUnique({ where: { name: "Designer" } });
  const testerRole = await prisma.role.findUnique({ where: { name: "Tester" } });

  // Create PM
  await prisma.user.upsert({
    where: { email: "pm@nexusai.com" },
    update: {},
    create: {
      name: "Project Manager",
      email: "pm@nexusai.com",
      password: hashedPassword,
      roleId: pmRole.id,
      companyId: defaultCompany.id,
      isSuperAdmin: false,
      skills: ["agile", "scrum", "jira"],
    },
  });

  // Create Lead
  await prisma.user.upsert({
    where: { email: "lead@nexusai.com" },
    update: {},
    create: {
      name: "Tech Lead",
      email: "lead@nexusai.com",
      password: hashedPassword,
      roleId: leadRole.id,
      companyId: defaultCompany.id,
      isSuperAdmin: false,
      skills: ["architecture", "nodejs", "react"],
    },
  });

  // Create Developer 1
  await prisma.user.upsert({
    where: { email: "dev1@nexusai.com" },
    update: {},
    create: {
      name: "Frontend Developer",
      email: "dev1@nexusai.com",
      password: hashedPassword,
      roleId: devRole?.id,
      companyId: defaultCompany.id,
      isSuperAdmin: false,
      skills: ["react", "typescript", "tailwind"],
    },
  });

  // Create Developer 2
  await prisma.user.upsert({
    where: { email: "dev2@nexusai.com" },
    update: {},
    create: {
      name: "Backend Developer",
      email: "dev2@nexusai.com",
      password: hashedPassword,
      roleId: devRole?.id,
      companyId: defaultCompany.id,
      isSuperAdmin: false,
      skills: ["nestjs", "postgresql", "docker"],
    },
  });

  // Create Designer
  await prisma.user.upsert({
    where: { email: "designer@nexusai.com" },
    update: {},
    create: {
      name: "UI/UX Designer",
      email: "designer@nexusai.com",
      password: hashedPassword,
      roleId: designerRole?.id,
      companyId: defaultCompany.id,
      isSuperAdmin: false,
      skills: ["figma", "ui/ux", "prototyping"],
    },
  });

  // Create Tester
  await prisma.user.upsert({
    where: { email: "tester@nexusai.com" },
    update: {},
    create: {
      name: "QA Engineer",
      email: "tester@nexusai.com",
      password: hashedPassword,
      roleId: testerRole?.id,
      companyId: defaultCompany.id,
      isSuperAdmin: false,
      skills: ["cypress", "jest", "manual testing"],
    },
  });

  console.log("Seed completed!");
  console.log("Demo Admin login: admin@nexusai.com / Admin@123");
  console.log("Super Admin login: superadmin@nexusai.com / SuperAdmin@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
