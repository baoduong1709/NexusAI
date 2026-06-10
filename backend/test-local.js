const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");

const prisma = new PrismaClient();
const JWT_SECRET = "bao1709";

async function main() {
  try {
    // 1. Get system admin user with role
    const adminUser = await prisma.user.findUnique({
      where: { email: "admin@nexusai.com" },
      include: { role: true }
    });
    if (!adminUser) {
      console.log("Admin user admin@nexusai.com not found!");
      prisma.$disconnect();
      return;
    }
    console.log(`Using Admin User: ID=${adminUser.id}, Name=${adminUser.name}, Role=${adminUser.role?.name}`);

    // 2. Get the first project
    const project = await prisma.project.findFirst();
    if (!project) {
      console.log("No projects found in database!");
      prisma.$disconnect();
      return;
    }
    console.log(`Using Project: ID=${project.id}, Name=${project.name}`);

    // 3. Ensure admin user is a project member
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: adminUser.id
        }
      }
    });

    if (!membership) {
      console.log(`Adding Admin User to Project ${project.id}...`);
      await prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: adminUser.id,
          projectRole: "PM"
        }
      });
    } else {
      console.log("Admin user is already a member of the project.");
    }

    // 4. Generate JWT token with correct payload fields
    const payload = {
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role?.name,
      permissions: adminUser.role?.permissions || [],
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
    console.log("Generated JWT Token:", token);

    // 5. Call chat-stream endpoint
    console.log("Sending chat request...");
    const url = `http://localhost:4000/api/projects/${project.id}/ai/chat-stream`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          { role: "user", content: "chào bạn" }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`HTTP error! status: ${response.status}, body: ${errText}`);
      prisma.$disconnect();
      return;
    }

    console.log("Stream Response started:");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      process.stdout.write(decoder.decode(value));
    }
    
    console.log("\nStream finished.");
    prisma.$disconnect();

  } catch (err) {
    console.error("Error running test:", err.message);
    prisma.$disconnect();
  }
}

main();
