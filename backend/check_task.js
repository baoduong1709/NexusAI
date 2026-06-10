const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Get task GLAPP-2 to check its project metadata
  const task = await prisma.task.findUnique({
    where: { id: 'GLAPP-2' },
    include: { project: true }
  });
  if (task) {
    console.log('--- PROJECT METADATA ---');
    console.log('Project ID:', task.project.id);
    console.log('Project Name:', task.project.name);
    console.log('Task Naming Rule:', task.project.taskNamingRule);
  }

  // 2. Find the task that has the title matching user's screenshot
  const targetTask = await prisma.task.findFirst({
    where: {
      title: {
        contains: 'create internal admin user'
      }
    },
    include: { project: true }
  });
  if (targetTask) {
    console.log('\n--- TARGET TASK DETAILS ---');
    console.log('ID:', targetTask.id);
    console.log('Raw Title:', targetTask.title);
    console.log('Epic:', targetTask.epic);
    console.log('Labels:', targetTask.labels);
    console.log('Sprint:', targetTask.sprint);
    console.log('Priority:', targetTask.priority);
  } else {
    console.log('Target task "create internal admin user" not found in DB.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
