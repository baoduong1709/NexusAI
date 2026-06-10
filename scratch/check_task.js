const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const task = await prisma.task.findUnique({
    where: { id: 'GLAPP-2' },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  console.log('--- TASK GLAPP-2 DETAILS ---');
  console.log('ID:', task.id);
  console.log('Title:', task.title);
  console.log('Description (length):', task.description ? task.description.length : 0);
  console.log('Description:', task.description);
  console.log('\n--- TASK ACTIVITIES (Last 10) ---');
  task.activities.slice(0, 10).forEach(act => {
    console.log(`[${act.createdAt.toISOString()}] Type: ${act.type} | Field: ${act.field} | From: "${act.fromValue}" | To: "${act.toValue}" | Body: "${act.body}"`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
