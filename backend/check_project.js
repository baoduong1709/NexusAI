const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findUnique({
    where: { id: 3 }
  });
  if (project) {
    console.log('--- PROJECT 3 DETAILS ---');
    console.log('ID:', project.id);
    console.log('Name:', project.name);
    console.log('Epics:', project.epics);
    console.log('Labels:', project.labels);
    console.log('Task Naming Rule:', project.taskNamingRule);
  } else {
    console.log('Project 3 not found!');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
